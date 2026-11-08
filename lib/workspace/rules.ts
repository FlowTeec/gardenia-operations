import { dubaiDateString, ticketLabel } from "@/lib/format";
import { distributeIssuedPpe } from "./ppe";

import { normalizeItemCode } from "./item-code";

import { USER_IDS } from "./seed";

import {
  addQty,
  cmpQty,
  isPositiveQty,
  isZeroQty,
  parseQty,
  signedDiff,
  subQty,
} from "./decimal";
import type {
  DemoUser,
  IssueTicket,
  ItemApproval,
  Material,
  MaterialCategory,
  MaterialRequest,
  MovementType,
  Mutation,
  OperationBulkResult,
  PpeReplacementInterval,
  RequestItem,
  RequestStatus,
  Role,
  Workspace,
  ZoneAvailability,
  ZoneCode,
  ZoneRequestChange,
  ZoneRequestDay,
} from "./types";
import { ZONE_CODES, ZONE_NAMES } from "./types";

const READY_TO_PREPARE: RequestStatus[] = [
  "APPROVED",
  "FULLY_APPROVED",
  "PARTIALLY_APPROVED",
  "OPERATION_MANAGER_APPROVED",
];

export function isReadyToPrepare(status: RequestStatus) {
  return READY_TO_PREPARE.includes(status);
}

export function isWaitingToIssue(status: RequestStatus) {
  return isReadyToPrepare(status) || status === "PREPARED";
}

export const ZONE_CLOSED_MESSAGE =
  "Material requests are currently closed for your Zone. Please contact the Operation Manager/Supervisor.";

const REQUEST_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function zoneRequestStatus(state: Workspace, zoneCode: ZoneCode, at: string): ZoneAvailability {
  const requestDate = dubaiDateString(at);
  const row = (state.zoneRequestDays ?? []).find(
    (item) => item.zoneCode === zoneCode && item.requestDate === requestDate,
  );
  return row?.status === "OPEN" ? "OPEN" : "CLOSED";
}

export function isZoneOpen(state: Workspace, zoneCode: ZoneCode, at: string) {
  return zoneRequestStatus(state, zoneCode, at) === "OPEN";
}

export function setZoneRequestStatus(
  state: Workspace,
  actor: DemoUser,
  input: { zoneCode: ZoneCode; status: ZoneAvailability; note?: string | null },
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "OPERATION_MANAGER");
  if (denied) return fail(denied);
  if (!ZONE_CODES.includes(input.zoneCode)) return fail("That zone does not exist.");
  if (input.status !== "OPEN" && input.status !== "CLOSED") return fail("Choose open or closed.");
  if (!zoneByCode(state, input.zoneCode)) return fail("That zone does not exist.");
  const requestDate = dubaiDateString(at);
  if (!REQUEST_DATE.test(requestDate)) return fail("The request date is not valid.");
  const rawNote = (input.note ?? "").trim();
  if (rawNote.length > 200) return fail("The note is too long.");
  const note = rawNote.length > 0 ? rawNote : null;
  const current = (state.zoneRequestDays ?? []).find(
    (item) => item.zoneCode === input.zoneCode && item.requestDate === requestDate,
  );
  const previous: ZoneAvailability = current?.status === "OPEN" ? "OPEN" : "CLOSED";
  if (previous === input.status) return ok(state, null, true);

  const next = copy(state);
  if (!Array.isArray(next.zoneRequestDays)) next.zoneRequestDays = [];
  if (!Array.isArray(next.zoneRequestChanges)) next.zoneRequestChanges = [];
  const row = next.zoneRequestDays.find(
    (item) => item.zoneCode === input.zoneCode && item.requestDate === requestDate,
  );
  if (row) {
    row.status = input.status;
    row.updatedBy = actor.id;
    row.updatedAt = at;
    row.note = note;
  } else {
    next.zoneRequestDays.push({
      id: crypto.randomUUID(),
      zoneCode: input.zoneCode,
      requestDate,
      status: input.status,
      updatedBy: actor.id,
      updatedAt: at,
      createdAt: at,
      note,
    });
  }
  next.zoneRequestChanges.push({
    id: crypto.randomUUID(),
    zoneCode: input.zoneCode,
    requestDate,
    previousStatus: previous,
    newStatus: input.status,
    changedBy: actor.id,
    changedAt: at,
    note,
  });
  return ok(next, null);
}

export function sortByZone<T extends { code: ZoneCode }>(rows: T[]) {
  return [...rows].sort(
    (left, right) => ZONE_CODES.indexOf(left.code) - ZONE_CODES.indexOf(right.code),
  );
}

function fail(error: string): Mutation<never> {
  return { ok: false, error };
}

function ok<T>(state: Workspace, data: T, replayed = false): Mutation<T> {
  return { ok: true, state, replayed, data };
}

function copy(state: Workspace) {
  return structuredClone(state);
}

function userById(state: Workspace, id: string) {
  return state.users.find((user) => user.id === id) ?? null;
}

function nameOf(state: Workspace, id: string | null) {
  if (!id) return "—";
  return userById(state, id)?.displayName ?? "Unknown user";
}

export function displayName(state: Workspace, id: string | null) {
  return nameOf(state, id);
}

export function canChangeInventory(actor: { role: Role; active: boolean } | null) {
  return !!actor && actor.active && actor.role === "STORE_KEEPER";
}

export function canReadInventory(actor: { role: Role; active: boolean } | null) {
  return !!actor && actor.active && (actor.role === "STORE_KEEPER" || actor.role === "OPERATION_MANAGER");
}

export function cleanTeamName(value: string | null | undefined): { name: string | null } | { error: string } {
  if (value == null) return { name: null };
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return { name: null };
  if (text.length > 80) return { error: "Enter a team name of at most 80 characters." };
  return { name: text };
}

function requireActive(actor: DemoUser, role: Role) {
  if (!actor.active) return "This user is inactive.";
  if (actor.role !== role) return "You do not have permission for this action.";
  return null;
}

function reasonOf(reason: string) {
  const text = reason.trim();
  if (!text) return null;
  if (text.length > 500) return null;
  return text;
}

function requiredReason(reason: string): { text: string } | { error: string } {
  const text = reason.trim();
  if (!text) return { error: "A rejection needs a reason." };
  if (text.length > 500) return { error: "The rejection reason is too long." };
  return { text };
}

function optionalReason(reason: string): { text: string | null } | { error: string } {
  const text = reason.trim();
  if (!text) return { text: null };
  if (text.length > 500) return { error: "The rejection reason is too long." };
  return { text };
}

function materialById(state: Workspace, id: string) {
  return state.materials.find((item) => item.id === id) ?? null;
}

function materialByCode(state: Workspace, itemCode: string) {
  const key = normalizeItemCode(itemCode);
  return (
    state.materials.find((item) => normalizeItemCode(item.itemCode) === key) ?? null
  );
}

function requestById(state: Workspace, id: string) {
  return state.requests.find((request) => request.id === id) ?? null;
}

function zoneByCode(state: Workspace, code: ZoneCode) {
  return state.zones.find((zone) => zone.code === code) ?? null;
}

function categoryChoice(state: Workspace, categoryId: string | null | undefined) {
  if (!categoryId) return null;
  if (!state.categories.some((category) => category.id === categoryId)) {
    return "Choose a category from the list.";
  }
  return null;
}

function categoryFor(state: Workspace, categoryId: string | null) {
  if (!categoryId) return null;
  return state.categories.find((category) => category.id === categoryId) ?? null;
}

function isPpeMaterial(state: Workspace, material: Material) {
  return categoryFor(state, material.categoryId)?.requiresEmployee === true;
}

function zoneOfSupervisor(state: Workspace, supervisorId: string) {
  return state.zones.find((zone) => zone.supervisorId === supervisorId) ?? null;
}

function responsibleSupervisorId(state: Workspace, request: MaterialRequest) {
  const leader = userById(state, request.teamLeaderId);
  if (leader?.role === "TEAM_LEADER" && leader.supervisorId && leader.zoneCode) {
    const zone = zoneOfSupervisor(state, leader.supervisorId);
    if (zone && zone.code === leader.zoneCode) return leader.supervisorId;
  }
  return request.reviewedBy ?? request.supervisorId;
}

function appendIssuedTicket(
  state: Workspace,
  request: MaterialRequest,
  supervisorId: string,
  zoneCode: ZoneCode,
) {
  if (!Array.isArray(state.tickets)) state.tickets = [];
  if (state.tickets.some((ticket) => ticket.requestId === request.id)) return;
  if (!request.issuedBy || !request.issuedAt) return;
  const ticket: IssueTicket = {
    id: `ticket-${request.id}`,
    requestId: request.id,
    ticketNo: ticketLabel(request.requestNo),
    requestNo: request.requestNo,
    zoneCode,
    teamLeaderId: request.teamLeaderId,
    supervisorId,
    storeKeeperId: request.issuedBy,
    issuedAt: request.issuedAt,
    lines: request.items
      .filter((item) => isPositiveQty(finalApprovedQuantity(item)) || isPositiveQty(item.quantityIssued || "0"))
      .map((item) => ({
      itemId: item.id,
      itemCode: item.itemCode,
      description: item.productName,
      unit: item.unit,
      requested: item.quantityRequested,
      approved: finalApprovedQuantity(item),
      issued: item.quantityIssued,
    })),
  };
  state.tickets.push(ticket);
}

function reroutePending(state: Workspace) {
  for (const request of state.requests) {
    if (request.status !== "PENDING") continue;
    const leader = userById(state, request.teamLeaderId);
    if (!leader || leader.role !== "TEAM_LEADER" || !leader.supervisorId || !leader.zoneCode) {
      continue;
    }
    request.zoneCode = leader.zoneCode;
    request.supervisorId = leader.supervisorId;
  }
}

function placeTeamLeader(state: Workspace, leader: DemoUser, supervisorId: string) {
  const supervisor = userById(state, supervisorId);
  if (!supervisor || supervisor.role !== "SUPERVISOR" || !supervisor.active) {
    return "Choose an active supervisor.";
  }
  const zone = zoneOfSupervisor(state, supervisor.id);
  if (!zone) return "Assign that supervisor to a zone before assigning team leaders.";
  if (leader.role !== "TEAM_LEADER") return "Choose a team leader.";
  leader.supervisorId = supervisor.id;
  leader.zoneCode = zone.code;
  return null;
}

export function assignedToSupervisor(state: Workspace, actor: DemoUser, request: MaterialRequest) {
  return supervisorOwnsRequest(state, actor, request) === null;
}

function supervisorOwnsRequest(state: Workspace, actor: DemoUser, request: MaterialRequest) {
  const zone = zoneOfSupervisor(state, actor.id);
  const leader = userById(state, request.teamLeaderId);
  if (!zone || !leader || leader.supervisorId !== actor.id || leader.zoneCode !== zone.code) {
    return "You can decide only requests from team leaders assigned to you.";
  }
  if (request.zoneCode !== zone.code) {
    return "You can decide only requests from your assigned zone.";
  }
  return null;
}

