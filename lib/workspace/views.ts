import { addQty, cmpQty, isPositiveQty, isZeroQty, subQty } from "./decimal";
import { canReadPpeHistory, issuedOnRequest, ppeIndex, ppeReplacementDays } from "./ppe";
import { usageByLeaderMaterial } from "./usage";
import {
  assignedToSupervisor,
  displayName,
  finalApprovedQuantity,
  isReadyToPrepare,
  isWaitingToIssue,
  isZoneOpen,
  materialHasDependents,
  sortByZone,
  ZONE_CLOSED_MESSAGE,
  zoneRequestStatus,
} from "./rules";
import type {
  ActorSummary,
  AdminHome,
  DemoUser,
  InventoryPage,
  IssueBoard,
  ItemDecision,
  LedgerEntry,
  LedgerKind,
  MaterialHistory,
  MaterialRequest,
  MovementType,
  HistoryQuery,
  IssuedHistory,
  IssueTicket,
  OperationHome,
  OperationRecordLine,
  OperationReports,
  OperationReview,
  MovementRow,
  RequestCard,
  RequestDetail,
  RequestItem,
  RequestStatus,
  StockSignal,
  StoreDashboard,
  SupervisorHome,
  SupervisorReview,
  TeamLeaderHome,
  Ticket,
  Workspace,
  ZoneChangeRow,
  ZoneCode,
  ZoneControlRow,
} from "./types";
import { FACILITY_NAME, ZONE_CODES, ZONE_NAMES } from "./types";
import { dubaiDateString, formatDubaiDay, requestLabel, STATUS_LABEL, ticketLabel } from "@/lib/format";

function ppeGroups(rows: { employeeId: string; productName: string; quantity: string; unit: string }[] | undefined) {
  const groups: { employeeId: string; items: { name: string; quantity: string; unit: string }[] }[] = [];
  for (const row of rows ?? []) {
    let group = groups.find((item) => item.employeeId === row.employeeId);
    if (!group) {
      group = { employeeId: row.employeeId, items: [] };
      groups.push(group);
    }
    group.items.push({ name: row.productName, quantity: row.quantity, unit: row.unit });
  }
  return groups;
}

function ppeChecksFor(state: Workspace, request: MaterialRequest, asOf: string) {
  const index = ppeIndex(state, asOf);
  return (request.ppeAllocations ?? []).map((allocation) =>
    index.check(
      allocation.employeeId,
      allocation.materialId,
      allocation.quantity,
      allocation.unit,
      issuedOnRequest(request, allocation.materialId, allocation.employeeId),
    ),
  );
}

function releasedToStore(item: RequestItem) {
  return item.omDecision === "APPROVED" && isPositiveQty(finalApprovedQuantity(item));
}

function ticketPpe(state: Workspace, request: MaterialRequest) {
  const released = new Set(request.items.filter(releasedToStore).map((item) => item.materialId));
  return (request.ppeAllocations ?? []).filter((line) => released.has(line.materialId)).map((line) => {
    const issued = issuedOnRequest(request, line.materialId, line.employeeId);
    return {
      employeeId: line.employeeId,
      itemCode: line.itemCode,
      description: line.productName,
      unit: line.unit,
      quantity: line.quantity,
      issued: isPositiveQty(issued) ? issued : null,
    };
  });
}

function actorSummary(state: Workspace, actor: DemoUser): ActorSummary {
  return {
    id: actor.id,
    displayName: actor.displayName,
    role: actor.role,
    zoneCode: actor.zoneCode,
    zoneName: actor.zoneCode ? ZONE_NAMES[actor.zoneCode] : null,
    teamName: actor.teamName?.trim() ? actor.teamName.trim() : null,
  };
}

function zoneName(state: Workspace, code: ZoneCode) {
  return state.zones.find((zone) => zone.code === code)?.name ?? ZONE_NAMES[code];
}

function itemDecision(item: RequestItem): ItemDecision {
  if (item.decision === "APPROVED" || item.decision === "REJECTED" || item.decision === "PENDING") {
    return item.decision;
  }
  return "PENDING";
}

function operationDecisionOf(item: RequestItem): ItemDecision {
  if (item.omDecision === "APPROVED" || item.omDecision === "REJECTED") return item.omDecision;
  return "PENDING";
}

function approvedQuantityOf(item: RequestItem) {
  if (itemDecision(item) === "APPROVED") return item.approvedQuantity || "0";
  return "0";
}

function rejectedQuantityOf(item: RequestItem) {
  const decision = itemDecision(item);
  if (decision === "PENDING") return "0";
  return subQty(item.quantityRequested, approvedQuantityOf(item)) ?? "0";
}

function approvalSummary(request: MaterialRequest) {
  const pending = request.items.filter((item) => itemDecision(item) === "PENDING").length;
  const approved = request.items.filter((item) => itemDecision(item) === "APPROVED").length;
  const rejected = request.items.filter((item) => itemDecision(item) === "REJECTED").length;
  if (request.items.length === 0 || pending === request.items.length) return "All materials pending";
  if (approved === request.items.length) return "All materials approved";
  if (rejected === request.items.length) return "All materials rejected";
  const parts = [
    approved > 0 ? `${approved} approved` : "",
    rejected > 0 ? `${rejected} rejected` : "",
    pending > 0 ? `${pending} pending` : "",
  ].filter(Boolean);
  return parts.join(", ");
}

function bulkEligible(request: MaterialRequest) {
  return (
    request.status === "PENDING" &&
    request.items.length > 0 &&
    request.items.every((item) => itemDecision(item) === "PENDING")
  );
}

function totalByUnit(rows: { unit: string; quantity: string }[]) {
  const totals = new Map<string, string>();
  for (const row of rows) {
    if (!row.quantity || isZeroQty(row.quantity)) continue;
    const current = totals.get(row.unit) ?? "0";
    totals.set(row.unit, addQty(current, row.quantity) ?? current);
  }
  if (totals.size === 0) return "0";
  return [...totals.entries()].map(([unit, quantity]) => `${quantity} ${unit}`).join(", ");
}

