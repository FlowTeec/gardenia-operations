import { randomUUID } from "node:crypto";

import { CATALOG_PRICES } from "./catalog-prices";
import { lineValue, roundMoney } from "./money";
import type { GardeniaWorkspace, IssueTicket, SalesRequest } from "./types";

function priceFor(ws: GardeniaWorkspace, productId: string): number {
  const product = ws.products.find((p) => p.id === productId);
  if (product && typeof product.sellingPrice === "number" && Number.isFinite(product.sellingPrice)) {
    return product.sellingPrice;
  }
  return CATALOG_PRICES[productId] ?? 0;
}

function buildTicket(ws: GardeniaWorkspace, req: SalesRequest): IssueTicket {
  ws.counters.issueTicket += 1;
  const year = new Date(req.issuedAt ?? req.updatedAt).getFullYear();
  const ticketNumber = `IT-${year}-${String(ws.counters.issueTicket).padStart(4, "0")}`;
  const branch = ws.branches.find((b) => b.id === req.branchId);
  const salesperson = ws.users.find((u) => u.id === req.salespersonId);
  const storekeeper = ws.users.find((u) => u.id === req.issuedBy);
  const lines = req.lines.map((line) => {
    const product = ws.products.find((p) => p.id === line.productId);
    const issuedQty = line.issuedQty ?? 0;
    const unitPrice = line.unitPrice;
    return {
      productId: line.productId,
      sku: product?.sku ?? line.productId,
      productName: product?.name ?? line.productId,
      unit: product?.unit ?? "",
      requestedQty: line.requestedQty,
      approvedQty: line.approvedQty ?? line.requestedQty,
      issuedQty,
      unitPrice,
      lineTotal: lineValue(issuedQty, unitPrice),
    };
  });
  const id = `it-${randomUUID().slice(0, 8)}`;
  const ticket: IssueTicket = {
    id,
    ticketNumber,
    salesRequestId: req.id,
    requestNumber: req.requestNumber,
    branchId: req.branchId,
    branchName: branch?.name ?? req.branchId,
    customerName: req.customerName,
    salespersonId: req.salespersonId,
    salespersonName: salesperson?.name ?? req.salespersonId,
    storekeeperId: req.issuedBy ?? "",
    storekeeperName: storekeeper?.name ?? "Storekeeper",
    issuedAt: req.issuedAt ?? req.updatedAt,
    notes: req.issueNotes,
    lines,
    totalValue: roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0)),
    status: req.status === "partially_issued" ? "partially_issued" : "issued",
  };
  ws.issueTickets.push(ticket);
  req.issueTicketId = id;
  return ticket;
}

/** Fill fields added after the first release and backfill issue tickets for completed requests. */
export function normalizeWorkspace(ws: GardeniaWorkspace): { changed: boolean } {
  let changed = false;

  if (!Array.isArray(ws.issueTickets)) {
    ws.issueTickets = [];
    changed = true;
  }
  if (!ws.counters) {
    ws.counters = { salesRequest: ws.salesRequests.length, replenishment: ws.replenishmentRequests.length, issueTicket: 0 };
    changed = true;
  }
  if (typeof ws.counters.issueTicket !== "number") {
    ws.counters.issueTicket = ws.issueTickets.length;
    changed = true;
  }

  for (const product of ws.products) {
    if (typeof product.sellingPrice !== "number" || !Number.isFinite(product.sellingPrice)) {
      product.sellingPrice = CATALOG_PRICES[product.id] ?? 0;
      changed = true;
    }
  }

  for (const req of ws.salesRequests) {
    if (req.issueNotes === undefined) {
      req.issueNotes = null;
      changed = true;
    }
    if (req.issueTicketId === undefined) {
      req.issueTicketId = null;
      changed = true;
    }
    for (const line of req.lines) {
      if (typeof line.unitPrice !== "number" || !Number.isFinite(line.unitPrice)) {
        line.unitPrice = priceFor(ws, line.productId);
        changed = true;
      }
    }
  }

  for (const req of ws.salesRequests) {
    if (req.status !== "issued" && req.status !== "partially_issued") continue;
    const existing = ws.issueTickets.find((ticket) => ticket.salesRequestId === req.id);
    if (existing) {
      if (req.issueTicketId !== existing.id) {
        req.issueTicketId = existing.id;
        changed = true;
      }
      continue;
    }
    buildTicket(ws, req);
    changed = true;
  }

  return { changed };
}