function recordMovement(
  state: Workspace,
  input: {
    material: Material;
    type: MovementType;
    before: string;
    after: string;
    requestId: string | null;
    actorId: string;
    reason: string;
    at: string;
    reference?: string | null;
    supplier?: string | null;
    notes?: string | null;
    receiptDate?: string | null;
    idempotencyKey?: string | null;
    reversesMovementId?: string | null;
  },
) {
  const change = signedDiff(input.after, input.before);
  if (change === null) return;
  const key = input.idempotencyKey?.trim() || null;
  state.movements.push({
    id: crypto.randomUUID(),
    materialId: input.material.id,
    type: input.type,
    quantityBefore: input.before,
    quantityAfter: input.after,
    quantityChange: change,
    requestId: input.requestId,
    performedBy: input.actorId,
    reason: input.reason,
    createdAt: input.at,
    reference: input.reference?.trim() || null,
    supplier: input.supplier?.trim() || null,
    notes: input.notes?.trim() || null,
    receiptDate: input.receiptDate ?? null,
    idempotencyKey: key,
    reversesMovementId: input.reversesMovementId ?? null,
  });
}

function replayedKey(state: Workspace, key: string) {
  const trimmed = key.trim();
  if (!trimmed) return false;
  return state.movements.some((movement) => movement.idempotencyKey === trimmed);
}

function receiptDateOf(value: string) {
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return text;
}

function touch(material: Material, actorId: string, at: string) {
  material.updatedBy = actorId;
  material.updatedAt = at;
}

function itemDecision(item: RequestItem) {
  if (item.decision === "APPROVED" || item.decision === "REJECTED" || item.decision === "PENDING") {
    return item.decision;
  }
  return "PENDING" as const;
}

export function finalApprovedQuantity(item: RequestItem) {
  if (item.omDecision === "APPROVED") return item.omApprovedQuantity || "0";
  if (item.omDecision === "REJECTED" || item.omDecision === "PENDING") return "0";
  if (itemDecision(item) === "APPROVED") return item.approvedQuantity || "0";
  return "0";
}

function deriveStatus(request: MaterialRequest): RequestStatus {
  const decisions = request.items.map((item) => itemDecision(item));
  if (decisions.length === 0 || decisions.some((decision) => decision === "PENDING")) return "PENDING";
  if (decisions.every((decision) => decision === "REJECTED")) return "REJECTED";
  const awaiting = request.items.filter((item) => itemDecision(item) === "APPROVED");
  const operationOpen = awaiting.some(
    (item) => item.omDecision !== "APPROVED" && item.omDecision !== "REJECTED",
  );
  if (operationOpen) return "PENDING_OPERATION_MANAGER";
  const accepted = awaiting.filter(
    (item) => item.omDecision === "APPROVED" && isPositiveQty(item.omApprovedQuantity || "0"),
  );
  if (accepted.length === 0) return "REJECTED";
  const operationRejected = awaiting.some((item) => item.omDecision === "REJECTED");
  if (operationRejected) return "PARTIALLY_APPROVED";
  return "OPERATION_MANAGER_APPROVED";
}

function eligibleForFullDecision(request: MaterialRequest) {
  return (
    request.status === "PENDING" &&
    request.items.length > 0 &&
    request.items.every((item) => itemDecision(item) === "PENDING")
  );
}

function decisionLocked(request: MaterialRequest) {
  return request.status === "PREPARED" || request.status === "ISSUED";
}

function ensureApprovals(state: Workspace) {
  if (!Array.isArray(state.approvals)) state.approvals = [];
}

function decisionKeySeen(state: Workspace, key: string) {
  if (!key) return false;
  if (state.approvals?.some((record) => record.idempotencyKey === key)) return true;
  return state.requests.some((request) => (request.decisionKeys ?? []).includes(key));
}

function rememberDecisionKey(request: MaterialRequest, key: string | null) {
  if (!key) return;
  if (!Array.isArray(request.decisionKeys)) request.decisionKeys = [];
  if (!request.decisionKeys.includes(key)) request.decisionKeys.push(key);
}

function fullyApprovedAsRequested(request: MaterialRequest) {
  const supervisorFinished =
    request.status === "FULLY_APPROVED" ||
    request.status === "APPROVED" ||
    request.status === "PENDING_OPERATION_MANAGER" ||
    request.status === "OPERATION_MANAGER_APPROVED";
  return (
    supervisorFinished &&
    request.items.length > 0 &&
    request.items.every(
      (item) =>
        item.decision === "APPROVED" && cmpQty(item.approvedQuantity, item.quantityRequested) === 0,
    )
  );
}

function fullyRejected(request: MaterialRequest) {
  return (
    request.status === "REJECTED" &&
    request.items.length > 0 &&
    request.items.every((item) => item.decision === "REJECTED")
  );
}

function rejectionSummary(request: MaterialRequest) {
  const reasons = request.items.flatMap((item) => {
    const rows: string[] = [];
    if (item.decision === "REJECTED" && item.rejectionReason) rows.push(item.rejectionReason);
    if (item.omDecision === "REJECTED" && item.omRejectionReason) rows.push(item.omRejectionReason);
    return rows;
  });
  const unique = [...new Set(reasons)];
  return unique.length > 0 ? unique.join(" ") : null;
}

function applyApprovalStatus(request: MaterialRequest, actorId: string, at: string) {
  if (decisionLocked(request)) return;
  request.status = deriveStatus(request);
  if (request.status === "PENDING") request.rejectionReason = null;
  else request.rejectionReason = rejectionSummary(request);
  if (request.items.some((item) => itemDecision(item) !== "PENDING")) {
    request.reviewedBy = actorId;
    request.reviewedAt = at;
    request.supervisorId = actorId;
  }
}

function writeItemDecision(
  state: Workspace,
  request: MaterialRequest,
  item: RequestItem,
  actorId: string,
  decision: "APPROVED" | "REJECTED",
  approvedQuantity: string,
  rejectionReason: string | null,
  at: string,
  key: string | null,
) {
  if (
    item.decision === decision &&
    item.approvedQuantity === approvedQuantity &&
    (item.rejectionReason ?? null) === rejectionReason
  ) {
    return;
  }
  item.decision = decision;
  item.approvedQuantity = approvedQuantity;
  item.rejectionReason = rejectionReason;
  item.decidedBy = actorId;
  item.decidedAt = at;
  item.omDecision = "PENDING";
  item.omApprovedQuantity = "0";
  item.omRejectionReason = null;
  item.omDecidedBy = null;
  item.omDecidedAt = null;
  const record: ItemApproval = {
    id: crypto.randomUUID(),
    requestId: request.id,
    itemId: item.id,
    materialId: item.materialId,
    supervisorId: actorId,
    decision,
    quantityRequested: item.quantityRequested,
    approvedQuantity,
    rejectionReason,
    createdAt: at,
    idempotencyKey: key,
    stage: "SUPERVISOR",
  };
  state.approvals.push(record);
}

function parseApprovedQuantity(input: string, ceiling: string, ceilingLabel = "requested quantity") {
  const text = input.trim();
  if (!text) return { error: "Enter the approved quantity." };
  if (text.startsWith("-")) return { error: "Approved quantity cannot be negative." };
  const quantity = parseQty(text);
  if (!quantity) return { error: "Enter a valid approved quantity." };
  if (!isPositiveQty(quantity)) return { error: "Approved quantity must be greater than zero." };
  if (cmpQty(quantity, ceiling) > 0) {
    return { error: `Approved quantity cannot be greater than the ${ceilingLabel}.` };
  }
  return { quantity };
}

function guardSupervisorDecision(state: Workspace, actor: DemoUser, requestId: string) {
  const denied = requireActive(actor, "SUPERVISOR");
  if (denied) return { error: denied };
  const request = requestById(state, requestId);
  if (!request) return { error: "That request was not found." };
  if (request.teamLeaderId === actor.id) return { error: "You cannot approve your own request." };
  const blocked = supervisorOwnsRequest(state, actor, request);
  if (blocked) return { error: blocked };
  return { request };
}

function supervisorEditError(request: MaterialRequest) {
  if (request.status === "PENDING") return null;
  if (request.status === "PREPARED" || request.status === "ISSUED") {
    return "This request is already with the store. Decisions were not changed.";
  }
  return "This request is with the operation manager. Supervisor decisions were not changed.";
}

function approveEveryItem(
  state: Workspace,
  request: MaterialRequest,
  actorId: string,
  at: string,
  key: string | null,
) {
  for (const item of request.items) {
    writeItemDecision(state, request, item, actorId, "APPROVED", item.quantityRequested, null, at, key);
  }
  applyApprovalStatus(request, actorId, at);
  rememberDecisionKey(request, key);
}

export function approveRequest(
  state: Workspace,
  actor: DemoUser,
  requestId: string,
  at: string,
): Mutation<null> {
  const guarded = guardSupervisorDecision(state, actor, requestId);
  if ("error" in guarded && guarded.error) return fail(guarded.error);
  if (!("request" in guarded) || !guarded.request) return fail("That request was not found.");
  if (fullyApprovedAsRequested(guarded.request)) return ok(copy(state), null, true);
  const locked = supervisorEditError(guarded.request);
  if (locked) return fail(locked);
  if (!eligibleForFullDecision(guarded.request)) {
    return fail("Open the request and decide each material. Nothing was approved.");
  }
  const next = copy(state);
  ensureApprovals(next);
  const request = requestById(next, requestId);
  if (!request) return fail("That request was not found.");
  approveEveryItem(next, request, actor.id, at, null);
  return ok(next, null);
}

export function rejectRequest(
  state: Workspace,
  actor: DemoUser,
  requestId: string,
  reason: string,
  at: string,
): Mutation<null> {
  const parsedReason = requiredReason(reason);
  if ("error" in parsedReason) return fail(parsedReason.error);
  const note = parsedReason.text;
  const guarded = guardSupervisorDecision(state, actor, requestId);
  if ("error" in guarded && guarded.error) return fail(guarded.error);
  if (!("request" in guarded) || !guarded.request) return fail("That request was not found.");
  if (fullyRejected(guarded.request)) return ok(copy(state), null, true);
  const locked = supervisorEditError(guarded.request);
  if (locked) return fail(locked);
  if (!eligibleForFullDecision(guarded.request)) {
    return fail("Open the request and decide each material. Nothing was rejected.");
  }
  const next = copy(state);
  ensureApprovals(next);
  const request = requestById(next, requestId);
  if (!request) return fail("That request was not found.");
  for (const item of request.items) {
    writeItemDecision(next, request, item, actor.id, "REJECTED", "0", note, at, null);
  }
  applyApprovalStatus(request, actor.id, at);
  return ok(next, null);
}