function card(state: Workspace, requestId: string): RequestCard | null {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) return null;
  return {
    id: request.id,
    requestNo: requestLabel(request.requestNo),
    status: request.status,
    zoneCode: request.zoneCode,
    zoneName: zoneName(state, request.zoneCode),
    teamLeaderId: request.teamLeaderId,
    teamLeaderName: displayName(state, request.teamLeaderId),
    supervisorName: displayName(state, request.reviewedBy ?? request.supervisorId),
    requestedAt: request.createdAt,
    approvedAt: request.reviewedAt,
    rejectionReason: request.rejectionReason,
    materialCount: request.items.length,
    approvalSummary: approvalSummary(request),
    bulkEligible: bulkEligible(request),
    issuedAt: request.issuedAt ?? request.issueReceipts.at(-1)?.issuedAt ?? null,
    totalApproved: totalByUnit(
      request.items.map((item) => ({ unit: item.unit, quantity: approvedQuantityOf(item) })),
    ),
    totalIssued: totalByUnit(
      request.items.map((item) => ({ unit: item.unit, quantity: item.quantityIssued || "0" })),
    ),
    ticketNo: (state.tickets ?? []).find((ticket) => ticket.requestId === request.id)?.ticketNo ?? null,
    ticketState:
      request.status === "ISSUED"
        ? "final"
        : request.issueReceipts.length > 0
          ? "in-progress"
          : "none",
    items: request.items.map((item) => ({
      name: item.productName,
      quantity: item.quantityRequested,
      unit: item.unit,
      decision: itemDecision(item),
      approvedQuantity: approvedQuantityOf(item),
      finalQuantity: finalApprovedQuantity(item),
      issuedQuantity: item.quantityIssued || "0",
      rejectedQuantity: rejectedQuantityOf(item),
    })),
    ppe: ppeGroups(request.ppeAllocations),
    canPrint: request.status === "PREPARED" || request.status === "ISSUED",
  };
}

export function projectStoreDashboard(state: Workspace, actor: DemoUser): StoreDashboard {
  const pendingIssuance = state.requests.filter((request) =>
    isWaitingToIssue(request.status),
  ).length;
  return {
    actor: actorSummary(state, actor),
    pendingIssuance,
    prepared: state.requests.filter((request) => request.status === "PREPARED").length,
    issued: state.requests.filter((request) => request.status === "ISSUED").length,
  };
}

export function projectInventory(state: Workspace, actor: DemoUser): InventoryPage {
  const requestNos = new Map(state.requests.map((request) => [request.id, request.requestNo]));
  const movements: MovementRow[] = state.movements.map((movement) => ({
    id: movement.id,
    materialId: movement.materialId,
    type: movement.type,
    quantityChange: movement.quantityChange,
    quantityAfter: movement.quantityAfter,
    reason: movement.reason,
    performedByName: displayName(state, movement.performedBy),
    createdAt: movement.createdAt,
    requestNo: movement.requestId
      ? requestLabel(requestNos.get(movement.requestId) ?? "")
      : null,
  }));
  return {
    actor: actorSummary(state, actor),
    categories: [...(state.categories ?? [])]
      .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name))
      .map((category) => ({
        id: category.id,
        name: category.name,
        active: category.active,
        requiresEmployee: category.requiresEmployee,
      })),
    materials: state.materials
      .map((material) => ({
        id: material.id,
        itemCode: material.itemCode,
        productName: material.productName,
        activeIngredient: material.activeIngredient,
        unit: material.unit,
        beginningInventory: material.beginningInventory,
        newStock: material.newStock,
        out: material.out,
        currentStock: material.currentStock,
        categoryId: material.categoryId ?? null,
        categoryName: state.categories.find((category) => category.id === material.categoryId)?.name ?? null,
        requestable: material.requestable,
        active: material.active,
        updatedAt: material.updatedAt,
        updatedByName: displayName(state, material.updatedBy),
      }))
      .sort((left, right) => left.itemCode.localeCompare(right.itemCode)),
    movements,
  };
}

const LEDGER_LABEL: Record<LedgerKind, string> = {
  opening: "Opening Balance",
  receipt: "Stock Receipt",
  issue: "Stock Issue",
  adjustment: "Adjustment",
  reversal: "Reversal",
  status: "Status change",
};

export function ledgerKind(type: MovementType): LedgerKind {
  if (type === "OPENING") return "opening";
  if (type === "RECEIPT") return "receipt";
  if (type === "ISSUE") return "issue";
  if (type === "REVERSAL") return "reversal";
  if (type === "STATUS" || type === "AVAILABILITY") return "status";
  return "adjustment";
}

export function projectMaterialHistory(
  state: Workspace,
  actor: DemoUser,
  materialId: string,
  audience: "store" | "operations" = "store",
): MaterialHistory | null {
  const material = state.materials.find((item) => item.id === materialId);
  if (!material) return null;
  const reversed = new Set(
    state.movements
      .map((movement) => movement.reversesMovementId)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  const entries: LedgerEntry[] = state.movements
    .filter((movement) => movement.materialId === material.id)
    .map((movement) => {
      const request = movement.requestId
        ? state.requests.find((item) => item.id === movement.requestId) ?? null
        : null;
      const kind = ledgerKind(movement.type);
      const ticket = request
        ? state.tickets.find((item) => item.requestId === request.id) ?? null
        : null;
      return {
        id: movement.id,
        createdAt: movement.createdAt,
        receiptDate: movement.receiptDate ?? null,
        kind,
        typeLabel: LEDGER_LABEL[kind],
        quantityChange: movement.quantityChange,
        quantityBefore: movement.quantityBefore,
        quantityAfter: movement.quantityAfter,
        reference: movement.reference ?? (request ? requestLabel(request.requestNo) : null),
        supplier: movement.supplier ?? null,
        teamLeaderName: request ? displayName(state, request.teamLeaderId) : null,
        supervisorName: request ? displayName(state, request.supervisorId) : null,
        storeKeeperName: displayName(state, movement.performedBy),
        performedByName: displayName(state, movement.performedBy),
        reason: movement.reason,
        requestHref: request
          ? audience === "operations"
            ? `/operation-manager/requests/${request.id}`
            : `/store-keeper/requests/${request.id}`
          : null,
        ticketHref: ticket
          ? audience === "operations"
            ? `/operation-manager/tickets/${request?.id}`
            : `/store-keeper/requests/${request?.id}/ticket`
          : null,
        canReverse:
          audience === "store" &&
          (movement.type === "RECEIPT" ||
            movement.type === "ADJUSTMENT" ||
            movement.type === "DAMAGE" ||
            movement.type === "IMPORT") &&
          !reversed.has(movement.id),
      };
    })
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  const categoryName =
    state.categories.find((category) => category.id === material.categoryId)?.name ?? null;
  return {
    actor: actorSummary(state, actor),
    categories: [...(state.categories ?? [])]
      .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name))
      .map((category) => ({ id: category.id, name: category.name, active: category.active })),
    material: {
      id: material.id,
      itemCode: material.itemCode,
      productName: material.productName,
      activeIngredient: material.activeIngredient,
      unit: material.unit,
      beginningInventory: material.beginningInventory,
      newStock: material.newStock,
      out: material.out,
      currentStock: material.currentStock,
      categoryId: material.categoryId ?? null,
      categoryName,
      requestable: material.requestable,
      active: material.active,
      updatedAt: material.updatedAt,
      updatedByName: displayName(state, material.updatedBy),
      transactionCount: entries.length,
      canDelete: audience === "store" && !materialHasDependents(state, material.id),
    },
    entries,
  };
}

