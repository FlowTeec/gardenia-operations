"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import { portalPath } from "./access";
import { currentActor, signIn, signOut } from "./auth";
import { hashPassword } from "./password";
import { readWorkspace, updateWorkspace } from "./store";
import type {
  Branch,
  GardeniaRole,
  GardeniaUser,
  Product,
  ProductCategory,
  ReplenishmentLine,
  SalesRequestLine,
} from "./types";

// ─── Auth Actions ────────────────────────────────────────────────────────────

export async function loginAction(formData: FormData) {
  const id = String(formData.get("employeeId") ?? "").trim();
  const pw = String(formData.get("password") ?? "");

  if (!id || !pw) return { error: "Employee ID and password are required." };

  const result = await signIn(id, pw);
  if (!result.ok) return { error: result.error };

  const actor = await currentActor();
  if (!actor) return { error: "Session error. Please try again." };

  redirect(portalPath(actor.role));
}

export async function logoutAction() {
  await signOut();
  redirect("/g/login");
}

// ─── Sales Request Actions ────────────────────────────────────────────────────

export async function createSalesRequest(formData: FormData) {
  const actor = await currentActor();
  if (!actor || actor.role !== "salesperson") return { error: "Unauthorized" };

  const customerName = String(formData.get("customerName") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const linesJson = String(formData.get("lines") ?? "[]");

  if (!customerName) return { error: "Customer name is required." };

  let lines: SalesRequestLine[];
  try {
    lines = JSON.parse(linesJson) as SalesRequestLine[];
  } catch {
    return { error: "Invalid product lines." };
  }

  if (!lines.length) return { error: "At least one product is required." };
  if (!actor.branchId) return { error: "Your account is not assigned to a branch." };

  for (const line of lines) {
    if (!line.productId || typeof line.productId !== "string") {
      return { error: "Each line must name a product." };
    }
    if (!Number.isFinite(line.requestedQty) || line.requestedQty < 1 || line.requestedQty > 100_000) {
      return { error: "Each requested quantity must be between 1 and 100,000." };
    }
  }

  const catalog = await readWorkspace();
  if (lines.some((line) => !catalog.products.some((p) => p.id === line.productId && p.active))) {
    return { error: "One or more products are not available." };
  }

  const result = await updateWorkspace((ws) => {
    ws.counters.salesRequest += 1;
    const requestNumber = `SR-${new Date().getFullYear()}-${String(ws.counters.salesRequest).padStart(4, "0")}`;
    const id = `sr-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const pricedLines = lines.map((line) => {
      const product = ws.products.find((p) => p.id === line.productId);
      return {
        productId: line.productId,
        requestedQty: line.requestedQty,
        unitPrice: product?.sellingPrice ?? 0,
        approvedQty: null,
        issuedQty: null,
      };
    });

    ws.salesRequests.push({
      id,
      requestNumber,
      branchId: actor.branchId!,
      salespersonId: actor.id,
      customerName,
      status: "pending",
      lines: pricedLines,
      notes,
      approvedBy: null,
      approvalNotes: null,
      approvedAt: null,
      issuedBy: null,
      issuedAt: null,
      issueNotes: null,
      issueTicketId: null,
      createdAt: now,
      updatedAt: now,
    });

    // Notify branch manager
    const managers = ws.users.filter(
      (u) => u.role === "branch_manager" && u.branchId === actor.branchId && u.active
    );
    for (const mgr of managers) {
      ws.notifications.push({
        id: randomUUID(),
        userId: mgr.id,
        title: "New Sales Request",
        message: `${actor.name} submitted request ${requestNumber} for ${customerName}`,
        type: "info",
        read: false,
        relatedRequestId: id,
        relatedType: "sales",
        createdAt: now,
      });
    }

    return requestNumber;
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/g/salesperson");
  redirect("/g/salesperson");
}

export async function resubmitSalesRequest(requestId: string, formData: FormData) {
  const actor = await currentActor();
  if (!actor || actor.role !== "salesperson") return { error: "Unauthorized" };

  const customerName = String(formData.get("customerName") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const linesJson = String(formData.get("lines") ?? "[]");
  if (!customerName) return { error: "Client name is required." };

  let lines: { productId: string; requestedQty: number }[];
  try {
    lines = JSON.parse(linesJson) as { productId: string; requestedQty: number }[];
  } catch {
    return { error: "Invalid product lines." };
  }
  if (!lines.length) return { error: "At least one product is required." };
  for (const line of lines) {
    if (!line.productId) return { error: "Each line must name a product." };
    if (!Number.isFinite(line.requestedQty) || line.requestedQty < 1 || line.requestedQty > 100_000) {
      return { error: "Each requested quantity must be between 1 and 100,000." };
    }
  }

  const result = await updateWorkspace((ws) => {
    const req = ws.salesRequests.find((item) => item.id === requestId);
    if (!req) return { error: "Request not found" };
    if (req.salespersonId !== actor.id) return { error: "You can only change your own requests." };
    if (req.status === "issued" || req.status === "partially_issued") {
      return { error: "A confirmed issuance cannot be changed." };
    }
    if (req.status !== "returned") return { error: "Only requests returned for changes can be edited." };

    const priced = lines.map((line) => {
      const product = ws.products.find((p) => p.id === line.productId && p.active);
      if (!product) return null;
      return {
        productId: line.productId,
        requestedQty: line.requestedQty,
        unitPrice: product.sellingPrice,
        approvedQty: null,
        issuedQty: null,
      };
    });
    if (priced.some((line) => line === null)) return { error: "One or more products are not available." };

    const now = new Date().toISOString();
    req.customerName = customerName;
    req.notes = notes;
    req.lines = priced.filter((line): line is NonNullable<typeof line> => line !== null);
    req.status = "pending";
    req.approvedBy = null;
    req.approvedAt = null;
    req.approvalNotes = null;
    req.updatedAt = now;

    const managers = ws.users.filter(
      (u) => u.role === "branch_manager" && u.branchId === actor.branchId && u.active
    );
    for (const manager of managers) {
      ws.notifications.push({
        id: randomUUID(),
        userId: manager.id,
        title: "Request Resubmitted",
        message: `${actor.name} updated ${req.requestNumber} for ${customerName} and sent it back for approval.`,
        type: "info",
        read: false,
        relatedRequestId: req.id,
        relatedType: "sales",
        createdAt: now,
      });
    }
    return { error: null };
  });

  if (!result.ok) return { error: result.error };
  if (result.value?.error) return { error: result.value.error };
  revalidatePath("/g/salesperson");
  redirect("/g/salesperson");
}

export async function approveSalesRequest(
  requestId: string,
  action: "approve" | "reject" | "return",
  notes: string
) {
  const actor = await currentActor();
  if (!actor || actor.role !== "branch_manager") return { error: "Unauthorized" };
  if ((action === "reject" || action === "return") && !notes.trim()) {
    return { error: action === "reject" ? "A rejection reason is required." : "Explain what the salesperson should change." };
  }

  const result = await updateWorkspace((ws) => {
    const req = ws.salesRequests.find((r) => r.id === requestId);
    if (!req) return { error: "Request not found" };
    if (req.branchId !== actor.branchId) return { error: "Not your branch" };
    if (req.status === "issued" || req.status === "partially_issued") {
      return { error: "A confirmed issuance cannot be changed." };
    }
    if (req.status !== "pending") return { error: "Request already processed" };

    const now = new Date().toISOString();
    req.approvedBy = actor.id;
    req.approvedAt = now;
    req.approvalNotes = notes.trim() || null;
    req.status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "returned";
    req.updatedAt = now;

    if (action === "approve") {
      req.lines = req.lines.map((l) => ({ ...l, approvedQty: l.requestedQty }));
    } else {
      req.lines = req.lines.map((l) => ({ ...l, approvedQty: null, issuedQty: null }));
    }

    const salesperson = ws.users.find((u) => u.id === req.salespersonId);
    const title =
      action === "approve" ? "Request Approved" : action === "reject" ? "Request Rejected" : "Request Returned";
    const message =
      action === "approve"
        ? `Your request ${req.requestNumber} has been approved and is waiting for issuance`
        : action === "reject"
          ? `Your request ${req.requestNumber} was rejected: ${notes.trim()}`
          : `Your request ${req.requestNumber} was returned for changes: ${notes.trim()}`;
    if (salesperson) {
      ws.notifications.push({
        id: randomUUID(),
        userId: salesperson.id,
        title,
        message,
        type: action === "approve" ? "success" : action === "reject" ? "error" : "warning",
        read: false,
        relatedRequestId: requestId,
        relatedType: "sales",
        createdAt: now,
      });
    }

    // Notify storekeeper if approved
    if (action === "approve") {
      const storekeepers = ws.users.filter(
        (u) => u.role === "branch_storekeeper" && u.branchId === actor.branchId && u.active
      );
      for (const sk of storekeepers) {
        ws.notifications.push({
          id: randomUUID(),
          userId: sk.id,
          title: "Request Ready for Issue",
          message: `Sales request ${req.requestNumber} approved – ready for dispatch`,
          type: "info",
          read: false,
          relatedRequestId: requestId,
          relatedType: "sales",
          createdAt: now,
        });
      }
    }

    return { error: null };
  });

  if (!result.ok) return { error: result.error };
  if (result.value?.error) return { error: result.value.error };

  revalidatePath("/g/manager");
  return { ok: true };
}

export async function issueSalesRequest(
  requestId: string,
  issuedLines: { productId: string; issuedQty: number }[],
  notes = ""
) {
  const actor = await currentActor();
  if (!actor || actor.role !== "branch_storekeeper") return { error: "Unauthorized" };
  if (notes.length > 2000) return { error: "Issue notes are too long." };

  // Server-side quantity validation
  for (const line of issuedLines) {
    if (!Number.isFinite(line.issuedQty) || line.issuedQty < 0) {
      return { error: "Issue quantity must be a non-negative number." };
    }
    if (line.issuedQty > 100_000) {
      return { error: "Issue quantity exceeds the maximum allowed per line (100,000)." };
    }
  }

  const result = await updateWorkspace((ws) => {
    const req = ws.salesRequests.find((r) => r.id === requestId);
    if (!req) return { error: "Request not found" };
    if (req.branchId !== actor.branchId) return { error: "Not your branch" };
    if (req.status !== "approved") return { error: "Request not approved" };
    if (req.issueTicketId) return { error: "An issue ticket already exists for this request." };

    const shortage = req.lines.some((line) => {
      const issued = issuedLines.find((item) => item.productId === line.productId);
      return (issued?.issuedQty ?? 0) < (line.approvedQty ?? 0);
    });
    if (shortage && !notes.trim()) {
      return { error: "Add a note explaining the shortage or partial issuance." };
    }
    if (issuedLines.reduce((sum, line) => sum + line.issuedQty, 0) <= 0) {
      return { error: "Issue at least one unit before confirming." };
    }

    const now = new Date().toISOString();

    // Enforce each issued qty cannot exceed the approved qty on the line
    for (const issued of issuedLines) {
      const line = req.lines.find((l) => l.productId === issued.productId);
      if (line && issued.issuedQty > (line.approvedQty ?? 0)) {
        const product = ws.products.find((p) => p.id === issued.productId);
        return { error: `Issued quantity for ${product?.name ?? issued.productId} exceeds approved quantity.` };
      }
    }

    // Check inventory
    for (const issued of issuedLines) {
      const bal = ws.inventoryBalances.find(
        (b) => b.productId === issued.productId && b.locationId === actor.branchId
      );
      if (!bal || bal.quantity < issued.issuedQty) {
        const product = ws.products.find((p) => p.id === issued.productId);
        return { error: `Insufficient stock for ${product?.name ?? issued.productId}` };
      }
    }

    // Deduct inventory
    for (const issued of issuedLines) {
      const bal = ws.inventoryBalances.find(
        (b) => b.productId === issued.productId && b.locationId === actor.branchId
      );
      if (bal) {
        const before = bal.quantity;
        bal.quantity -= issued.issuedQty;
        bal.updatedAt = now;

        ws.inventoryMovements.push({
          id: randomUUID(),
          productId: issued.productId,
          quantity: -issued.issuedQty,
          quantityBefore: before,
          quantityAfter: bal.quantity,
          movementType: "sale_issue",
          sourceLocationId: actor.branchId,
          destinationLocationId: "customer",
          relatedRequestId: requestId,
          performedBy: actor.id,
          performedAt: now,
          notes: `Issued for ${req.customerName}`,
        });
      }
    }

    // Update request
    req.lines = req.lines.map((l) => {
      const issued = issuedLines.find((i) => i.productId === l.productId);
      return { ...l, issuedQty: issued?.issuedQty ?? 0 };
    });

    const allIssued = req.lines.every((l) => (l.issuedQty ?? 0) === (l.approvedQty ?? 0));
    req.status = allIssued ? "issued" : "partially_issued";
    req.issuedBy = actor.id;
    req.issuedAt = now;
    req.issueNotes = notes.trim() || null;
    req.updatedAt = now;

    ws.counters.issueTicket += 1;
    const ticketNumber = `IT-${new Date(now).getFullYear()}-${String(ws.counters.issueTicket).padStart(4, "0")}`;
    const ticketId = `it-${randomUUID().slice(0, 8)}`;
    const branch = ws.branches.find((b) => b.id === req.branchId);
    const salespersonUser = ws.users.find((u) => u.id === req.salespersonId);
    const ticketLines = req.lines.map((line) => {
      const product = ws.products.find((p) => p.id === line.productId);
      const issuedQty = line.issuedQty ?? 0;
      return {
        productId: line.productId,
        sku: product?.sku ?? line.productId,
        productName: product?.name ?? line.productId,
        unit: product?.unit ?? "",
        requestedQty: line.requestedQty,
        approvedQty: line.approvedQty ?? 0,
        issuedQty,
        unitPrice: line.unitPrice,
        lineTotal: Math.round(issuedQty * line.unitPrice * 100) / 100,
      };
    });
    ws.issueTickets.push({
      id: ticketId,
      ticketNumber,
      salesRequestId: req.id,
      requestNumber: req.requestNumber,
      branchId: req.branchId,
      branchName: branch?.name ?? req.branchId,
      customerName: req.customerName,
      salespersonId: req.salespersonId,
      salespersonName: salespersonUser?.name ?? req.salespersonId,
      storekeeperId: actor.id,
      storekeeperName: actor.name,
      issuedAt: now,
      notes: req.issueNotes,
      lines: ticketLines,
      totalValue: Math.round(ticketLines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100,
      status: req.status,
    });
    req.issueTicketId = ticketId;

    // Notify salesperson
    const salesperson = salespersonUser;
    if (salesperson) {
      ws.notifications.push({
        id: randomUUID(),
        userId: salesperson.id,
        title: "Items Dispatched",
        message: `Issue ticket ${ticketNumber} is ready for request ${req.requestNumber}. Issued value is recorded on the ticket.`,
        type: "success",
        read: false,
        relatedRequestId: requestId,
        relatedType: "sales",
        createdAt: now,
      });
    }

    // Check low stock alerts
    for (const issued of issuedLines) {
      const bal = ws.inventoryBalances.find(
        (b) => b.productId === issued.productId && b.locationId === actor.branchId
      );
      const product = ws.products.find((p) => p.id === issued.productId);
      if (bal && product && bal.quantity <= product.minStockLevel) {
        const managers = ws.users.filter(
          (u) =>
            (u.role === "branch_manager" || u.role === "branch_storekeeper") &&
            u.branchId === actor.branchId &&
            u.active
        );
        for (const mgr of managers) {
          ws.notifications.push({
            id: randomUUID(),
            userId: mgr.id,
            title: "Low Stock Alert",
            message: `${product.name} is below minimum stock level (${bal.quantity} ${product.unit} remaining)`,
            type: "warning",
            read: false,
            relatedRequestId: null,
            relatedType: "inventory",
            createdAt: now,
          });
        }
      }
    }

    const managers = ws.users.filter(
      (u) => u.role === "branch_manager" && u.branchId === actor.branchId && u.active
    );
    for (const manager of managers) {
      ws.notifications.push({
        id: randomUUID(),
        userId: manager.id,
        title: "Issue Ticket Generated",
        message: `${actor.name} issued ${ticketNumber} for ${req.requestNumber} (${req.customerName}).`,
        type: "success",
        read: false,
        relatedRequestId: requestId,
        relatedType: "sales",
        createdAt: now,
      });
    }

    return { error: null, ticketId, ticketNumber };
  });

  if (!result.ok) return { error: result.error };
  if (result.value?.error) return { error: result.value.error };

  revalidatePath("/g/storekeeper");
  revalidatePath("/g/salesperson");
  revalidatePath("/g/manager");
  return { ok: true as const, ticketId: result.value?.ticketId, ticketNumber: result.value?.ticketNumber };
}

// ─── Replenishment Actions ────────────────────────────────────────────────────

export async function createReplenishmentRequest(formData: FormData) {
  const actor = await currentActor();
  if (!actor || actor.role !== "branch_storekeeper") return { error: "Unauthorized" };

  const notes = String(formData.get("notes") ?? "").trim() || null;
  const linesJson = String(formData.get("lines") ?? "[]");

  let lines: ReplenishmentLine[];
  try {
    const raw = JSON.parse(linesJson) as { productId: string; requestedQty: number }[];
    lines = raw.map((l) => ({
      productId: l.productId,
      requestedQty: l.requestedQty,
      approvedQty: null,
      dispatchedQty: null,
      receivedQty: null,
    }));
  } catch {
    return { error: "Invalid product lines." };
  }

  if (!lines.length) return { error: "At least one product is required." };
  if (!actor.branchId) return { error: "Your account is not assigned to a branch." };

  for (const line of lines) {
    if (!line.productId || typeof line.productId !== "string") {
      return { error: "Each line must name a product." };
    }
    if (!Number.isFinite(line.requestedQty) || line.requestedQty < 1 || line.requestedQty > 100_000) {
      return { error: "Each requested quantity must be between 1 and 100,000." };
    }
  }

  const replenishmentCatalog = await readWorkspace();
  if (lines.some((line) => !replenishmentCatalog.products.some((p) => p.id === line.productId && p.active))) {
    return { error: "One or more products are not available." };
  }

  const result = await updateWorkspace((ws) => {
    ws.counters.replenishment += 1;
    const requestNumber = `RR-${new Date().getFullYear()}-${String(ws.counters.replenishment).padStart(4, "0")}`;
    const id = `rr-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    ws.replenishmentRequests.push({
      id,
      requestNumber,
      branchId: actor.branchId!,
      storekeeperIdRequesting: actor.id,
      status: "pending",
      lines,
      notes,
      approvedBy: null,
      approvalNotes: null,
      approvedAt: null,
      dispatchedBy: null,
      dispatchedAt: null,
      receivedBy: null,
      receivedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // Notify warehouse manager
    const warehouseManagers = ws.users.filter(
      (u) => u.role === "warehouse_manager" && u.active
    );
    for (const wm of warehouseManagers) {
      ws.notifications.push({
        id: randomUUID(),
        userId: wm.id,
        title: "New Replenishment Request",
        message: `${actor.name} (${ws.branches.find((b) => b.id === actor.branchId)?.name}) submitted replenishment request ${requestNumber}`,
        type: "info",
        read: false,
        relatedRequestId: id,
        relatedType: "replenishment",
        createdAt: now,
      });
    }

    return requestNumber;
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/g/storekeeper");
  redirect("/g/storekeeper");
}

export async function approveReplenishmentRequest(
  requestId: string,
  action: "approve" | "reject",
  notes: string,
  approvedLines: { productId: string; approvedQty: number }[]
) {
  const actor = await currentActor();
  if (!actor || actor.role !== "warehouse_manager") return { error: "Unauthorized" };

  for (const line of approvedLines) {
    if (!Number.isFinite(line.approvedQty) || line.approvedQty < 0 || line.approvedQty > 100_000) {
      return { error: "Approved quantity must be between 0 and 100,000." };
    }
  }

  const result = await updateWorkspace((ws) => {
    const req = ws.replenishmentRequests.find((r) => r.id === requestId);
    if (!req) return { error: "Request not found" };
    if (req.status !== "pending") return { error: "Request already processed" };

    for (const approved of approvedLines) {
      const line = req.lines.find((l) => l.productId === approved.productId);
      if (line && approved.approvedQty > line.requestedQty) {
        const product = ws.products.find((p) => p.id === approved.productId);
        return { error: `Approved quantity for ${product?.name ?? approved.productId} exceeds the requested quantity.` };
      }
    }

    const now = new Date().toISOString();
    req.approvedBy = actor.id;
    req.approvedAt = now;
    req.approvalNotes = notes || null;
    req.updatedAt = now;

    if (action === "reject") {
      req.status = "rejected";
    } else {
      req.lines = req.lines.map((l) => {
        const approved = approvedLines.find((a) => a.productId === l.productId);
        return { ...l, approvedQty: approved?.approvedQty ?? l.requestedQty };
      });

      const allFull = req.lines.every((l) => l.approvedQty === l.requestedQty);
      req.status = allFull ? "approved" : "partially_approved";
    }

    // Notify requesting storekeeper
    const storekeeper = ws.users.find((u) => u.id === req.storekeeperIdRequesting);
    if (storekeeper) {
      ws.notifications.push({
        id: randomUUID(),
        userId: storekeeper.id,
        title: action === "approve" ? "Replenishment Approved" : "Replenishment Rejected",
        message:
          action === "approve"
            ? `Replenishment request ${req.requestNumber} has been approved`
            : `Replenishment request ${req.requestNumber} was rejected: ${notes}`,
        type: action === "approve" ? "success" : "error",
        read: false,
        relatedRequestId: requestId,
        relatedType: "replenishment",
        createdAt: now,
      });
    }

    return { error: null };
  });

  if (!result.ok) return { error: result.error };
  if (result.value?.error) return { error: result.value.error };

  revalidatePath("/g/warehouse");
  return { ok: true };
}

export async function dispatchReplenishment(
  requestId: string,
  dispatchedLines: { productId: string; dispatchedQty: number }[]
) {
  const actor = await currentActor();
  if (!actor || actor.role !== "warehouse_manager") return { error: "Unauthorized" };

  for (const line of dispatchedLines) {
    if (!Number.isFinite(line.dispatchedQty) || line.dispatchedQty < 0) {
      return { error: "Dispatch quantity must be a non-negative number." };
    }
    if (line.dispatchedQty > 100_000) {
      return { error: "Dispatch quantity exceeds the maximum allowed per line (100,000)." };
    }
  }

  const result = await updateWorkspace((ws) => {
    const req = ws.replenishmentRequests.find((r) => r.id === requestId);
    if (!req) return { error: "Request not found" };
    if (!["approved", "partially_approved"].includes(req.status)) {
      return { error: "Request not approved" };
    }

    const now = new Date().toISOString();

    // Enforce dispatch cannot exceed approved qty per line
    for (const dispatched of dispatchedLines) {
      const line = req.lines.find((l) => l.productId === dispatched.productId);
      if (line && dispatched.dispatchedQty > (line.approvedQty ?? 0)) {
        const product = ws.products.find((p) => p.id === dispatched.productId);
        return { error: `Dispatch quantity for ${product?.name ?? dispatched.productId} exceeds approved quantity.` };
      }
    }

    // Check warehouse inventory
    for (const dispatched of dispatchedLines) {
      const bal = ws.inventoryBalances.find(
        (b) => b.productId === dispatched.productId && b.locationId === "warehouse"
      );
      if (!bal || bal.quantity < dispatched.dispatchedQty) {
        const product = ws.products.find((p) => p.id === dispatched.productId);
        return { error: `Insufficient warehouse stock for ${product?.name ?? dispatched.productId}` };
      }
    }

    // Deduct warehouse inventory
    for (const dispatched of dispatchedLines) {
      const bal = ws.inventoryBalances.find(
        (b) => b.productId === dispatched.productId && b.locationId === "warehouse"
      );
      if (bal) {
        const before = bal.quantity;
        bal.quantity -= dispatched.dispatchedQty;
        bal.updatedAt = now;

        ws.inventoryMovements.push({
          id: randomUUID(),
          productId: dispatched.productId,
          quantity: -dispatched.dispatchedQty,
          quantityBefore: before,
          quantityAfter: bal.quantity,
          movementType: "replenishment_dispatch",
          sourceLocationId: "warehouse",
          destinationLocationId: req.branchId,
          relatedRequestId: requestId,
          performedBy: actor.id,
          performedAt: now,
          notes: `Dispatched for ${req.requestNumber}`,
        });
      }
    }

    req.lines = req.lines.map((l) => {
      const dispatched = dispatchedLines.find((d) => d.productId === l.productId);
      return { ...l, dispatchedQty: dispatched?.dispatchedQty ?? 0 };
    });
    req.status = "dispatched";
    req.dispatchedBy = actor.id;
    req.dispatchedAt = now;
    req.updatedAt = now;

    // Notify storekeeper
    const storekeeper = ws.users.find((u) => u.id === req.storekeeperIdRequesting);
    if (storekeeper) {
      ws.notifications.push({
        id: randomUUID(),
        userId: storekeeper.id,
        title: "Shipment Dispatched",
        message: `Warehouse has dispatched items for replenishment request ${req.requestNumber}`,
        type: "info",
        read: false,
        relatedRequestId: requestId,
        relatedType: "replenishment",
        createdAt: now,
      });
    }

    return { error: null };
  });

  if (!result.ok) return { error: result.error };
  if (result.value?.error) return { error: result.value.error };

  revalidatePath("/g/warehouse");
  return { ok: true };
}

export async function receiveReplenishment(
  requestId: string,
  receivedLines: { productId: string; receivedQty: number }[]
) {
  const actor = await currentActor();
  if (!actor || actor.role !== "branch_storekeeper") return { error: "Unauthorized" };

  for (const line of receivedLines) {
    if (!Number.isFinite(line.receivedQty) || line.receivedQty < 0) {
      return { error: "Received quantity must be a non-negative number." };
    }
    if (line.receivedQty > 100_000) {
      return { error: "Received quantity exceeds the maximum allowed per line (100,000)." };
    }
  }

  const result = await updateWorkspace((ws) => {
    const req = ws.replenishmentRequests.find((r) => r.id === requestId);
    if (!req) return { error: "Request not found" };
    if (req.branchId !== actor.branchId) return { error: "Not your branch" };
    if (req.status !== "dispatched") return { error: "Items not dispatched yet" };

    // Received qty cannot exceed what was dispatched
    for (const received of receivedLines) {
      const line = req.lines.find((l) => l.productId === received.productId);
      if (line && received.receivedQty > (line.dispatchedQty ?? 0)) {
        const product = ws.products.find((p) => p.id === received.productId);
        return { error: `Received quantity for ${product?.name ?? received.productId} exceeds dispatched quantity.` };
      }
    }

    const now = new Date().toISOString();

    // Increase branch inventory
    for (const received of receivedLines) {
      let bal = ws.inventoryBalances.find(
        (b) => b.productId === received.productId && b.locationId === actor.branchId
      );
      if (!bal) {
        bal = {
          id: randomUUID(),
          productId: received.productId,
          locationId: actor.branchId!,
          locationType: "branch",
          quantity: 0,
          updatedAt: now,
        };
        ws.inventoryBalances.push(bal);
      }

      const before = bal.quantity;
      bal.quantity += received.receivedQty;
      bal.updatedAt = now;

      ws.inventoryMovements.push({
        id: randomUUID(),
        productId: received.productId,
        quantity: received.receivedQty,
        quantityBefore: before,
        quantityAfter: bal.quantity,
        movementType: "replenishment_receipt",
        sourceLocationId: "warehouse",
        destinationLocationId: actor.branchId!,
        relatedRequestId: requestId,
        performedBy: actor.id,
        performedAt: now,
        notes: `Received from ${req.requestNumber}`,
      });
    }

    req.lines = req.lines.map((l) => {
      const received = receivedLines.find((r) => r.productId === l.productId);
      return { ...l, receivedQty: received?.receivedQty ?? 0 };
    });

    const allReceived = req.lines.every((l) => l.receivedQty === l.dispatchedQty);
    req.status = allReceived ? "received" : "partially_received";
    req.receivedBy = actor.id;
    req.receivedAt = now;
    req.updatedAt = now;

    return { error: null };
  });

  if (!result.ok) return { error: result.error };
  if (result.value?.error) return { error: result.value.error };

  revalidatePath("/g/storekeeper");
  return { ok: true };
}

// ─── Admin: User Management ───────────────────────────────────────────────────

export async function createUser(formData: FormData) {
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return { error: "Unauthorized" };

  const name = String(formData.get("name") ?? "").trim();
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "") as GardeniaRole;
  const branchId = String(formData.get("branchId") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");

  if (!name || !employeeId || !email || !role || !password) {
    return { error: "All fields are required." };
  }

  const roles: GardeniaRole[] = [
    "admin",
    "salesperson",
    "branch_manager",
    "branch_storekeeper",
    "warehouse_manager",
    "management",
  ];
  if (!roles.includes(role)) return { error: "Unknown role." };

  const branchRoles: GardeniaRole[] = ["salesperson", "branch_manager", "branch_storekeeper"];
  const assignedBranch = branchRoles.includes(role) ? branchId : null;
  if (branchRoles.includes(role) && !assignedBranch) {
    return { error: "This role must be assigned to a branch." };
  }

  const passwordHash = await hashPassword(password);

  const result = await updateWorkspace((ws) => {
    if (ws.users.find((u) => u.employeeId === employeeId)) {
      return { error: "Employee ID already exists." };
    }
    if (ws.users.find((u) => u.email === email)) {
      return { error: "Email already exists." };
    }
    if (assignedBranch && !ws.branches.some((b) => b.id === assignedBranch && b.active)) {
      return { error: "Select an active branch." };
    }

    const id = `u-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    ws.users.push({
      id,
      employeeId,
      name,
      email,
      role,
      branchId: assignedBranch,
      active: true,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    return { error: null };
  });

  if (!result.ok) return { error: result.error };
  if (result.value?.error) return { error: result.value.error };

  revalidatePath("/g/admin/users");
  return { ok: true };
}

export async function updateUserStatus(userId: string, active: boolean) {
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return { error: "Unauthorized" };

  const result = await updateWorkspace((ws) => {
    const user = ws.users.find((u) => u.id === userId);
    if (!user) return { error: "User not found" };
    user.active = active;
    user.updatedAt = new Date().toISOString();
    return { error: null };
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/g/admin/users");
  return { ok: true };
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return { error: "Unauthorized" };
  if (!newPassword) return { error: "Password is required." };

  const passwordHash = await hashPassword(newPassword);

  const result = await updateWorkspace((ws) => {
    const user = ws.users.find((u) => u.id === userId);
    if (!user) return { error: "User not found" };
    user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();
    return { error: null };
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/g/admin/users");
  return { ok: true };
}

// ─── Admin: Product Management ────────────────────────────────────────────────

export async function createProduct(formData: FormData) {
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return { error: "Unauthorized" };

  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const minStockLevel = Number(formData.get("minStockLevel") ?? 0);
  const sellingPrice = Number(formData.get("sellingPrice") ?? 0);

  if (!sku || !name || !categoryId || !unit) {
    return { error: "SKU, name, category, and unit are required." };
  }
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0 || sellingPrice > 1_000_000) {
    return { error: "Selling price must be between 0 and 1,000,000." };
  }

  const result = await updateWorkspace((ws) => {
    if (ws.products.find((p) => p.sku === sku)) {
      return { error: "SKU already exists." };
    }

    const id = `p-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    ws.products.push({ id, sku, name, categoryId, unit, description, minStockLevel, sellingPrice, active: true, createdAt: now, updatedAt: now });

    // Create zero-balance records for all locations
    const locations = ["warehouse", ...ws.branches.map((b) => b.id)];
    for (const loc of locations) {
      ws.inventoryBalances.push({
        id: `bal-${id}-${loc}`,
        productId: id,
        locationId: loc,
        locationType: loc === "warehouse" ? "warehouse" : "branch",
        quantity: 0,
        updatedAt: now,
      });
    }

    return { error: null };
  });

  if (!result.ok) return { error: result.error };
  if (result.value?.error) return { error: result.value.error };

  revalidatePath("/g/admin/products");
  return { ok: true };
}

export async function updateProductPrice(productId: string, sellingPrice: number) {
  const actor = await currentActor();
  if (!actor || (actor.role !== "admin" && actor.role !== "management")) {
    return { error: "You are not allowed to change selling prices." };
  }
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0 || sellingPrice > 1_000_000) {
    return { error: "Selling price must be between 0 and 1,000,000." };
  }

  const result = await updateWorkspace((ws) => {
    const product = ws.products.find((item) => item.id === productId);
    if (!product) return { error: "Product not found" };
    product.sellingPrice = Math.round(sellingPrice * 100) / 100;
    product.updatedAt = new Date().toISOString();
    return { error: null };
  });
  if (!result.ok) return { error: result.error };
  if (result.value?.error) return { error: result.value.error };
  revalidatePath("/g/admin/products");
  revalidatePath("/g/management/prices");
  revalidatePath("/g/salesperson/catalog");
  return { ok: true };
}

export async function toggleProductStatus(productId: string, active: boolean) {
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return { error: "Unauthorized" };

  await updateWorkspace((ws) => {
    const p = ws.products.find((p) => p.id === productId);
    if (p) { p.active = active; p.updatedAt = new Date().toISOString(); }
  });

  revalidatePath("/g/admin/products");
  return { ok: true };
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function markNotificationRead(notificationId: string) {
  const actor = await currentActor();
  if (!actor) return;

  await updateWorkspace((ws) => {
    const n = ws.notifications.find((n) => n.id === notificationId && n.userId === actor.id);
    if (n) n.read = true;
  });

  revalidatePath("/g");
}

export async function markAllNotificationsRead() {
  const actor = await currentActor();
  if (!actor) return;

  await updateWorkspace((ws) => {
    for (const n of ws.notifications) {
      if (n.userId === actor.id) n.read = true;
    }
  });

  revalidatePath("/g");
}

// ─── Admin: Inventory Adjustment ─────────────────────────────────────────────

export async function adjustInventory(
  productId: string,
  locationId: string,
  newQuantity: number,
  reason: string
) {
  const actor = await currentActor();
  // Inventory quantities change only through issue and replenishment.
  // The system administrator does not adjust stock.
  if (!actor || actor.role === "admin") {
    return { error: "System administrators cannot adjust inventory quantities." };
  }
  if (actor.role !== "warehouse_manager") return { error: "Unauthorized" };
  if (locationId !== "warehouse") {
    return { error: "Only central warehouse stock can be adjusted here." };
  }
  if (!Number.isFinite(newQuantity) || newQuantity < 0 || newQuantity > 1_000_000) {
    return { error: "Quantity must be between 0 and 1,000,000." };
  }
  if (!reason) return { error: "Reason is required." };

  const result = await updateWorkspace((ws) => {
    let bal = ws.inventoryBalances.find(
      (b) => b.productId === productId && b.locationId === locationId
    );
    const now = new Date().toISOString();
    if (!bal) {
      bal = {
        id: randomUUID(),
        productId,
        locationId,
        locationType: locationId === "warehouse" ? "warehouse" : "branch",
        quantity: 0,
        updatedAt: now,
      };
      ws.inventoryBalances.push(bal);
    }

    const before = bal.quantity;
    bal.quantity = newQuantity;
    bal.updatedAt = now;

    ws.inventoryMovements.push({
      id: randomUUID(),
      productId,
      quantity: newQuantity - before,
      quantityBefore: before,
      quantityAfter: newQuantity,
      movementType: "adjustment",
      sourceLocationId: null,
      destinationLocationId: locationId,
      relatedRequestId: null,
      performedBy: actor.id,
      performedAt: now,
      notes: reason,
    });

    return { error: null };
  });

  if (!result.ok) return { error: result.error };
  return { ok: true };
}