export function bulkApproveRequests(
  state: Workspace,
  actor: DemoUser,
  requestIds: string[],
  idempotencyKey: string,
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "SUPERVISOR");
  if (denied) return fail(denied);
  const key = idempotencyKey.trim();
  if (!key) return fail("The approval could not be recorded. Try again.");
  if (decisionKeySeen(state, key)) return ok(copy(state), null, true);
  if (requestIds.length === 0) return fail("Select at least one request.");
  if (new Set(requestIds).size !== requestIds.length) {
    return fail("Each request can be selected once.");
  }
  for (const requestId of requestIds) {
    const guarded = guardSupervisorDecision(state, actor, requestId);
    if ("error" in guarded && guarded.error) return fail(`${guarded.error} Nothing was approved.`);
    if (!("request" in guarded) || !guarded.request) return fail("That request was not found.");
    const locked = supervisorEditError(guarded.request);
    if (locked) return fail(`${locked} Nothing was approved.`);
    if (!eligibleForFullDecision(guarded.request)) {
      return fail(
        `MR-${guarded.request.requestNo} needs a material-by-material review. Nothing was approved.`,
      );
    }
  }
  const next = copy(state);
  ensureApprovals(next);
  for (const requestId of requestIds) {
    const request = requestById(next, requestId);
    if (!request) return fail("That request was not found. Nothing was approved.");
    approveEveryItem(next, request, actor.id, at, key);
  }
  return ok(next, null);
}

export function decideRequestItems(
  state: Workspace,
  actor: DemoUser,
  requestId: string,
  decisions: {
    itemId: string;
    decision: "APPROVED" | "REJECTED";
    approvedQuantity: string;
    rejectionReason: string;
  }[],
  idempotencyKey: string,
  at: string,
): Mutation<null> {
  const key = idempotencyKey.trim();
  if (!key) return fail("The decision could not be recorded. Try again.");
  if (decisionKeySeen(state, key)) return ok(copy(state), null, true);
  if (decisions.length === 0) return fail("Choose approve or reject for at least one material.");
  const seen = new Set<string>();
  for (const row of decisions) {
    if (seen.has(row.itemId)) return fail("Each material can be decided once.");
    seen.add(row.itemId);
    if (row.decision !== "APPROVED" && row.decision !== "REJECTED") {
      return fail("Choose approve or reject for each material.");
    }
  }
  const guarded = guardSupervisorDecision(state, actor, requestId);
  if ("error" in guarded && guarded.error) return fail(guarded.error);
  if (!("request" in guarded) || !guarded.request) return fail("That request was not found.");
  const locked = supervisorEditError(guarded.request);
  const parsed: {
    itemId: string;
    decision: "APPROVED" | "REJECTED";
    quantity: string;
    reason: string | null;
  }[] = [];
  for (const row of decisions) {
    const item = guarded.request.items.find((entry) => entry.id === row.itemId);
    if (!item) return fail("One of the materials is not on this request.");
    if (row.decision === "APPROVED") {
      const result = parseApprovedQuantity(row.approvedQuantity, item.quantityRequested);
      if ("error" in result) return fail(`${item.productName}: ${result.error}`);
      parsed.push({ itemId: item.id, decision: "APPROVED", quantity: result.quantity, reason: null });
    } else {
      const parsedReason = requiredReason(row.rejectionReason);
      if ("error" in parsedReason) return fail(`${item.productName}: ${parsedReason.error}`);
      parsed.push({ itemId: item.id, decision: "REJECTED", quantity: "0", reason: parsedReason.text });
    }
  }
  if (locked) {
    const same = parsed.every((row) => {
      const item = guarded.request?.items.find((entry) => entry.id === row.itemId);
      return (
        item !== undefined &&
        item.decision === row.decision &&
        item.approvedQuantity === row.quantity &&
        (item.rejectionReason ?? null) === row.reason
      );
    });
    if (same) return ok(copy(state), null, true);
    return fail(locked);
  }
  const next = copy(state);
  ensureApprovals(next);
  const request = requestById(next, requestId);
  if (!request) return fail("That request was not found.");
  let changed = false;
  for (const row of parsed) {
    const item = request.items.find((entry) => entry.id === row.itemId);
    if (!item) return fail("One of the materials is not on this request.");
    const before = `${item.decision}|${item.approvedQuantity}|${item.rejectionReason ?? ""}`;
    writeItemDecision(next, request, item, actor.id, row.decision, row.quantity, row.reason, at, key);
    const after = `${item.decision}|${item.approvedQuantity}|${item.rejectionReason ?? ""}`;
    if (before !== after) changed = true;
  }
  applyApprovalStatus(request, actor.id, at);
  rememberDecisionKey(request, key);
  return ok(next, null, !changed);
}

export function decideOperationItems(
  state: Workspace,
  actor: DemoUser,
  requestId: string,
  decisions: {
    itemId: string;
    decision: "APPROVED" | "REJECTED";
    approvedQuantity: string;
    rejectionReason: string;
  }[],
  idempotencyKey: string,
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "OPERATION_MANAGER");
  if (denied) return fail(denied);
  const key = idempotencyKey.trim();
  if (!key) return fail("The decision could not be recorded. Try again.");
  if (decisionKeySeen(state, key)) return ok(copy(state), null, true);
  if (decisions.length === 0) return fail("Choose approve or reject for at least one material.");
  const seen = new Set<string>();
  for (const row of decisions) {
    if (seen.has(row.itemId)) return fail("Each material can be decided once.");
    seen.add(row.itemId);
    if (row.decision !== "APPROVED" && row.decision !== "REJECTED") {
      return fail("Choose approve or reject for each material.");
    }
  }
  const request = requestById(state, requestId);
  if (!request) return fail("That request was not found.");
  if (request.status === "PREPARED" || request.status === "ISSUED") {
    return fail("This request is already with the store. Decisions were not changed.");
  }
  if (request.items.some((item) => itemDecision(item) === "PENDING")) {
    return fail("The supervisor has not finished this request. Nothing was decided.");
  }
  if (!request.items.some((item) => itemDecision(item) === "APPROVED")) {
    return fail("The supervisor rejected this request. Nothing was decided.");
  }
  const parsed: {
    itemId: string;
    decision: "APPROVED" | "REJECTED";
    quantity: string;
    reason: string | null;
  }[] = [];
  for (const row of decisions) {
    const item = request.items.find((entry) => entry.id === row.itemId);
    if (!item) return fail("One of the materials is not on this request.");
    if (item.decision !== "APPROVED") {
      return fail(`${item.productName} was rejected by the supervisor. Nothing was decided.`);
    }
    if (row.decision === "APPROVED") {
      const result = parseApprovedQuantity(
        row.approvedQuantity,
        item.approvedQuantity || "0",
        "supervisor approved quantity",
      );
      if ("error" in result) return fail(`${item.productName}: ${result.error}`);
      parsed.push({ itemId: item.id, decision: "APPROVED", quantity: result.quantity, reason: null });
    } else {
      const parsedReason = optionalReason(row.rejectionReason);
      if ("error" in parsedReason) return fail(`${item.productName}: ${parsedReason.error}`);
      parsed.push({ itemId: item.id, decision: "REJECTED", quantity: "0", reason: parsedReason.text });
    }
  }
  const next = copy(state);
  ensureApprovals(next);
  const stored = requestById(next, requestId);
  if (!stored) return fail("That request was not found.");
  let changed = false;
  for (const row of parsed) {
    const item = stored.items.find((entry) => entry.id === row.itemId);
    if (!item) return fail("One of the materials is not on this request.");
    const before = `${item.omDecision}|${item.omApprovedQuantity}|${item.omRejectionReason ?? ""}`;
    if (
      item.omDecision === row.decision &&
      item.omApprovedQuantity === row.quantity &&
      (item.omRejectionReason ?? null) === row.reason
    ) {
      continue;
    }
    item.omDecision = row.decision;
    item.omApprovedQuantity = row.quantity;
    item.omRejectionReason = row.reason;
    item.omDecidedBy = actor.id;
    item.omDecidedAt = at;
    next.approvals.push({
      id: crypto.randomUUID(),
      requestId: stored.id,
      itemId: item.id,
      materialId: item.materialId,
      supervisorId: actor.id,
      decision: row.decision,
      quantityRequested: item.quantityRequested,
      approvedQuantity: row.quantity,
      rejectionReason: row.reason,
      createdAt: at,
      idempotencyKey: key,
      stage: "OPERATION_MANAGER",
    });
    const after = `${item.omDecision}|${item.omApprovedQuantity}|${item.omRejectionReason ?? ""}`;
    if (before !== after) changed = true;
  }
  if (decisionLocked(stored)) return fail("This request is already with the store. Decisions were not changed.");
  stored.status = deriveStatus(stored);
  stored.rejectionReason = stored.status === "PENDING" ? null : rejectionSummary(stored);
  if (stored.items.some((item) => item.omDecision === "APPROVED" || item.omDecision === "REJECTED")) {
    stored.operationReviewedBy = actor.id;
    stored.operationReviewedAt = at;
  }
  rememberDecisionKey(stored, key);
  return ok(next, null, !changed);
}

export function bulkApproveOperationLines(
  state: Workspace,
  actor: DemoUser,
  lines: { requestId: string; itemId: string }[],
  idempotencyKey: string,
  at: string,
): Mutation<OperationBulkResult> {
  const denied = requireActive(actor, "OPERATION_MANAGER");
  if (denied) return fail(denied);
  const key = idempotencyKey.trim();
  if (!key) return fail("The approval could not be recorded. Try again.");
  if (decisionKeySeen(state, key)) {
    return ok(copy(state), { approvedCount: 0, requestCount: 0, skippedInactive: 0 }, true);
  }
  if (lines.length === 0) return fail("Select at least one material.");
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.itemId)) return fail("Each material can be approved once. Nothing was approved.");
    seen.add(line.itemId);
  }

  const plans: {
    requestId: string;
    itemId: string;
    quantity: string;
    inactive: boolean;
  }[] = [];
  for (const line of lines) {
    const request = requestById(state, line.requestId);
    if (!request) return fail("That request was not found. Nothing was approved.");
    if (request.status === "PREPARED" || request.status === "ISSUED") {
      return fail("A selected request is already with the store. Nothing was approved.");
    }
    if (request.items.some((item) => itemDecision(item) === "PENDING")) {
      return fail("The supervisor has not finished a selected request. Nothing was approved.");
    }
    const item = request.items.find((entry) => entry.id === line.itemId);
    if (!item) return fail("One of the materials is not on the selected request. Nothing was approved.");
    if (item.decision !== "APPROVED") {
      return fail(`${item.productName} was rejected by the supervisor. Nothing was approved.`);
    }
    const quantity = item.approvedQuantity || "0";
    if (
      item.omDecision === "APPROVED" &&
      item.omApprovedQuantity === quantity &&
      !item.omRejectionReason
    ) {
      continue;
    }
    if (item.omDecision === "APPROVED" || item.omDecision === "REJECTED") {
      return fail(`${item.productName} already has an operation manager decision. Open the request to change it. Nothing was approved.`);
    }
    if (!isPositiveQty(quantity)) {
      return fail(`${item.productName} has no supervisor approved quantity. Nothing was approved.`);
    }
    const material = materialById(state, item.materialId);
    plans.push({
      requestId: request.id,
      itemId: item.id,
      quantity,
      inactive: !material || !material.active,
    });
  }

  const eligible = plans.filter((plan) => !plan.inactive);
  const skippedInactive = plans.length - eligible.length;
  if (eligible.length === 0) {
    if (skippedInactive > 0) {
      return fail("Inactive materials were not approved. Open the request to reject them. Nothing was approved.");
    }
    return ok(copy(state), { approvedCount: 0, requestCount: 0, skippedInactive: 0 }, true);
  }

  const next = copy(state);
  ensureApprovals(next);
  const touched = new Set<string>();
  let changed = false;
  for (const plan of eligible) {
    const stored = requestById(next, plan.requestId);
    if (!stored) return fail("That request was not found. Nothing was approved.");
    const item = stored.items.find((entry) => entry.id === plan.itemId);
    if (!item) return fail("One of the materials is not on the selected request. Nothing was approved.");
    const supervisorQuantity = item.approvedQuantity;
    const supervisorDecision = item.decision;
    const supervisorReason = item.rejectionReason;
    const supervisorUser = item.decidedBy;
    const supervisorAt = item.decidedAt;
    item.omDecision = "APPROVED";
    item.omApprovedQuantity = plan.quantity;
    item.omRejectionReason = null;
    item.omDecidedBy = actor.id;
    item.omDecidedAt = at;
    item.approvedQuantity = supervisorQuantity;
    item.decision = supervisorDecision;
    item.rejectionReason = supervisorReason;
    item.decidedBy = supervisorUser;
    item.decidedAt = supervisorAt;
    next.approvals.push({
      id: crypto.randomUUID(),
      requestId: stored.id,
      itemId: item.id,
      materialId: item.materialId,
      supervisorId: actor.id,
      decision: "APPROVED",
      quantityRequested: item.quantityRequested,
      approvedQuantity: plan.quantity,
      rejectionReason: null,
      createdAt: at,
      idempotencyKey: key,
      stage: "OPERATION_MANAGER",
    });
    changed = true;
    touched.add(stored.id);
  }
  for (const requestId of touched) {
    const stored = requestById(next, requestId);
    if (!stored) return fail("That request was not found. Nothing was approved.");
    if (decisionLocked(stored)) {
      return fail("A selected request is already with the store. Nothing was approved.");
    }
    stored.status = deriveStatus(stored);
    stored.rejectionReason = stored.status === "PENDING" ? null : rejectionSummary(stored);
    stored.operationReviewedBy = actor.id;
    stored.operationReviewedAt = at;
    rememberDecisionKey(stored, key);
  }
  return ok(
    next,
    { approvedCount: eligible.length, requestCount: touched.size, skippedInactive },
    !changed,
  );
}