export function projectIssueBoard(
  state: Workspace,
  statuses: RequestStatus[],
  asOf = new Date().toISOString(),
): { zones: IssueBoard["zones"] } {
  const zones = sortByZone(state.zones).map((zone) => {
    const requests = state.requests
      .filter(
        (request) => request.zoneCode === zone.code && statuses.includes(request.status),
      )
      .sort((left, right) => left.requestNo - right.requestNo);
    const leaderIds = [...new Set(requests.map((request) => request.teamLeaderId))];
    return {
      code: zone.code,
      name: zone.name,
      supervisorName: displayName(state, zone.supervisorId),
      leaders: leaderIds
        .map((id) => ({
          id,
          name: displayName(state, id),
          requests: requests
            .filter((request) => request.teamLeaderId === id)
            .map((request) => {
              const built = card(state, request.id);
              if (!built) return null;
              const releasedIds = new Set(request.items.filter(releasedToStore).map((item) => item.materialId));
              const items = built.items.filter((item) => isPositiveQty(item.finalQuantity));
              if (items.length === 0) return null;
              const checks = ppeChecksFor(state, request, asOf).filter((check) => releasedIds.has(check.materialId));
              return {
                ...built,
                materialCount: items.length,
                items,
                ppe: ppeGroups((request.ppeAllocations ?? []).filter((row) => releasedIds.has(row.materialId))),
                ...(checks.length > 0 ? { ppeChecks: checks } : {}),
              };
            })
            .filter((item): item is RequestCard => item !== null),
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  });
  return { zones };
}

export function projectRequestDetail(
  state: Workspace,
  actor: DemoUser,
  requestId: string,
  asOf = new Date().toISOString(),
): RequestDetail | null {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) return null;
  const ppeChecks = canReadPpeHistory(actor) ? ppeChecksFor(state, request, asOf) : [];
  const released = request.items.filter(releasedToStore);
  const releasedIds = new Set(released.map((item) => item.materialId));
  return {
    actor: actorSummary(state, actor),
    id: request.id,
    requestNo: requestLabel(request.requestNo),
    ticketNo: ticketLabel(request.requestNo),
    status: request.status,
    zoneName: zoneName(state, request.zoneCode),
    teamLeaderName: displayName(state, request.teamLeaderId),
    supervisorName: displayName(state, request.reviewedBy ?? request.supervisorId),
    requestedAt: request.createdAt,
    approvedAt: request.reviewedAt,
    preparedAt: request.preparedAt,
    preparedByName: request.preparedBy ? displayName(state, request.preparedBy) : null,
    issuedAt: request.issuedAt,
    issuedByName: request.issuedBy ? displayName(state, request.issuedBy) : null,
    rejectionReason: request.rejectionReason,
    ppe: ppeGroups((request.ppeAllocations ?? []).filter((row) => releasedIds.has(row.materialId))),
    canPrepare: isReadyToPrepare(request.status),
    canIssue: request.status === "PREPARED",
    canPrint: request.status === "PREPARED" || request.status === "ISSUED",
    items: released.map((item) => {
      const material = state.materials.find((entry) => entry.id === item.materialId);
      const decision = itemDecision(item);
      const supervisorApproved = approvedQuantityOf(item);
      const operationApproved = finalApprovedQuantity(item);
      const issuable = isPositiveQty(operationApproved);
      return {
        id: item.id,
        itemCode: item.itemCode,
        productName: item.productName,
        unit: item.unit,
        quantityRequested: item.quantityRequested,
        supervisorApproved,
        operationApproved,
        approvedQuantity: operationApproved,
        rejectedQuantity: rejectedQuantityOf(item),
        decision,
        rejectionReason: item.rejectionReason,
        quantityIssued: item.quantityIssued,
        remaining: issuable ? subQty(operationApproved, item.quantityIssued) ?? "0" : "0",
        onHand: material?.currentStock ?? "0",
        issuable,
        ppeChecks: ppeChecks.filter((check) => check.materialId === item.materialId),
      };
    }),
    receipts: request.issueReceipts.map((receipt) => ({
      at: receipt.issuedAt,
      by: displayName(state, receipt.issuedBy),
      lines: receipt.lines.map((line) => {
        const item = request.items.find((entry) => entry.id === line.itemId);
        return {
          itemCode: item?.itemCode ?? "",
          quantity: line.quantity,
        };
      }),
    })),
  };
}

export function projectIssuedHistory(state: Workspace, actor: DemoUser): IssuedHistory {
  const rows = state.requests
    .filter((request) => request.status === "ISSUED")
    .sort((left, right) => (right.issuedAt ?? "").localeCompare(left.issuedAt ?? ""))
    .map((request) => ({
      id: request.id,
      requestNo: requestLabel(request.requestNo),
      ticketNo: ticketLabel(request.requestNo),
      zoneName: zoneName(state, request.zoneCode),
      teamLeaderName: displayName(state, request.teamLeaderId),
      storeKeeperName: displayName(state, request.issuedBy),
      issuedAt: request.issuedAt ?? "",
      lineCount: request.items.length,
    }));
  return { actor: actorSummary(state, actor), rows };
}

export function projectTeamLeader(
  state: Workspace,
  actor: DemoUser,
  asOf = new Date().toISOString(),
): TeamLeaderHome {
  const current = state.users.find((user) => user.id === actor.id) ?? actor;
  const zone = current.zoneCode
    ? state.zones.find((item) => item.code === current.zoneCode)
    : null;
  const assigned = Boolean(
    current.active &&
      current.role === "TEAM_LEADER" &&
      current.zoneCode &&
      current.supervisorId &&
      zone &&
      zone.supervisorId === current.supervisorId,
  );
  const zoneOpen = Boolean(assigned && current.zoneCode && isZoneOpen(state, current.zoneCode, asOf));
  const canSubmit = zoneOpen;
  const requestClosedMessage = assigned && !zoneOpen ? ZONE_CLOSED_MESSAGE : null;
  const peers = state.users
    .filter((user) => user.role === "TEAM_LEADER" && user.active)
    .map((user) => ({ id: user.id, displayName: user.displayName }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
  const categories = (state.categories ?? [])
    .filter((category) => category.active)
    .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name))
    .map((category) => ({
      id: category.id,
      name: category.name,
      requiresEmployee: category.requiresEmployee,
    }));
  const materials = state.materials
    .filter((material) => {
      if (!material.active || !material.requestable || !isPositiveQty(material.currentStock)) return false;
      if (!material.categoryId) return true;
      return categories.some((category) => category.id === material.categoryId);
    })
    .map((material) => ({
      id: material.id,
      itemCode: material.itemCode,
      productName: material.productName,
      unit: material.unit,
      activeIngredient: material.activeIngredient,
      categoryId: material.categoryId,
      requiresEmployee: categories.some(
        (category) => category.id === material.categoryId && category.requiresEmployee,
      ),
    }))
    .sort((left, right) => left.itemCode.localeCompare(right.itemCode));
  const requests = state.requests
    .filter((request) => request.teamLeaderId === actor.id)
    .sort((left, right) => right.requestNo - left.requestNo)
    .map((request) => ({
      id: request.id,
      requestNo: requestLabel(request.requestNo),
      status: request.status,
      requestedAt: request.createdAt,
      rejectionReason: request.rejectionReason,
      items: request.items.map((item) => ({
        name: item.productName,
        quantity: item.quantityRequested,
        unit: item.unit,
        decision: itemDecision(item),
        approvedQuantity: approvedQuantityOf(item),
        operationDecision: operationDecisionOf(item),
        operationApproved: finalApprovedQuantity(item),
        rejectionReason: item.rejectionReason,
      })),
      ppe: ppeGroups(request.ppeAllocations),
    }));
  return {
    actor: actorSummary(state, current),
    supervisorName: current.supervisorId ? displayName(state, current.supervisorId) : null,
    canSubmit,
    zoneOpen,
    requestClosedMessage,
    peers,
    categories,
    materials,
    requests,
  };
}

export function projectSupervisor(state: Workspace, actor: DemoUser): SupervisorHome {
  const current = state.users.find((user) => user.id === actor.id) ?? actor;
  const zone = state.zones.find((item) => item.supervisorId === current.id);
  const summary = actorSummary(state, current);
  const peers = state.users
    .filter((user) => user.role === "SUPERVISOR" && user.active)
    .map((user) => ({ id: user.id, displayName: user.displayName }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
  const leaderIds = new Set(
    state.users
      .filter((user) => user.role === "TEAM_LEADER" && user.supervisorId === current.id)
      .map((user) => user.id),
  );
  const approvedStatus = new Set<RequestStatus>([
    "PENDING_OPERATION_MANAGER",
    "PARTIALLY_APPROVED",
    "FULLY_APPROVED",
    "APPROVED",
    "OPERATION_MANAGER_APPROVED",
    "PREPARED",
  ]);
  const owns = (request: (typeof state.requests)[number]) =>
    assignedToSupervisor(state, current, request) || request.reviewedBy === current.id;
  const pendingRows = state.requests.filter(
    (request) => request.status === "PENDING" && assignedToSupervisor(state, current, request),
  );
  const approvedRows = state.requests.filter(
    (request) =>
      approvedStatus.has(request.status) &&
      request.issueReceipts.length === 0 &&
      owns(request),
  );
  const issuedRows = state.requests.filter((request) => {
    const ticket = (state.tickets ?? []).find((item) => item.requestId === request.id);
    const started = request.status === "ISSUED" || request.issueReceipts.length > 0;
    if (!started) return false;
    if (ticket) return ticket.supervisorId === current.id;
    return request.reviewedBy === current.id || assignedToSupervisor(state, current, request);
  });
  const rejectedRows = state.requests.filter(
    (request) => request.status === "REJECTED" && owns(request),
  );
  const toCards = (rows: typeof pendingRows) =>
    rows
      .sort((left, right) => right.requestNo - left.requestNo)
      .map((request) => card(state, request.id))
      .filter((item): item is RequestCard => item !== null);
  const tickets = (state.tickets ?? [])
    .filter((ticket) => ticket.supervisorId === current.id)
    .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt))
    .map((ticket) => ({
      requestId: ticket.requestId,
      ticketNo: ticket.ticketNo,
      requestNo: requestLabel(ticket.requestNo),
      zoneName: zoneName(state, ticket.zoneCode),
      teamLeaderName: displayName(state, ticket.teamLeaderId),
      storeKeeperName: displayName(state, ticket.storeKeeperId),
      issuedAt: ticket.issuedAt,
      lines: ticket.lines.map((line) => ({
        itemCode: line.itemCode,
        description: line.description,
        unit: line.unit,
        requested: line.requested,
        approved: line.approved || line.requested,
        issued: line.issued,
      })),
    }));
  return {
    actor: {
      ...summary,
      zoneCode: zone?.code ?? null,
      zoneName: zone?.name ?? null,
    },
    peers,
    leaders: state.users
      .filter((user) => leaderIds.has(user.id))
      .map((user) => ({ id: user.id, displayName: user.displayName }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    pending: toCards(pendingRows),
    approved: toCards(approvedRows),
    issued: toCards(issuedRows),
    rejected: toCards(rejectedRows),
    tickets,
  };
}

export function projectSupervisorReview(
  state: Workspace,
  actor: DemoUser,
  requestId: string,
): SupervisorReview | null {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) return null;
  const current = state.users.find((user) => user.id === actor.id) ?? actor;
  const owns = assignedToSupervisor(state, current, request);
  const historical = request.reviewedBy === current.id;
  if (!owns && !historical) return null;
  const summary = card(state, request.id);
  if (!summary) return null;
  return {
    actor: actorSummary(state, current),
    id: request.id,
    requestNo: summary.requestNo,
    teamLeaderName: summary.teamLeaderName,
    zoneName: summary.zoneName,
    requestedAt: request.createdAt,
    status: request.status,
    approvalSummary: summary.approvalSummary,
    bulkEligible: summary.bulkEligible,
    canDecide: owns && request.status === "PENDING",
    canOpenTicket: request.status === "ISSUED" || request.issueReceipts.length > 0,
    rejectionReason: request.rejectionReason,
    items: request.items.map((item) => {
      const material = state.materials.find((entry) => entry.id === item.materialId);
      const category = material?.categoryId
        ? state.categories.find((entry) => entry.id === material.categoryId)
        : null;
      return {
        id: item.id,
        itemCode: item.itemCode,
        productName: item.productName,
        categoryName: category?.name ?? "Unassigned",
        unit: item.unit,
        quantityRequested: item.quantityRequested,
        decision: itemDecision(item),
        approvedQuantity: approvedQuantityOf(item),
        rejectedQuantity: rejectedQuantityOf(item),
        rejectionReason: item.rejectionReason,
        quantityIssued: item.quantityIssued || "0",
        decidedAt: item.decidedAt,
        decidedByName: item.decidedBy ? displayName(state, item.decidedBy) : null,
        omDecision: operationDecisionOf(item),
        omApprovedQuantity: item.omDecision === "APPROVED" ? item.omApprovedQuantity || "0" : "0",
        omRejectionReason: item.omRejectionReason,
        allocations: (request.ppeAllocations ?? [])
          .filter((allocation) => allocation.materialId === item.materialId)
          .map((allocation) => ({
            employeeId: allocation.employeeId,
            quantity: allocation.quantity,
            unit: allocation.unit,
          })),
      };
    }),
    ppe: ppeGroups(request.ppeAllocations),
  };
}

export function projectAdmin(state: Workspace, actor: DemoUser): AdminHome {
  return {
    actor: actorSummary(state, actor),
    zones: sortByZone(state.zones).map((zone) => ({
      code: zone.code,
      name: zone.name,
      supervisorId: zone.supervisorId,
    })),
    supervisors: state.users
      .filter((user) => user.role === "SUPERVISOR" && user.active)
      .map((user) => ({ id: user.id, displayName: user.displayName }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    supervisorProfiles: state.users
      .filter((user) => user.role === "SUPERVISOR")
      .map((supervisor) => ({
        id: supervisor.id,
        displayName: supervisor.displayName,
        active: supervisor.active,
        zoneCode: state.zones.find((zone) => zone.supervisorId === supervisor.id)?.code ?? null,
        leaders: state.users
          .filter((user) => user.role === "TEAM_LEADER" && user.supervisorId === supervisor.id)
          .map((user) => ({
            id: user.id,
            displayName: user.displayName,
            active: user.active,
          }))
          .sort((left, right) => left.displayName.localeCompare(right.displayName)),
      }))
      .sort((left, right) => {
        const leftZone = left.zoneCode ? ZONE_NAMES[left.zoneCode] : "ZZZ";
        const rightZone = right.zoneCode ? ZONE_NAMES[right.zoneCode] : "ZZZ";
        return leftZone.localeCompare(rightZone) || left.displayName.localeCompare(right.displayName);
      }),
    unassignedLeaders: state.users
      .filter((user) => user.role === "TEAM_LEADER" && !user.supervisorId)
      .map((user) => ({ id: user.id, displayName: user.displayName, active: user.active }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    users: state.users
      .map((user) => {
        const credential = (state.credentials ?? []).find((item) => item.userId === user.id);
        return {
          id: user.id,
          displayName: user.displayName,
          role: user.role,
          active: user.active,
          zoneCode: user.zoneCode,
          supervisorId: user.supervisorId,
          teamName: user.teamName ?? null,
          employeeId: credential?.employeeId ?? "",
          email: credential?.email ?? "",
          hasPassword: Boolean(credential?.passwordHash),
        };
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    zoneChanges: zoneChangeRows(state).slice(0, 20),
  };
}

function ppeIntervalRows(state: Workspace) {
  const rows = Array.isArray(state.ppeIntervals) ? state.ppeIntervals : [];
  const cleaned = rows.filter(
    (row) => row && typeof row.id === "string" && Number.isInteger(row.days) && row.days >= 1 && row.days <= 3650,
  );
  if (cleaned.length === 0) {
    return [{ id: "ppe-interval-active", days: ppeReplacementDays(state), active: true }];
  }
  return cleaned.map((row) => ({ id: row.id, days: row.days, active: row.active === true }));
}

function ticketNotes(request: MaterialRequest | undefined) {
  if (!request) return null;
  const reasons = [
    ...new Set(
      request.items
        .flatMap((item) => [item.rejectionReason?.trim() ?? "", item.omRejectionReason?.trim() ?? ""])
        .filter((reason) => reason.length > 0),
    ),
  ];
  if (reasons.length > 0) return reasons.join(" ");
  const requestReason = request.rejectionReason?.trim() ?? "";
  return requestReason.length > 0 ? requestReason : null;
}

function ticketFromRecord(state: Workspace, record: IssueTicket, status: RequestStatus): Ticket {
  const request = state.requests.find((item) => item.id === record.requestId);
  return {
    facility: FACILITY_NAME,
    title: "MATERIAL ISSUE TICKET",
    ticketNo: record.ticketNo,
    requestNo: requestLabel(record.requestNo),
    zone: zoneName(state, record.zoneCode),
    teamLeader: displayName(state, record.teamLeaderId),
    supervisor: displayName(state, record.supervisorId),
    storeKeeper: displayName(state, record.storeKeeperId),
    issueAt: record.issuedAt,
    status,
    notes: ticketNotes(request),
    lines: record.lines.map((line) => {
      const item = request?.items.find(
        (entry) => entry.id === line.itemId || entry.itemCode === line.itemCode,
      );
      return {
        itemCode: line.itemCode,
        description: line.description,
        unit: line.unit,
        requested: line.requested,
        supervisorApproved: item ? approvedQuantityOf(item) : line.approved || line.requested,
        approved: line.approved || (item ? finalApprovedQuantity(item) : line.requested),
        issued: line.issued,
      };
    }),
    lineCount: record.lines.length,
    ppe: [],
  };
}

export function buildTicket(state: Workspace, requestId: string): Ticket | null {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) return null;
  const record = (state.tickets ?? []).find((item) => item.requestId === requestId);
  if (request.status === "ISSUED" && record) {
    return {
      ...ticketFromRecord(state, record, request.status),
      ppe: ticketPpe(state, request),
    };
  }
  if (request.status !== "PREPARED" && request.status !== "ISSUED") return null;
  const latest = request.issueReceipts[request.issueReceipts.length - 1];
  const storeKeeperId = request.issuedBy ?? latest?.issuedBy ?? request.preparedBy;
  return {
    facility: FACILITY_NAME,
    title: "MATERIAL ISSUE TICKET",
    ticketNo: ticketLabel(request.requestNo),
    requestNo: requestLabel(request.requestNo),
    zone: zoneName(state, request.zoneCode),
    teamLeader: displayName(state, request.teamLeaderId),
    supervisor: displayName(state, request.reviewedBy ?? request.supervisorId),
    storeKeeper: displayName(state, storeKeeperId),
    issueAt: request.issuedAt ?? latest?.issuedAt ?? null,
    status: request.status,
    notes: ticketNotes(request),
    lines: request.items.filter(releasedToStore).map((item) => ({
      itemCode: item.itemCode,
      description: item.productName,
      unit: item.unit,
      requested: item.quantityRequested,
      supervisorApproved: approvedQuantityOf(item),
      approved: finalApprovedQuantity(item),
      issued: item.quantityIssued,
    })),
    lineCount: request.items.filter(releasedToStore).length,
    ppe: ticketPpe(state, request),
  };
}

export function ticketForActor(state: Workspace, actor: DemoUser, requestId: string): Ticket | null {
  if (!actor.active) return null;
  if (actor.role === "STORE_KEEPER") return buildTicket(state, requestId);
  if (actor.role === "OPERATION_MANAGER") {
    const request = state.requests.find((item) => item.id === requestId);
    if (!request) return null;
    const started = request.status === "ISSUED" || request.issueReceipts.length > 0;
    if (!started) return null;
    return buildTicket(state, requestId);
  }
  if (actor.role !== "SUPERVISOR") return null;
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) return null;
  const record = (state.tickets ?? []).find((ticket) => ticket.requestId === requestId);
  if (record) {
    if (record.supervisorId !== actor.id) return null;
    return buildTicket(state, requestId);
  }
  const started = request.status === "ISSUED" || request.issueReceipts.length > 0;
  if (!started) return null;
  const allowed =
    request.reviewedBy === actor.id || assignedToSupervisor(state, actor, request);
  if (!allowed) return null;
  return buildTicket(state, requestId);
}

export function stockSignal(active: boolean, current: string, needed: string): StockSignal {
  if (!active) return "Inactive Material";
  const hasNeed = isPositiveQty(needed);
  const hasStock = isPositiveQty(current);
  if (hasNeed && (!hasStock || cmpQty(current, needed) < 0)) return "Insufficient Stock";
  if (!hasStock) return "Low Stock";
  if (hasNeed && cmpQty(current, needed) === 0) return "Low Stock";
  return "Available";
}

function latestReceipt(state: Workspace, materialId: string) {
  const receipts = state.movements
    .filter((movement) => movement.materialId === materialId && movement.type === "RECEIPT")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const latest = receipts[0];
  if (!latest) return { date: null, quantity: null };
  return {
    date: latest.receiptDate ?? latest.createdAt,
    quantity: latest.quantityChange,
  };
}

function operationCard(state: Workspace, request: MaterialRequest) {
  const supervisorOpen = request.items.some((item) => itemDecision(item) === "PENDING");
  const operationOpen = request.items.some(
    (item) => itemDecision(item) === "APPROVED" && item.omDecision === "PENDING",
  );
  return {
    id: request.id,
    requestNo: requestLabel(request.requestNo),
    status: request.status,
    teamLeaderName: displayName(state, request.teamLeaderId),
    supervisorName: displayName(state, request.reviewedBy ?? request.supervisorId),
    zoneName: zoneName(state, request.zoneCode),
    requestedAt: request.createdAt,
    materialCount: request.items.length,
    supervisorStatus: supervisorOpen ? "Pending supervisor" : approvalSummary(request),
    operationStatus:
      request.status === "REJECTED"
        ? "Rejected"
        : operationOpen
          ? "Pending operation manager"
          : request.items.some((item) => item.omDecision === "APPROVED")
            ? "Approved"
            : "Not started",
    ticketState:
      request.status === "ISSUED"
        ? "final" as const
        : request.issueReceipts.length > 0
          ? "in-progress" as const
          : "none" as const,
  };
}

const STORE_READY = new Set<RequestStatus>([
  "APPROVED",
  "FULLY_APPROVED",
  "PARTIALLY_APPROVED",
  "OPERATION_MANAGER_APPROVED",
]);

const FINISHED = new Set<RequestStatus>(["ISSUED", "REJECTED"]);

function zoneChangeRows(state: Workspace): ZoneChangeRow[] {
  return [...(state.zoneRequestChanges ?? [])]
    .sort((left, right) => right.changedAt.localeCompare(left.changedAt))
    .map((change) => ({
      id: change.id,
      zoneCode: change.zoneCode,
      zoneName: zoneName(state, change.zoneCode),
      requestDate: change.requestDate,
      previousStatus: change.previousStatus,
      newStatus: change.newStatus,
      changedByName: displayName(state, change.changedBy),
      changedAt: change.changedAt,
      note: change.note,
    }));
}

function zoneControlRows(state: Workspace, asOf: string): ZoneControlRow[] {
  return ZONE_CODES.map((code) => {
    const requestDate = dubaiDateString(asOf);
    const row = (state.zoneRequestDays ?? []).find(
      (item) => item.zoneCode === code && item.requestDate === requestDate,
    );
    return {
      code,
      name: zoneName(state, code),
      status: zoneRequestStatus(state, code, asOf),
      updatedByName: row ? displayName(state, row.updatedBy) : null,
      updatedAt: row?.updatedAt ?? null,
      note: row?.note ?? null,
    };
  });
}

function operationRecords(state: Workspace): OperationRecordLine[] {
  return state.requests.flatMap((request) => {
    const issued = request.items.some((item) => isPositiveQty(item.quantityIssued));
    const latestReceipt = [...(request.issueReceipts ?? [])].sort((left, right) =>
      right.issuedAt.localeCompare(left.issuedAt),
    )[0];
    return request.items.map((item) => {
      const supervisorApproved = approvedQuantityOf(item);
      const rejected =
        item.omDecision === "REJECTED" ? supervisorApproved : "0";
      return {
        key: `${request.id}:${item.id}`,
        requestId: request.id,
        requestNo: requestLabel(request.requestNo),
        itemId: item.id,
        zoneCode: request.zoneCode,
        zoneName: zoneName(state, request.zoneCode),
        teamLeaderId: request.teamLeaderId,
        teamLeaderName: displayName(state, request.teamLeaderId),
        supervisorId: request.reviewedBy ?? request.supervisorId,
        supervisorName: displayName(state, request.reviewedBy ?? request.supervisorId),
        requestedAt: request.createdAt,
        requestDate: dubaiDateString(request.createdAt),
        itemCode: item.itemCode,
        productName: item.productName,
        unit: item.unit,
        quantityRequested: item.quantityRequested,
        supervisorApproved,
        omApprovedQuantity: item.omDecision === "APPROVED" ? item.omApprovedQuantity || "0" : "0",
        rejectedQuantity: rejected,
        quantityIssued: item.quantityIssued || "0",
        omDecision: operationDecisionOf(item),
        omRejectionReason: item.omRejectionReason,
        decidedByName: item.omDecidedBy ? displayName(state, item.omDecidedBy) : null,
        decidedAt: item.omDecidedAt,
        status: request.status,
        statusLabel: STATUS_LABEL[request.status],
        ticketNo: issued || request.status === "ISSUED" ? ticketLabel(request.requestNo) : null,
        issuedAt: request.issuedAt ?? latestReceipt?.issuedAt ?? null,
      };
    });
  });
}

export function filterOperationRecords(rows: OperationRecordLine[], query: HistoryQuery) {
  const material = query.material.trim().toLowerCase();
  const requestId = query.requestId.trim().toLowerCase();
  return rows.filter((row) => {
    if (query.date && row.requestDate !== query.date) return false;
    if (query.zone && query.zone !== "all" && row.zoneCode !== query.zone) return false;
    if (query.teamLeaderId && query.teamLeaderId !== "all" && row.teamLeaderId !== query.teamLeaderId) {
      return false;
    }
    if (query.supervisorId && query.supervisorId !== "all" && row.supervisorId !== query.supervisorId) {
      return false;
    }
    if (query.status && query.status !== "all" && row.status !== query.status) return false;
    if (requestId && !row.requestNo.toLowerCase().includes(requestId)) return false;
    if (
      material &&
      !`${row.itemCode} ${row.productName}`.toLowerCase().includes(material)
    ) {
      return false;
    }
    return true;
  });
}

export function projectOperationHome(state: Workspace, actor: DemoUser, asOf = new Date().toISOString()): OperationHome {
  const current = state.users.find((user) => user.id === actor.id) ?? actor;
  const peers = state.users
    .filter((user) => user.role === "OPERATION_MANAGER" && user.active)
    .map((user) => ({ id: user.id, displayName: user.displayName }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
  const pendingSupervisor = state.requests.filter((request) => request.status === "PENDING");
  const pendingOperation = state.requests.filter((request) => request.status === "PENDING_OPERATION_MANAGER");
  const approvedRows = state.requests.filter((request) => STORE_READY.has(request.status));
  const waitingStore = state.requests.filter(
    (request) => STORE_READY.has(request.status) || request.status === "PREPARED",
  );
  const issuedRows = state.requests.filter((request) => request.status === "ISSUED");
  const rejectedRows = state.requests.filter((request) => request.status === "REJECTED");
  const demand = new Map<string, string>();
  for (const request of state.requests) {
    if (request.status !== "PENDING" && request.status !== "PENDING_OPERATION_MANAGER") continue;
    for (const item of request.items) {
      const needed = request.status === "PENDING" ? item.quantityRequested : approvedQuantityOf(item);
      if (!isPositiveQty(needed)) continue;
      demand.set(item.materialId, addQty(demand.get(item.materialId) ?? "0", needed) ?? needed);
    }
  }
  const alerts = state.materials
    .map((material) => {
      const needed = demand.get(material.id) ?? "0";
      const signal = stockSignal(material.active, material.currentStock, needed);
      const listed =
        (!material.active && isPositiveQty(needed)) ||
        !isPositiveQty(material.currentStock) ||
        signal === "Insufficient Stock" ||
        signal === "Low Stock";
      if (!listed || signal === "Available") return null;
      return {
        itemCode: material.itemCode,
        productName: material.productName,
        unit: material.unit,
        currentStock: material.currentStock,
        signal,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => left.itemCode.localeCompare(right.itemCode));
  const toCards = (rows: MaterialRequest[]) =>
    rows
      .sort((left, right) => right.requestNo - left.requestNo)
      .map((request) => operationCard(state, request));
  const today = dubaiDateString(asOf);
  const records = operationRecords(state);
  const approvedLines = records.filter((line) => line.omDecision === "APPROVED");
  const rejectedLines = records.filter((line) => line.omDecision === "REJECTED");
  const zones = zoneControlRows(state, asOf);
  const usage = usageByLeaderMaterial(state, asOf);
  const ppe = ppeIndex(state, asOf);
  const queue = pendingOperation
    .sort((left, right) => right.requestNo - left.requestNo)
    .map((request) => {
      const teamLeaderName = displayName(state, request.teamLeaderId);
      const supervisorName = displayName(state, request.reviewedBy ?? request.supervisorId);
      const zone = zoneName(state, request.zoneCode);
      const lines = request.items.flatMap((item) => {
        if (itemDecision(item) !== "APPROVED" || item.omDecision === "APPROVED" || item.omDecision === "REJECTED") {
          return [];
        }
        const material = state.materials.find((entry) => entry.id === item.materialId);
        const active = material?.active ?? false;
        const currentStock = material?.currentStock ?? "0";
        const supervisorApproved = approvedQuantityOf(item);
        return [{
          requestId: request.id,
          requestNo: requestLabel(request.requestNo),
          itemId: item.id,
          teamLeaderName,
          supervisorName,
          zoneCode: request.zoneCode,
          zoneName: zone,
          itemCode: item.itemCode,
          productName: item.productName,
          unit: item.unit,
          quantityRequested: item.quantityRequested,
          supervisorApproved,
          currentStock,
          availableStock: currentStock,
          active,
          signal: stockSignal(active, currentStock, supervisorApproved),
          approvalStatus: "Pending operation manager" as const,
          selectable: active,
          hasPpe: (request.ppeAllocations ?? []).some((allocation) => allocation.materialId === item.materialId),
          ppeChecks: (request.ppeAllocations ?? [])
            .filter((allocation) => allocation.materialId === item.materialId)
            .map((allocation) =>
              ppe.check(
                allocation.employeeId,
                allocation.materialId,
                allocation.quantity,
                allocation.unit,
                issuedOnRequest(request, allocation.materialId, allocation.employeeId),
              ),
            ),
          usage: usage.for(request.teamLeaderId, item.materialId, supervisorApproved),
        }];
      });
      return {
        requestId: request.id,
        requestNo: requestLabel(request.requestNo),
        teamLeaderName,
        supervisorName,
        zoneCode: request.zoneCode,
        zoneName: zone,
        requestedAt: request.createdAt,
        lines,
      };
    })
    .filter((group) => group.lines.length > 0);
  return {
    actor: actorSummary(state, current),
    peers,
    pendingSupervisor: pendingSupervisor.length,
    pendingOperation: pendingOperation.length,
    pendingMaterials: queue.reduce((sum, group) => sum + group.lines.length, 0),
    approvedToday: approvedLines.filter((line) => line.decidedAt && dubaiDateString(line.decidedAt) === today).length,
    rejectedToday: rejectedLines.filter((line) => line.decidedAt && dubaiDateString(line.decidedAt) === today).length,
    inProgress: state.requests.filter((request) => !FINISHED.has(request.status)).length,
    approved: approvedRows.length,
    waitingStore: waitingStore.length,
    issued: issuedRows.length,
    lowStock: alerts.length,
    today: formatDubaiDay(asOf),
    openZoneCodes: zones.filter((zone) => zone.status === "OPEN").map((zone) => zone.code),
    closedZoneCodes: zones.filter((zone) => zone.status === "CLOSED").map((zone) => zone.code),
    zones,
    zoneChanges: zoneChangeRows(state).slice(0, 30),
    pending: toCards(pendingOperation),
    queue,
    approvedRequests: toCards([...approvedRows, ...state.requests.filter((request) => request.status === "PREPARED")]),
    approvedLines,
    rejected: toCards(rejectedRows),
    rejectedLines,
    history: records,
    issuedRequests: toCards(issuedRows),
    inProgressRequests: toCards(state.requests.filter((request) => !FINISHED.has(request.status))),
    alerts,
    ppeReplacementDays: ppeReplacementDays(state),
    ppeIntervals: ppeIntervalRows(state),
  };
}

export function projectOperationReports(
  state: Workspace,
  actor: DemoUser,
  asOf = new Date().toISOString(),
): OperationReports | null {
  if (actor.role !== "OPERATION_MANAGER" || !actor.active) return null;
  const byMaterial = new Map<string, { itemCode: string; productName: string; unit: string; issued: string }>();
  const byLeader = new Map<string, { itemCode: string; productName: string; unit: string; teamLeaderName: string; issued: string }>();
  for (const request of state.requests) {
    const teamLeaderName = displayName(state, request.teamLeaderId);
    for (const receipt of request.issueReceipts ?? []) {
      for (const line of receipt.lines) {
        if (!isPositiveQty(line.quantity)) continue;
        const item = request.items.find((entry) => entry.id === line.itemId);
        if (!item) continue;
        const materialRow = byMaterial.get(item.materialId) ?? {
          itemCode: item.itemCode,
          productName: item.productName,
          unit: item.unit,
          issued: "0",
        };
        materialRow.issued = addQty(materialRow.issued, line.quantity) ?? materialRow.issued;
        byMaterial.set(item.materialId, materialRow);
        const leaderKey = `${request.teamLeaderId}\0${item.materialId}`;
        const leaderRow = byLeader.get(leaderKey) ?? {
          itemCode: item.itemCode,
          productName: item.productName,
          unit: item.unit,
          teamLeaderName,
          issued: "0",
        };
        leaderRow.issued = addQty(leaderRow.issued, line.quantity) ?? leaderRow.issued;
        byLeader.set(leaderKey, leaderRow);
      }
    }
  }
  const zones = zoneControlRows(state, asOf);
  const ppe = ppeIndex(state, asOf);
  const counts = new Map<string, number>();
  for (const request of state.requests) {
    const label = STATUS_LABEL[request.status] ?? request.status;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let supervisorRejections = 0;
  let operationRejections = 0;
  for (const request of state.requests) {
    for (const item of request.items) {
      if (item.decision === "REJECTED") supervisorRejections += 1;
      if (item.omDecision === "REJECTED") operationRejections += 1;
    }
  }
  return {
    actor: actorSummary(state, actor),
    consumption: [...byMaterial.values()]
      .sort((left, right) => left.itemCode.localeCompare(right.itemCode))
      .map((row) => ({ ...row, teamLeaderName: null })),
    leaders: [...byLeader.values()].sort(
      (left, right) =>
        left.teamLeaderName.localeCompare(right.teamLeaderName) || left.itemCode.localeCompare(right.itemCode),
    ),
    ppe: ppe.records((id) => displayName(state, id)),
    requestCounts: [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    zones: zones.map((zone) => {
      const rows = state.requests.filter((request) => request.zoneCode === zone.code);
      return {
        code: zone.code,
        name: zone.name,
        status: zone.status,
        pending: rows.filter((request) => request.status === "PENDING" || request.status === "PENDING_OPERATION_MANAGER").length,
        inProgress: rows.filter((request) => !FINISHED.has(request.status)).length,
        rejected: rows.filter((request) => request.status === "REJECTED").length,
        issued: rows.filter((request) => request.status === "ISSUED").length,
      };
    }),
    supervisorRejections,
    operationRejections,
    ppeReplacementDays: ppe.intervalDays,
  };
}

export function projectOperationReview(
  state: Workspace,
  actor: DemoUser,
  requestId: string,
  asOf = new Date().toISOString(),
): OperationReview | null {
  if (actor.role !== "OPERATION_MANAGER" || !actor.active) return null;
  const request = state.requests.find((item) => item.id === requestId);
  if (!request || request.status === "PENDING") return null;
  const usage = usageByLeaderMaterial(state, asOf);
  const ppe = ppeIndex(state, asOf);
  const items = request.items.map((item) => {
    const material = state.materials.find((entry) => entry.id === item.materialId);
    const category = material?.categoryId
      ? state.categories.find((entry) => entry.id === material.categoryId)
      : null;
    const needed = itemDecision(item) === "APPROVED" ? approvedQuantityOf(item) : item.quantityRequested;
    const receipt = material ? latestReceipt(state, material.id) : { date: null, quantity: null };
    const active = material?.active ?? false;
    const currentStock = material?.currentStock ?? "0";
    return {
      id: item.id,
      itemCode: item.itemCode,
      productName: item.productName,
      categoryName: category?.name ?? "Unassigned",
      unit: item.unit,
      quantityRequested: item.quantityRequested,
      supervisorApproved: approvedQuantityOf(item),
      supervisorDecision: itemDecision(item),
      supervisorReason: item.rejectionReason,
      supervisorName: item.decidedBy ? displayName(state, item.decidedBy) : null,
      supervisorDecidedAt: item.decidedAt,
      omDecision: operationDecisionOf(item),
      omApprovedQuantity: item.omApprovedQuantity || "0",
      omRejectionReason: item.omRejectionReason,
      currentStock,
      availableStock: currentStock,
      active,
      signal: stockSignal(active, currentStock, needed),
      latestReceiptDate: receipt.date,
      latestReceiptQuantity: receipt.quantity,
      allocations: (request.ppeAllocations ?? [])
        .filter((allocation) => allocation.materialId === item.materialId)
        .map((allocation) =>
          ppe.check(
            allocation.employeeId,
            allocation.materialId,
            allocation.quantity,
            allocation.unit,
            issuedOnRequest(request, allocation.materialId, allocation.employeeId),
          ),
        ),
      usage: usage.for(request.teamLeaderId, item.materialId, needed),
    };
  });
  const history = (state.approvals ?? [])
    .filter((record) => record.requestId === request.id)
    .map((record) => {
      const item = request.items.find((entry) => entry.id === record.itemId);
      return {
        id: record.id,
        stage: record.stage === "OPERATION_MANAGER" ? "OPERATION_MANAGER" as const : "SUPERVISOR" as const,
        actorName: displayName(state, record.supervisorId),
        decision: record.decision,
        quantityRequested: record.quantityRequested,
        approvedQuantity: record.approvedQuantity,
        rejectionReason: record.rejectionReason,
        createdAt: record.createdAt,
        itemCode: item?.itemCode ?? "",
        productName: item?.productName ?? "",
      };
    })
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return {
    actor: actorSummary(state, actor),
    id: request.id,
    requestNo: requestLabel(request.requestNo),
    teamLeaderName: displayName(state, request.teamLeaderId),
    supervisorName: displayName(state, request.reviewedBy ?? request.supervisorId),
    zoneName: zoneName(state, request.zoneCode),
    requestedAt: request.createdAt,
    status: request.status,
    canDecide: request.status === "PENDING_OPERATION_MANAGER" || request.status === "OPERATION_MANAGER_APPROVED" || request.status === "PARTIALLY_APPROVED" || (
      request.status === "REJECTED" && request.items.some((item) => itemDecision(item) === "APPROVED")
    ),
    canOpenTicket: request.status === "ISSUED" || request.issueReceipts.length > 0,
    rejectionReason: request.rejectionReason,
    items,
    history,
    ppe: ppeGroups(request.ppeAllocations),
  };
}

export function stockSnapshot(state: Workspace) {
  return state.materials.map((material) => ({
    itemCode: material.itemCode,
    currentStock: material.currentStock,
  }));
}