export function rejectOperationLine(
  state: Workspace,
  actor: DemoUser,
  input: { requestId: string; itemId: string; rejectionReason: string },
  idempotencyKey: string,
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "OPERATION_MANAGER");
  if (denied) return fail(denied);
  const key = idempotencyKey.trim();
  if (!key) return fail("The decision could not be recorded. Try again.");
  if (decisionKeySeen(state, key)) return ok(copy(state), null, true);
  const parsedReason = optionalReason(input.rejectionReason ?? "");
  if ("error" in parsedReason) return fail(parsedReason.error);
  const note = parsedReason.text;
  const request = requestById(state, input.requestId);
  if (!request) return fail("That request was not found. Nothing was rejected.");
  if (request.status === "PREPARED" || request.status === "ISSUED") {
    return fail("This request is already with the store. Nothing was rejected.");
  }
  if (request.items.some((item) => itemDecision(item) === "PENDING")) {
    return fail("The supervisor has not finished this request. Nothing was rejected.");
  }
  const item = request.items.find((entry) => entry.id === input.itemId);
  if (!item) return fail("That material is not on this request. Nothing was rejected.");
  if (item.decision !== "APPROVED") {
    return fail(`${item.productName} was rejected by the supervisor. Nothing was rejected.`);
  }
  if (item.omDecision === "REJECTED" && item.omRejectionReason === note) {
    return ok(copy(state), null, true);
  }
  if (item.omDecision === "APPROVED" || item.omDecision === "REJECTED") {
    return fail(`${item.productName} already has an operation manager decision. Open the request to change it. Nothing was rejected.`);
  }

  const next = copy(state);
  ensureApprovals(next);
  const stored = requestById(next, request.id);
  if (!stored) return fail("That request was not found. Nothing was rejected.");
  const storedItem = stored.items.find((entry) => entry.id === item.id);
  if (!storedItem) return fail("That material is not on this request. Nothing was rejected.");
  const supervisorQuantity = storedItem.approvedQuantity;
  const supervisorDecision = storedItem.decision;
  const supervisorReason = storedItem.rejectionReason;
  const supervisorUser = storedItem.decidedBy;
  const supervisorAt = storedItem.decidedAt;
  storedItem.omDecision = "REJECTED";
  storedItem.omApprovedQuantity = "0";
  storedItem.omRejectionReason = note;
  storedItem.omDecidedBy = actor.id;
  storedItem.omDecidedAt = at;
  storedItem.approvedQuantity = supervisorQuantity;
  storedItem.decision = supervisorDecision;
  storedItem.rejectionReason = supervisorReason;
  storedItem.decidedBy = supervisorUser;
  storedItem.decidedAt = supervisorAt;
  next.approvals.push({
    id: crypto.randomUUID(),
    requestId: stored.id,
    itemId: storedItem.id,
    materialId: storedItem.materialId,
    supervisorId: actor.id,
    decision: "REJECTED",
    quantityRequested: storedItem.quantityRequested,
    approvedQuantity: "0",
    rejectionReason: note,
    createdAt: at,
    idempotencyKey: key,
    stage: "OPERATION_MANAGER",
  });
  if (decisionLocked(stored)) {
    return fail("This request is already with the store. Nothing was rejected.");
  }
  stored.status = deriveStatus(stored);
  stored.rejectionReason = rejectionSummary(stored);
  stored.operationReviewedBy = actor.id;
  stored.operationReviewedAt = at;
  rememberDecisionKey(stored, key);
  return ok(next, null);
}

export function prepareRequest(
  state: Workspace,
  actor: DemoUser,
  requestId: string,
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  const next = copy(state);
  const request = requestById(next, requestId);
  if (!request) return fail("That request was not found.");
  if (!isReadyToPrepare(request.status)) {
    return fail("Only an approved request can be marked prepared.");
  }
  if (!request.items.some((item) => isPositiveQty(finalApprovedQuantity(item)))) {
    return fail("There is no approved quantity to prepare.");
  }
  request.status = "PREPARED";
  request.preparedBy = actor.id;
  request.preparedAt = at;
  return ok(next, null);
}

export function issueRequest(
  state: Workspace,
  actor: DemoUser,
  requestId: string,
  lines: { itemId: string; quantity: string; employees?: { employeeId: string; quantity: string }[] }[],
  idempotencyKey: string,
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  const key = idempotencyKey.trim();
  if (!key) return fail("The issue could not be recorded. Try again.");

  const existing = requestById(state, requestId);
  if (!existing) return fail("That request was not found.");
  if (existing.issueReceipts.some((receipt) => receipt.key === key)) {
    return ok(copy(state), null, true);
  }
  if (existing.status === "ISSUED") {
    return fail("This request is already issued. Stock was not changed again.");
  }
  if (existing.status !== "PREPARED") {
    return fail("Mark the request prepared before issuing. Stock was not changed.");
  }

  const parsed: { itemId: string; quantity: string; employees?: { employeeId: string; quantity: string }[] }[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.itemId)) return fail("Each material can be issued once per confirmation.");
    seen.add(line.itemId);
    const quantity = parseQty(line.quantity);
    if (!quantity || !isPositiveQty(quantity)) continue;
    parsed.push({ itemId: line.itemId, quantity, employees: line.employees });
  }
  if (parsed.length === 0) {
    return fail("Enter a quantity to issue for at least one material.");
  }

  for (const line of parsed) {
    const item = existing.items.find((entry) => entry.id === line.itemId);
    if (!item) return fail("One of the lines is not on this request.");
    if (item.decision === "REJECTED" || item.omDecision === "REJECTED") {
      return fail(`${item.productName} was rejected and cannot be issued. Nothing was issued.`);
    }
    const ceiling = finalApprovedQuantity(item);
    if (!isPositiveQty(ceiling)) {
      return fail(`${item.productName} is not approved for issue. Nothing was issued.`);
    }
    const remaining = subQty(ceiling, item.quantityIssued);
    if (remaining === null || cmpQty(line.quantity, remaining) > 0) {
      return fail(
        `${item.productName} has ${remaining ?? "0"} ${item.unit} still to issue.`,
      );
    }
    const material = materialById(state, item.materialId);
    if (!material) return fail(`${item.productName} is no longer in the inventory.`);
    if (cmpQty(line.quantity, material.currentStock) > 0) {
      return fail(
        `${item.productName} does not have enough stock. Available: ${material.currentStock} ${material.unit}. Requested now: ${line.quantity} ${item.unit}. Nothing was issued.`,
      );
    }
    const ppe = isPpeMaterial(state, material);
    if (!ppe) {
      if ((line.employees ?? []).some((employee) => isPositiveQty(parseQty(employee.quantity) ?? "0"))) {
        return fail("Only PPE can be assigned to an employee ID.");
      }
      continue;
    }
    const allocations = (existing.ppeAllocations ?? []).filter(
      (allocation) => allocation.materialId === item.materialId,
    );
    if (allocations.length === 0) {
      return fail("PPE must be assigned to an employee ID. Nothing was issued.");
    }
    const already = (existing.issueReceipts ?? []).flatMap((receipt) =>
      receipt.lines
        .filter((entry) => entry.itemId === item.id)
        .flatMap((entry) => entry.employees ?? []),
    );
    const split = distributeIssuedPpe(allocations, already, line.quantity, line.employees);
    if (!split.ok) return fail(split.error);
    line.employees = split.employees;
  }

  const next = copy(state);
  const request = requestById(next, requestId);
  if (!request) return fail("That request was not found.");

  for (const line of parsed) {
    const item = request.items.find((entry) => entry.id === line.itemId);
    const material = item ? materialById(next, item.materialId) : null;
    if (!item || !material) return fail("The inventory changed. Nothing was issued.");
    const before = material.currentStock;
    const after = subQty(before, line.quantity);
    const issued = addQty(item.quantityIssued, line.quantity);
    if (after === null || issued === null) {
      return fail("The quantity could not be applied. Nothing was issued.");
    }
    const issuedTotal = addQty(material.out || "0", line.quantity);
    material.currentStock = after;
    material.out = issuedTotal ?? material.out;
    item.quantityIssued = issued;
    touch(material, actor.id, at);
    recordMovement(next, {
      material,
      type: "ISSUE",
      before,
      after,
      requestId: request.id,
      actorId: actor.id,
      reason: `Issued ${line.quantity} ${item.unit} of ${item.productName} for MR-${request.requestNo}.`,
      at,
      reference: `MR-${request.requestNo}`,
    });
  }

  request.issueReceipts.push({
    key,
    issuedBy: actor.id,
    issuedAt: at,
    lines: parsed.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
      ...(line.employees && line.employees.length > 0 ? { employees: line.employees } : {}),
    })),
  });

  const complete = request.items.every((item) => {
    const ceiling = finalApprovedQuantity(item);
    return isZeroQty(subQty(ceiling, item.quantityIssued) ?? "1");
  });
  if (complete) {
    request.status = "ISSUED";
    request.issuedBy = actor.id;
    request.issuedAt = at;
    const supervisorId = responsibleSupervisorId(next, request);
    const leader = userById(next, request.teamLeaderId);
    const zoneCode =
      leader?.supervisorId === supervisorId && leader.zoneCode
        ? leader.zoneCode
        : request.zoneCode;
    appendIssuedTicket(next, request, supervisorId, zoneCode);
  }

  return ok(next, null);
}

export function createMaterial(
  state: Workspace,
  actor: DemoUser,
  input: {
    itemCode: string;
    productName: string;
    activeIngredient: string;
    unit: string;
    currentStock: string;
    requestable: boolean;
    categoryId?: string | null;
  },
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  const itemCode = input.itemCode.trim();
  const productName = input.productName.trim();
  const unit = input.unit.trim();
  const ingredient = input.activeIngredient.trim();
  if (!itemCode || itemCode.length > 40) return fail("Enter an item code.");
  if (!productName || productName.length > 120) return fail("Enter a product name.");
  if (!unit || unit.length > 20) return fail("Enter a unit.");
  if (ingredient.length > 120) return fail("The active ingredient is too long.");
  const quantity = parseQty(input.currentStock);
  if (quantity === null) return fail("Current stock must be zero or greater.");
  if (materialByCode(state, itemCode)) {
    return fail("That item code already exists. Edit the existing material.");
  }
  const next = copy(state);
  const categoryError = categoryChoice(next, input.categoryId);
  if (categoryError) return fail(categoryError);
  const created: Material = {
    id: crypto.randomUUID(),
    itemCode,
    productName,
    activeIngredient: ingredient,
    unit,
    beginningInventory: quantity,
    newStock: "0",
    out: "0",
    currentStock: quantity,
    categoryId: input.categoryId ?? null,
    requestable: input.requestable,
    active: true,
    updatedAt: at,
    updatedBy: actor.id,
  };
  next.materials.push(created);
  if (isPositiveQty(quantity)) {
    recordMovement(next, {
      material: created,
      type: "OPENING",
      before: "0",
      after: quantity,
      requestId: null,
      actorId: actor.id,
      reason: "Opening inventory balance.",
      at,
      reference: "Opening",
    });
  }
  return ok(next, null);
}

export function updateMaterialDetails(
  state: Workspace,
  actor: DemoUser,
  input: {
    materialId: string;
    productName: string;
    activeIngredient: string;
    unit: string;
    categoryId?: string | null;
  },
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  const productName = input.productName.trim();
  const unit = input.unit.trim();
  const ingredient = input.activeIngredient.trim();
  if (!productName) return fail("Enter a product name.");
  if (!unit) return fail("Enter a unit.");
  const next = copy(state);
  const material = materialById(next, input.materialId);
  if (!material) return fail("That material was not found.");
  if (input.categoryId !== undefined) {
    const categoryError = categoryChoice(next, input.categoryId);
    if (categoryError) return fail(categoryError);
    material.categoryId = input.categoryId;
  }
  material.productName = productName;
  material.unit = unit;
  material.activeIngredient = ingredient;
  touch(material, actor.id, at);
  return ok(next, null);
}

function oppositeDelta(change: string) {
  if (change.startsWith("-")) return change.slice(1);
  if (isZeroQty(change)) return "0";
  return `-${change}`;
}

export function receiveStock(
  state: Workspace,
  actor: DemoUser,
  input: {
    materialId: string;
    quantity: string;
    receiptDate: string;
    reference: string;
    supplier: string;
    notes: string;
    idempotencyKey: string;
  },
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  if (replayedKey(state, input.idempotencyKey)) return ok(copy(state), null, true);
  const receiptDate = receiptDateOf(input.receiptDate);
  if (!receiptDate) return fail("Enter the receipt date.");
  const reference = input.reference.trim();
  if (!reference || reference.length > 40) return fail("Enter a receipt reference number.");
  const supplier = input.supplier.trim();
  if (supplier.length > 80) return fail("The supplier name is too long.");
  const notes = input.notes.trim();
  if (notes.length > 500) return fail("The notes are too long.");
  const amount = parseQty(input.quantity);
  if (!amount || !isPositiveQty(amount)) return fail("Enter a quantity greater than zero.");
  const existing = materialById(state, input.materialId);
  if (!existing) return fail("That material was not found.");
  const duplicate = state.movements.some(
    (movement) =>
      movement.materialId === existing.id &&
      movement.type === "RECEIPT" &&
      movement.reference?.toLowerCase() === reference.toLowerCase(),
  );
  if (duplicate) {
    return fail(`Receipt ${reference} is already recorded for this material. Stock was not changed.`);
  }
  const next = copy(state);
  const material = materialById(next, input.materialId);
  if (!material) return fail("That material was not found.");
  const before = material.currentStock;
  const after = addQty(before, amount);
  const received = addQty(material.newStock || "0", amount);
  if (!after || !received) return fail("The quantity could not be applied. Stock was not changed.");
  material.currentStock = after;
  material.newStock = received;
  touch(material, actor.id, at);
  recordMovement(next, {
    material,
    type: "RECEIPT",
    before,
    after,
    requestId: null,
    actorId: actor.id,
    reason: notes || `Stock receipt ${reference}.`,
    at,
    reference,
    supplier,
    notes,
    receiptDate,
    idempotencyKey: input.idempotencyKey,
  });
  return ok(next, null);
}

export function adjustStock(
  state: Workspace,
  actor: DemoUser,
  input: {
    materialId: string;
    mode: "increase" | "decrease" | "count";
    quantity: string;
    reason: string;
    reference: string;
    idempotencyKey: string;
  },
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  if (replayedKey(state, input.idempotencyKey)) return ok(copy(state), null, true);
  const note = reasonOf(input.reason);
  if (!note) return fail("Enter a reason for this stock adjustment.");
  const reference = input.reference.trim();
  if (reference.length > 40) return fail("The reference number is too long.");
  const next = copy(state);
  const material = materialById(next, input.materialId);
  if (!material) return fail("That material was not found.");
  const before = material.currentStock;
  let after: string | null = null;
  if (input.mode === "count") {
    after = parseQty(input.quantity);
    if (after === null) return fail("The counted quantity must be zero or greater.");
  } else {
    const amount = parseQty(input.quantity);
    if (!amount || !isPositiveQty(amount)) return fail("Enter a quantity greater than zero.");
    after = input.mode === "increase" ? addQty(before, amount) : subQty(before, amount);
    if (after === null) {
      return fail(
        `That adjustment is more than the current stock of ${before} ${material.unit}. Nothing was changed.`,
      );
    }
  }
  if (after === null) return fail("The quantity could not be applied. Stock was not changed.");
  if (cmpQty(before, after) === 0) return ok(next, null);
  material.currentStock = after;
  touch(material, actor.id, at);
  recordMovement(next, {
    material,
    type: "ADJUSTMENT",
    before,
    after,
    requestId: null,
    actorId: actor.id,
    reason: note,
    at,
    reference,
    notes: note,
    idempotencyKey: input.idempotencyKey,
  });
  return ok(next, null);
}

export function damageStock(
  state: Workspace,
  actor: DemoUser,
  materialId: string,
  quantity: string,
  reason: string,
  at: string,
) {
  return adjustStock(
    state,
    actor,
    { materialId, mode: "decrease", quantity, reason, reference: "", idempotencyKey: "" },
    at,
  );
}

export function setCountedStock(
  state: Workspace,
  actor: DemoUser,
  materialId: string,
  quantity: string,
  reason: string,
  at: string,
) {
  return adjustStock(
    state,
    actor,
    { materialId, mode: "count", quantity, reason, reference: "", idempotencyKey: "" },
    at,
  );
}

export function reverseMovement(
  state: Workspace,
  actor: DemoUser,
  movementId: string,
  reason: string,
  idempotencyKey: string,
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  if (replayedKey(state, idempotencyKey)) return ok(copy(state), null, true);
  const note = reasonOf(reason);
  if (!note) return fail("Enter a reason for this reversal.");
  const original = state.movements.find((movement) => movement.id === movementId);
  if (!original) return fail("That transaction was not found.");
  if (original.type !== "RECEIPT" && original.type !== "ADJUSTMENT" && original.type !== "DAMAGE" && original.type !== "IMPORT") {
    return fail("This transaction cannot be reversed.");
  }
  if (state.movements.some((movement) => movement.reversesMovementId === original.id)) {
    return fail("This transaction has already been reversed. Stock was not changed.");
  }
  const current = materialById(state, original.materialId);
  if (!current) return fail("That material was not found.");
  const delta = oppositeDelta(original.quantityChange);
  const after = addQty(current.currentStock, delta);
  if (after === null || cmpQty(after, "0") < 0) {
    return fail("Reversing this transaction would make the stock negative. Nothing was changed.");
  }
  const next = copy(state);
  const material = materialById(next, original.materialId);
  if (!material) return fail("That material was not found.");
  const before = material.currentStock;
  material.currentStock = after;
  if (original.type === "RECEIPT") {
    const amount = original.quantityChange.startsWith("-")
      ? original.quantityChange.slice(1)
      : original.quantityChange;
    material.newStock = subQty(material.newStock || "0", amount) ?? "0";
  }
  touch(material, actor.id, at);
  recordMovement(next, {
    material,
    type: "REVERSAL",
    before,
    after,
    requestId: original.requestId,
    actorId: actor.id,
    reason: note,
    at,
    reference: original.reference,
    supplier: original.supplier,
    notes: note,
    receiptDate: original.receiptDate,
    idempotencyKey,
    reversesMovementId: original.id,
  });
  return ok(next, null);
}

export function setRequestable(
  state: Workspace,
  actor: DemoUser,
  materialId: string,
  requestable: boolean,
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  const next = copy(state);
  const material = materialById(next, materialId);
  if (!material) return fail("That material was not found.");
  if (material.requestable === requestable) return ok(next, null);
  material.requestable = requestable;
  touch(material, actor.id, at);
  recordMovement(next, {
    material,
    type: "AVAILABILITY",
    before: material.currentStock,
    after: material.currentStock,
    requestId: null,
    actorId: actor.id,
    reason: requestable
      ? "Marked requestable for team leader requests."
      : "Marked not requestable for team leader requests.",
    at,
  });
  return ok(next, null);
}

export function setMaterialActive(
  state: Workspace,
  actor: DemoUser,
  materialId: string,
  active: boolean,
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  const next = copy(state);
  const material = materialById(next, materialId);
  if (!material) return fail("That material was not found.");
  if (material.active === active && (active || !material.requestable)) return ok(next, null);
  material.active = active;
  if (!active) material.requestable = false;
  touch(material, actor.id, at);
  recordMovement(next, {
    material,
    type: "STATUS",
    before: material.currentStock,
    after: material.currentStock,
    requestId: null,
    actorId: actor.id,
    reason: active
      ? "Activated the material."
      : "Deactivated the material. It stays in the history and is no longer requestable.",
    at,
  });
  return ok(next, null);
}

export function materialHasDependents(state: Workspace, materialId: string) {
  const material = materialById(state, materialId);
  if (!material) return true;
  const code = normalizeItemCode(material.itemCode);
  const usedByRequest = state.requests.some(
    (request) =>
      request.items.some((item) => item.materialId === material.id) ||
      (request.ppeAllocations ?? []).some((item) => item.materialId === material.id),
  );
  const usedByTicket = (state.tickets ?? []).some((ticket) =>
    ticket.lines.some((line) => normalizeItemCode(line.itemCode) === code),
  );
  const hasHistory = state.movements.some((movement) => movement.materialId === material.id);
  return usedByRequest || usedByTicket || hasHistory;
}

export function deleteMaterial(
  state: Workspace,
  actor: DemoUser,
  materialId: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  const next = copy(state);
  if (!materialById(next, materialId)) return fail("That material was not found.");
  if (materialHasDependents(next, materialId)) {
    return fail(
      "This material has history or is used on a request or ticket. Deactivate it instead. Nothing was deleted.",
    );
  }
  next.materials = next.materials.filter((item) => item.id !== materialId);
  return ok(next, null);
}

export function createCategory(
  state: Workspace,
  actor: DemoUser,
  name: string,
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  const label = name.trim();
  if (!label || label.length > 40) return fail("Enter a category name.");
  if (state.categories.some((category) => category.name.toLowerCase() === label.toLowerCase())) {
    return fail("That category already exists.");
  }
  const next = copy(state);
  const position = next.categories.reduce((max, category) => Math.max(max, category.position), 0) + 1;
  next.categories.push({
    id: crypto.randomUUID(),
    name: label,
    requiresEmployee: false,
    active: true,
    position,
    updatedAt: at,
  });
  return ok(next, null);
}

export function updateCategory(
  state: Workspace,
  actor: DemoUser,
  input: { categoryId: string; name: string; active: boolean },
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  const label = input.name.trim();
  if (!label || label.length > 40) return fail("Enter a category name.");
  const next = copy(state);
  const category = next.categories.find((item) => item.id === input.categoryId);
  if (!category) return fail("That category was not found.");
  const duplicate = next.categories.some(
    (item) => item.id !== category.id && item.name.toLowerCase() === label.toLowerCase(),
  );
  if (duplicate) return fail("That category already exists.");
  category.name = label;
  category.active = input.active;
  category.updatedAt = at;
  return ok(next, null);
}

export function setMaterialCategory(
  state: Workspace,
  actor: DemoUser,
  materialId: string,
  categoryId: string | null,
  at: string,
): Mutation<null> {
  const denied = requireActive(actor, "STORE_KEEPER");
  if (denied) return fail(denied);
  const next = copy(state);
  const categoryError = categoryChoice(next, categoryId);
  if (categoryError) return fail(categoryError);
  const material = materialById(next, materialId);
  if (!material) return fail("That material was not found.");
  material.categoryId = categoryId;
  touch(material, actor.id, at);
  return ok(next, null);
}

type RequestLineInput = { materialId: string; quantity: string };

export function createTeamRequest(
  state: Workspace,
  actor: DemoUser,
  input: RequestLineInput[] | { lines?: RequestLineInput[]; employees?: { employeeId: string; lines: RequestLineInput[] }[] },
  at: string,
): Mutation<{ requestNo: number }> {
  const leader = userById(state, actor.id);
  if (!leader || !leader.active) {
    return fail("You do not have permission for this action.");
  }
  if (leader.role === "SUPERVISOR") {
    const assigned = zoneOfSupervisor(state, leader.id);
    if (!assigned) return fail("This supervisor is not assigned to a zone.");
    if (!isZoneOpen(state, assigned.code, at)) return fail(ZONE_CLOSED_MESSAGE);
    return fail(
      "Supervisors do not submit material requests. A team leader submits a request when their zone is open.",
    );
  }
  if (leader.role !== "TEAM_LEADER") {
    return fail("You do not have permission for this action.");
  }
  if (!leader.zoneCode || !leader.supervisorId) {
    return fail("This team leader is not assigned to a supervisor and zone.");
  }
  const zone = zoneByCode(state, leader.zoneCode);
  if (!zone || zone.supervisorId !== leader.supervisorId) {
    return fail("This team leader's zone does not match the assigned supervisor.");
  }
  if (!isZoneOpen(state, leader.zoneCode, at)) return fail(ZONE_CLOSED_MESSAGE);

  const lines = Array.isArray(input) ? input : (input.lines ?? []);
  const employees = Array.isArray(input) ? [] : (input.employees ?? []);
  if (lines.length + employees.reduce((sum, employee) => sum + employee.lines.length, 0) > 30) {
    return fail("A request can contain up to 30 materials.");
  }

  const buckets = new Map<string, { material: Material; quantity: string }>();
  const allocations: {
    employeeId: string;
    material: Material;
    quantity: string;
  }[] = [];
  const employeeIds = new Set<string>();

  function takeLine(materialId: string, quantityText: string, employeeId: string | null) {
    const material = materialById(state, materialId);
    if (!material || !material.active || !material.requestable) {
      return "One of the materials cannot be requested.";
    }
    const category = categoryFor(state, material.categoryId);
    if (material.categoryId && (!category || !category.active)) {
      return `${material.productName} is not available in an active category.`;
    }
    const quantity = parseQty(quantityText);
    if (!quantity || !isPositiveQty(quantity)) {
      return "Each quantity must be greater than zero.";
    }
    const ppe = isPpeMaterial(state, material);
    if (ppe && !employeeId) return "PPE items must be assigned to an employee ID.";
    if (!ppe && employeeId) return "Only PPE can be assigned to an employee ID.";
    const current = buckets.get(material.id);
    const total = current ? addQty(current.quantity, quantity) : quantity;
    if (!total) return "Each quantity must be greater than zero.";
    if (cmpQty(total, material.currentStock) > 0) {
      return `That quantity is not available for ${material.productName}.`;
    }
    buckets.set(material.id, { material, quantity: total });
    if (employeeId) allocations.push({ employeeId, material, quantity });
    return null;
  }

  const plainSeen = new Set<string>();
  for (const line of lines) {
    if (plainSeen.has(line.materialId)) return fail("Each material can appear once on a request.");
    plainSeen.add(line.materialId);
    const error = takeLine(line.materialId, line.quantity, null);
    if (error) return fail(error);
  }

  for (const employee of employees) {
    const employeeId = employee.employeeId.trim();
    if (!employeeId) return fail("Enter an employee ID for each person receiving PPE.");
    if (employeeId.length > 40) return fail("An employee ID is too long.");
    if (employee.lines.length === 0) {
      return fail(`Add at least one PPE item for ${employeeId}, or remove that employee.`);
    }
    if (employeeIds.has(employeeId)) {
      return fail("Enter each employee ID once. Add their PPE items in the same section.");
    }
    employeeIds.add(employeeId);
    const seen = new Set<string>();
    for (const line of employee.lines) {
      if (seen.has(line.materialId)) {
        return fail("Each PPE item can be chosen once for an employee.");
      }
      seen.add(line.materialId);
      const error = takeLine(line.materialId, line.quantity, employeeId);
      if (error) return fail(error);
    }
  }

  if (buckets.size === 0) return fail("Add at least one material.");

  const next = copy(state);
  const requestNo = next.nextRequestNo;
  next.nextRequestNo += 1;
  const id = crypto.randomUUID();
  next.requests.push({
    id,
    requestNo,
    zoneCode: leader.zoneCode,
    teamLeaderId: leader.id,
    supervisorId: leader.supervisorId,
    status: "PENDING",
    rejectionReason: null,
    createdAt: at,
    reviewedBy: null,
    reviewedAt: null,
    preparedBy: null,
    preparedAt: null,
    issuedBy: null,
    issuedAt: null,
    operationReviewedBy: null,
    operationReviewedAt: null,
    decisionKeys: [],
    items: [...buckets.values()].map((line) => ({
      id: crypto.randomUUID(),
      materialId: line.material.id,
      itemCode: line.material.itemCode,
      productName: line.material.productName,
      unit: line.material.unit,
      quantityRequested: line.quantity,
      quantityIssued: "0",
      decision: "PENDING" as const,
      approvedQuantity: "0",
      rejectionReason: null,
      decidedBy: null,
      decidedAt: null,
      omDecision: "PENDING" as const,
      omApprovedQuantity: "0",
      omRejectionReason: null,
      omDecidedBy: null,
      omDecidedAt: null,
    })),
    ppeAllocations: allocations.map((line) => ({
      id: crypto.randomUUID(),
      employeeId: line.employeeId,
      materialId: line.material.id,
      itemCode: line.material.itemCode,
      productName: line.material.productName,
      unit: line.material.unit,
      quantity: line.quantity,
    })),
    issueReceipts: [],
  });
  return ok(next, { requestNo });
}

/** Point one active supervisor at a zone. A zone keeps exactly one supervisor. */
function applySupervisorZone(state: Workspace, supervisorId: string, zoneCode: ZoneCode): string | null {
  if (!ZONE_CODES.includes(zoneCode)) return "That zone does not exist.";
  const zone = zoneByCode(state, zoneCode);
  const supervisor = userById(state, supervisorId);
  if (!zone || !supervisor || supervisor.role !== "SUPERVISOR" || !supervisor.active) {
    return "Choose an active supervisor.";
  }
  if (zone.supervisorId !== supervisorId) {
    const other = state.zones.find((item) => item.supervisorId === supervisorId);
    if (other) other.supervisorId = zone.supervisorId;
    zone.supervisorId = supervisorId;
    for (const leader of state.users) {
      if (leader.role !== "TEAM_LEADER" || !leader.zoneCode) continue;
      const home = zoneByCode(state, leader.zoneCode);
      if (home) leader.supervisorId = home.supervisorId;
    }
    reroutePending(state);
  }
  for (const user of state.users) {
    if (user.role !== "SUPERVISOR") continue;
    user.zoneCode = zoneOfSupervisor(state, user.id)?.code ?? null;
    user.supervisorId = null;
  }
  return null;
}

export function assignZoneSupervisor(
  state: Workspace,
  actor: DemoUser,
  zoneCode: ZoneCode,
  supervisorId: string,
): Mutation<null> {
  const denied = requireActive(actor, "ADMIN");
  if (denied) return fail(denied);
  const next = copy(state);
  const error = applySupervisorZone(next, supervisorId, zoneCode);
  if (error) return fail(error);
  return ok(next, null);
}

export function createSupervisorProfile(
  state: Workspace,
  actor: DemoUser,
  displayName: string,
): Mutation<null> {
  const denied = requireActive(actor, "ADMIN");
  if (denied) return fail(denied);
  const name = displayName.trim();
  if (!name || name.length > 80) return fail("Enter a display name.");
  const next = copy(state);
  next.users.push({
    id: crypto.randomUUID(),
    displayName: name,
    role: "SUPERVISOR",
    active: true,
    zoneCode: null,
    supervisorId: null,
  });
  return ok(next, null);
}

export function updateSupervisorProfile(
  state: Workspace,
  actor: DemoUser,
  input: { userId: string; displayName: string; active: boolean },
): Mutation<null> {
  const denied = requireActive(actor, "ADMIN");
  if (denied) return fail(denied);
  const name = input.displayName.trim();
  if (!name || name.length > 80) return fail("Enter a display name.");
  const next = copy(state);
  const supervisor = userById(next, input.userId);
  if (!supervisor || supervisor.role !== "SUPERVISOR") return fail("That supervisor was not found.");
  if (!input.active) {
    if (next.zones.some((zone) => zone.supervisorId === supervisor.id)) {
      return fail("Reassign that supervisor's zone before deactivating the user.");
    }
    if (next.users.some((user) => user.role === "TEAM_LEADER" && user.supervisorId === supervisor.id)) {
      return fail("Reassign that supervisor's team leaders before deactivating the user.");
    }
  }
  supervisor.displayName = name;
  supervisor.active = input.active;
  return ok(next, null);
}

export function assignTeamLeader(
  state: Workspace,
  actor: DemoUser,
  teamLeaderId: string,
  supervisorId: string,
): Mutation<null> {
  const denied = requireActive(actor, "ADMIN");
  if (denied) return fail(denied);
  const next = copy(state);
  const leader = userById(next, teamLeaderId);
  if (!leader || leader.role !== "TEAM_LEADER") return fail("Choose a team leader.");
  const error = placeTeamLeader(next, leader, supervisorId);
  if (error) return fail(error);
  reroutePending(next);
  return ok(next, null);
}

export function clearTeamLeaderAssignment(
  state: Workspace,
  actor: DemoUser,
  teamLeaderId: string,
): Mutation<null> {
  const denied = requireActive(actor, "ADMIN");
  if (denied) return fail(denied);
  const next = copy(state);
  const leader = userById(next, teamLeaderId);
  if (!leader || leader.role !== "TEAM_LEADER") return fail("Choose a team leader.");
  leader.supervisorId = null;
  leader.zoneCode = null;
  return ok(next, null);
}

export function updateDemoUser(
  state: Workspace,
  actor: DemoUser,
  input: {
    userId: string;
    displayName: string;
    role: Role;
    zoneCode: ZoneCode | null;
    supervisorId?: string | null;
    active: boolean;
    teamName?: string | null;
  },
): Mutation<null> {
  const denied = requireActive(actor, "ADMIN");
  if (denied) return fail(denied);
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 80) return fail("Enter a display name.");
  const next = copy(state);
  const user = userById(next, input.userId);
  if (!user) return fail("That user was not found.");

  if (!input.active) {
    if (next.zones.some((zone) => zone.supervisorId === user.id)) {
      return fail("Reassign that supervisor's zone before deactivating the user.");
    }
    if (user.role === "STORE_KEEPER") {
      const remaining = next.users.filter(
        (item) => item.role === "STORE_KEEPER" && item.active && item.id !== user.id,
      );
      if (remaining.length === 0) return fail("Keep at least one active store keeper.");
    }
  }
  if (user.role === "ADMIN" && (!input.active || input.role !== "ADMIN")) {
    const remaining = next.users.filter(
      (item) => item.role === "ADMIN" && item.active && item.id !== user.id,
    );
    if (remaining.length === 0) return fail("Keep at least one active administrator.");
  }

  if (user.role === "SUPERVISOR" && input.role !== "SUPERVISOR") {
    const assigned = next.zones.some((zone) => zone.supervisorId === user.id);
    if (assigned) {
      return fail("Reassign that supervisor's zone before changing the role.");
    }
  }

  user.displayName = displayName;
  user.role = input.role;
  user.active = input.active;
  if (input.role === "TEAM_LEADER") {
    if (!input.zoneCode) {
      if (user.zoneCode || user.supervisorId) return fail("A team leader must belong to a zone.");
      user.supervisorId = null;
      user.zoneCode = null;
    } else {
      const placed = placeTeamLeaderOnZone(next, user, input.zoneCode, input.supervisorId);
      if (placed) return fail(placed);
      reroutePending(next);
    }
  } else if (input.role === "SUPERVISOR") {
    user.supervisorId = null;
    if (input.zoneCode) {
      const error = applySupervisorZone(next, user.id, input.zoneCode);
      if (error) return fail(error);
    } else {
      user.zoneCode = zoneOfSupervisor(next, user.id)?.code ?? null;
    }
  } else {
    user.supervisorId = null;
    user.zoneCode = null;
  }
  if (input.teamName !== undefined) {
    const teamName = cleanTeamName(input.teamName);
    if ("error" in teamName) return fail(teamName.error);
    user.teamName = teamName.name;
  }
  return ok(next, null);
}

function placeTeamLeaderOnZone(
  state: Workspace,
  leader: DemoUser,
  zoneCode: ZoneCode | null,
  supervisorId?: string | null,
) {
  if (!zoneCode || !ZONE_CODES.includes(zoneCode)) return "A team leader must belong to a zone.";
  const zone = zoneByCode(state, zoneCode);
  if (!zone) return "That zone does not exist.";
  if (supervisorId && supervisorId !== zone.supervisorId) {
    return "That supervisor does not cover the selected zone.";
  }
  return placeTeamLeader(state, leader, supervisorId || zone.supervisorId);
}

export function addDemoUser(
  state: Workspace,
  actor: DemoUser,
  input: {
    displayName: string;
    role: Role;
    zoneCode: ZoneCode | null;
    supervisorId?: string | null;
    teamName?: string | null;
  },
): Mutation<string> {
  const denied = requireActive(actor, "ADMIN");
  if (denied) return fail(denied);
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 80) return fail("Enter a display name.");
  const teamName = cleanTeamName(input.teamName);
  if ("error" in teamName) return fail(teamName.error);
  if (input.role === "TEAM_LEADER" && !input.zoneCode) {
    return fail("A team leader must belong to a zone.");
  }
  const next = copy(state);
  const created: DemoUser = {
    id: crypto.randomUUID(),
    displayName,
    role: input.role,
    active: true,
    zoneCode: null,
    supervisorId: null,
    teamName: teamName.name,
  };
  next.users.push(created);
  if (input.role === "SUPERVISOR" && input.zoneCode) {
    const error = applySupervisorZone(next, created.id, input.zoneCode);
    if (error) return fail(error);
  }
  if (input.role === "TEAM_LEADER") {
    const placed = placeTeamLeaderOnZone(next, created, input.zoneCode, input.supervisorId);
    if (placed) return fail(placed);
  }
  return ok(next, created.id);
}

const defaultSupervisor: Record<ZoneCode, string> = {
  A: USER_IDS.supervisorA,
  B: USER_IDS.supervisorB,
  C: USER_IDS.supervisorC,
  D: USER_IDS.supervisorD,
  E: USER_IDS.supervisorE,
};

function intervalDaysError(days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    return "Enter a replacement interval from 1 to 3650 days.";
  }
  return null;
}

function cleanPpeIntervals(state: Workspace) {
  if (!Number.isInteger(state.ppeReplacementDays) || state.ppeReplacementDays < 1 || state.ppeReplacementDays > 3650) {
    state.ppeReplacementDays = 90;
  }
  const raw = Array.isArray(state.ppeIntervals) ? state.ppeIntervals : [];
  const cleaned: PpeReplacementInterval[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row.id !== "string" || !row.id.trim() || seen.has(row.id)) continue;
    if (!Number.isInteger(row.days) || row.days < 1 || row.days > 3650) continue;
    seen.add(row.id);
    cleaned.push({ id: row.id, days: row.days, active: row.active === true });
  }
  if (cleaned.length === 0) {
    cleaned.push({ id: crypto.randomUUID(), days: state.ppeReplacementDays, active: true });
  } else {
    const active = cleaned.filter((item) => item.active);
    const chosen = active.length === 1 ? active[0] : cleaned.find((item) => item.days === state.ppeReplacementDays) ?? cleaned[0];
    for (const item of cleaned) item.active = item.id === chosen.id;
    state.ppeReplacementDays = chosen.days;
  }
  state.ppeIntervals = cleaned;
}

export function setPpeReplacementDays(state: Workspace, actor: DemoUser, days: number): Mutation<null> {
  const denied = requireActive(actor, "OPERATION_MANAGER");
  if (denied) return fail(denied);
  const invalid = intervalDaysError(days);
  if (invalid) return fail(invalid);
  const next = copy(state);
  cleanPpeIntervals(next);
  const active = next.ppeIntervals.find((item) => item.active);
  if (next.ppeReplacementDays === days && active?.days === days) return ok(state, null, true);
  next.ppeReplacementDays = days;
  if (active) active.days = days;
  else next.ppeIntervals.push({ id: crypto.randomUUID(), days, active: true });
  return ok(next, null);
}

export function addPpeInterval(state: Workspace, actor: DemoUser, days: number): Mutation<string> {
  const denied = requireActive(actor, "OPERATION_MANAGER");
  if (denied) return fail(denied);
  const invalid = intervalDaysError(days);
  if (invalid) return fail(invalid);
  const next = copy(state);
  cleanPpeIntervals(next);
  const id = crypto.randomUUID();
  next.ppeIntervals.push({ id, days, active: false });
  return ok(next, id);
}

export function updatePpeInterval(state: Workspace, actor: DemoUser, id: string, days: number): Mutation<null> {
  const denied = requireActive(actor, "OPERATION_MANAGER");
  if (denied) return fail(denied);
  const invalid = intervalDaysError(days);
  if (invalid) return fail(invalid);
  const next = copy(state);
  cleanPpeIntervals(next);
  const row = next.ppeIntervals.find((item) => item.id === id);
  if (!row) return fail("That interval was not found.");
  if (row.days === days) return ok(state, null, true);
  row.days = days;
  if (row.active) next.ppeReplacementDays = days;
  return ok(next, null);
}

export function activatePpeInterval(state: Workspace, actor: DemoUser, id: string): Mutation<null> {
  const denied = requireActive(actor, "OPERATION_MANAGER");
  if (denied) return fail(denied);
  const next = copy(state);
  cleanPpeIntervals(next);
  const row = next.ppeIntervals.find((item) => item.id === id);
  if (!row) return fail("That interval was not found.");
  if (row.active) return ok(state, null, true);
  for (const item of next.ppeIntervals) item.active = item.id === id;
  next.ppeReplacementDays = row.days;
  return ok(next, null);
}

export function removePpeInterval(state: Workspace, actor: DemoUser, id: string): Mutation<null> {
  const denied = requireActive(actor, "OPERATION_MANAGER");
  if (denied) return fail(denied);
  const next = copy(state);
  cleanPpeIntervals(next);
  const row = next.ppeIntervals.find((item) => item.id === id);
  if (!row) return fail("That interval was not found.");
  if (row.active) {
    return fail("This interval is used for PPE eligibility. Activate another interval before removing it.");
  }
  next.ppeIntervals = next.ppeIntervals.filter((item) => item.id !== id);
  return ok(next, null);
}

function cleanZoneCalendar(state: Workspace) {
  if (!Array.isArray(state.zoneRequestDays)) state.zoneRequestDays = [];
  if (!Array.isArray(state.zoneRequestChanges)) state.zoneRequestChanges = [];
  const days = new Map<string, ZoneRequestDay>();
  for (const row of state.zoneRequestDays) {
    if (!row || !ZONE_CODES.includes(row.zoneCode)) continue;
    if (row.status !== "OPEN" && row.status !== "CLOSED") continue;
    if (!REQUEST_DATE.test(row.requestDate ?? "")) continue;
    const key = `${row.zoneCode}:${row.requestDate}`;
    const existing = days.get(key);
    if (!existing || (row.updatedAt ?? "") >= (existing.updatedAt ?? "")) {
      days.set(key, {
        id: typeof row.id === "string" && row.id ? row.id : crypto.randomUUID(),
        zoneCode: row.zoneCode,
        requestDate: row.requestDate,
        status: row.status,
        updatedBy: typeof row.updatedBy === "string" ? row.updatedBy : "",
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : row.createdAt,
        createdAt: typeof row.createdAt === "string" ? row.createdAt : row.updatedAt,
        note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
      });
    }
  }
  state.zoneRequestDays = [...days.values()];
  const changes: ZoneRequestChange[] = [];
  for (const row of state.zoneRequestChanges) {
    if (!row || !ZONE_CODES.includes(row.zoneCode)) continue;
    if (row.previousStatus !== "OPEN" && row.previousStatus !== "CLOSED") continue;
    if (row.newStatus !== "OPEN" && row.newStatus !== "CLOSED") continue;
    if (!REQUEST_DATE.test(row.requestDate ?? "")) continue;
    if (typeof row.changedAt !== "string") continue;
    changes.push({
      id: typeof row.id === "string" && row.id ? row.id : crypto.randomUUID(),
      zoneCode: row.zoneCode,
      requestDate: row.requestDate,
      previousStatus: row.previousStatus,
      newStatus: row.newStatus,
      changedBy: typeof row.changedBy === "string" ? row.changedBy : "",
      changedAt: row.changedAt,
      note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
    });
  }
  state.zoneRequestChanges = changes;
}

export function normalizeWorkspace(state: Workspace): Workspace {
  const next = structuredClone(state);
  cleanZoneCalendar(next);
  cleanPpeIntervals(next);
  if (!Array.isArray(next.zones)) next.zones = [];
  if (!Array.isArray(next.tickets)) next.tickets = [];
  if (!Array.isArray(next.users)) next.users = [];
  if (!Array.isArray(next.credentials)) next.credentials = [];
  if (!Array.isArray(next.sessions)) next.sessions = [];
  next.credentials = next.credentials.filter((row) => {
    return Boolean(
      row &&
        typeof row.userId === "string" &&
        typeof row.employeeId === "string" &&
        typeof row.email === "string" &&
        typeof row.passwordHash === "string" &&
        (row.passwordHash.startsWith("scrypt$") || row.passwordHash === ""),
    );
  });
  for (const credential of next.credentials) {
    credential.employeeId = credential.employeeId.trim();
    credential.email = credential.email.trim().toLowerCase();
  }
  next.sessions = next.sessions.filter((row) => {
    return Boolean(
      row &&
        typeof row.id === "string" &&
        typeof row.tokenHash === "string" &&
        typeof row.userId === "string" &&
        typeof row.createdAt === "string" &&
        typeof row.expiresAt === "string",
    );
  });
  if (!next.users.some((user) => user.role === "OPERATION_MANAGER")) {
    next.users.push({
      id: "user-operation-manager",
      displayName: "Operation Manager (demo)",
      role: "OPERATION_MANAGER",
      active: true,
      zoneCode: null,
      supervisorId: null,
    });
  }
  for (const code of ZONE_CODES) {
    if (!next.zones.some((zone) => zone.code === code)) {
      next.zones.push({
        code,
        name: ZONE_NAMES[code],
        supervisorId: defaultSupervisor[code],
      });
    }
  }
  for (const user of next.users) {
    if (typeof user.supervisorId !== "string") user.supervisorId = null;
    const teamName = cleanTeamName(typeof user.teamName === "string" ? user.teamName : null);
    user.teamName = "error" in teamName ? user.teamName?.trim().slice(0, 80) || null : teamName.name;
  }
  for (const user of next.users) {
    if (user.role !== "SUPERVISOR") continue;
    user.zoneCode = zoneOfSupervisor(next, user.id)?.code ?? null;
    user.supervisorId = null;
  }
  for (const user of next.users) {
    if (user.role !== "TEAM_LEADER") {
      if (user.role !== "SUPERVISOR") user.supervisorId = null;
      continue;
    }
    if (!user.supervisorId && user.zoneCode) {
      user.supervisorId = zoneByCode(next, user.zoneCode)?.supervisorId ?? null;
    }
    if (user.supervisorId) {
      user.zoneCode = zoneOfSupervisor(next, user.supervisorId)?.code ?? null;
    } else {
      user.zoneCode = null;
    }
  }
  if (!Array.isArray(next.categories)) next.categories = [];
  const defaultCategories: MaterialCategory[] = [
    { id: "cat-pesticides", name: "Pesticides", requiresEmployee: false, active: true, position: 1, updatedAt: "2026-10-25T06:00:00.000Z" },
    { id: "cat-ppe", name: "PPE", requiresEmployee: true, active: true, position: 2, updatedAt: "2026-10-25T06:00:00.000Z" },
    { id: "cat-equipment", name: "Equipment", requiresEmployee: false, active: true, position: 3, updatedAt: "2026-10-25T06:00:00.000Z" },
    { id: "cat-other", name: "Other", requiresEmployee: false, active: true, position: 4, updatedAt: "2026-10-25T06:00:00.000Z" },
  ];
  for (const category of defaultCategories) {
    if (!next.categories.some((item) => item.id === category.id)) next.categories.push(category);
  }
  const ppe = next.categories.find((category) => category.id === "cat-ppe");
  if (ppe) ppe.requiresEmployee = true;
  if (!Array.isArray(next.materials)) next.materials = [];
  for (const material of next.materials) {
    if (typeof material.categoryId !== "string") material.categoryId = null;
  }
  if (!Array.isArray(next.movements)) next.movements = [];
  for (const movement of next.movements) {
    if (typeof movement.reference !== "string") movement.reference = null;
    if (typeof movement.supplier !== "string") movement.supplier = null;
    if (typeof movement.notes !== "string") movement.notes = null;
    if (typeof movement.receiptDate !== "string") movement.receiptDate = null;
    if (typeof movement.idempotencyKey !== "string") movement.idempotencyKey = null;
    if (typeof movement.reversesMovementId !== "string") movement.reversesMovementId = null;
    if (movement.requestId && !movement.reference) {
      const request = next.requests.find((item) => item.id === movement.requestId);
      if (request) movement.reference = `MR-${request.requestNo}`;
    }
  }
  if (!Array.isArray(next.approvals)) next.approvals = [];
  for (const record of next.approvals) {
    if (record.stage !== "SUPERVISOR" && record.stage !== "OPERATION_MANAGER") record.stage = "SUPERVISOR";
  }
  const storeReady = new Set<RequestStatus>([
    "APPROVED",
    "FULLY_APPROVED",
    "PARTIALLY_APPROVED",
    "PREPARED",
    "ISSUED",
    "OPERATION_MANAGER_APPROVED",
  ]);
  for (const request of next.requests ?? []) {
    if (!Array.isArray(request.ppeAllocations)) request.ppeAllocations = [];
    if (!Array.isArray(request.decisionKeys)) request.decisionKeys = [];
    if (!Array.isArray(request.issueReceipts)) request.issueReceipts = [];
    if (typeof request.operationReviewedBy !== "string") request.operationReviewedBy = null;
    if (typeof request.operationReviewedAt !== "string") request.operationReviewedAt = null;
    const legacyStatus = request.status;
    for (const item of request.items ?? []) {
      const known =
        item.decision === "PENDING" || item.decision === "APPROVED" || item.decision === "REJECTED";
      if (!known) {
        if (legacyStatus === "REJECTED") {
          item.decision = "REJECTED";
          item.approvedQuantity = "0";
          item.rejectionReason = item.rejectionReason ?? request.rejectionReason;
          item.decidedBy = item.decidedBy ?? request.reviewedBy;
          item.decidedAt = item.decidedAt ?? request.reviewedAt;
        } else if (legacyStatus === "PENDING") {
          item.decision = "PENDING";
          item.approvedQuantity = "0";
          item.rejectionReason = null;
          item.decidedBy = null;
          item.decidedAt = null;
        } else {
          item.decision = "APPROVED";
          item.approvedQuantity = item.quantityRequested;
          item.rejectionReason = null;
          item.decidedBy = item.decidedBy ?? request.reviewedBy;
          item.decidedAt = item.decidedAt ?? request.reviewedAt;
        }
      }
      if (typeof item.approvedQuantity !== "string") {
        item.approvedQuantity = item.decision === "APPROVED" ? item.quantityRequested : "0";
      }
      if (item.decision === "REJECTED") item.approvedQuantity = "0";
      if (typeof item.rejectionReason !== "string") item.rejectionReason = null;
      if (typeof item.decidedBy !== "string") item.decidedBy = null;
      if (typeof item.decidedAt !== "string") item.decidedAt = null;
      if (typeof item.quantityIssued !== "string") item.quantityIssued = "0";
      const knownOperation =
        item.omDecision === "PENDING" || item.omDecision === "APPROVED" || item.omDecision === "REJECTED";
      if (!knownOperation) {
        if (storeReady.has(legacyStatus) && item.decision === "APPROVED") {
          item.omDecision = "APPROVED";
          item.omApprovedQuantity = item.approvedQuantity || item.quantityRequested;
          item.omRejectionReason = null;
          item.omDecidedBy = null;
          item.omDecidedAt = request.reviewedAt;
        } else {
          item.omDecision = "PENDING";
          item.omApprovedQuantity = "0";
          item.omRejectionReason = null;
          item.omDecidedBy = null;
          item.omDecidedAt = null;
        }
      }
      if (typeof item.omApprovedQuantity !== "string") {
        item.omApprovedQuantity = item.omDecision === "APPROVED" ? item.approvedQuantity || "0" : "0";
      }
      if (item.omDecision === "REJECTED") item.omApprovedQuantity = "0";
      if (typeof item.omRejectionReason !== "string") item.omRejectionReason = null;
      if (typeof item.omDecidedBy !== "string") item.omDecidedBy = null;
      if (typeof item.omDecidedAt !== "string") item.omDecidedAt = null;
    }
    if (legacyStatus !== "PREPARED" && legacyStatus !== "ISSUED") {
      request.status = deriveStatus(request);
      request.rejectionReason = request.status === "PENDING" ? null : rejectionSummary(request);
    }
  }
  for (const request of next.requests ?? []) {
    if (request.status !== "ISSUED") continue;
    const supervisorId = request.reviewedBy ?? request.supervisorId;
    if (!supervisorId) continue;
    appendIssuedTicket(next, request, supervisorId, request.zoneCode);
  }
  for (const ticket of next.tickets ?? []) {
    const request = next.requests.find((item) => item.id === ticket.requestId);
    for (const line of ticket.lines) {
      if (typeof line.approved === "string") continue;
      const item = request?.items.find((entry) => entry.id === line.itemId || entry.itemCode === line.itemCode);
      line.approved =
        item && item.decision === "APPROVED"
          ? item.approvedQuantity || line.requested
          : line.requested;
    }
  }
  next.zones = sortByZone(next.zones);
  next.version = 1;
  return next;
}

export { ZONE_NAMES };
