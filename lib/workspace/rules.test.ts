import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { addQty, subQty } from "./decimal";
import { CATEGORY_IDS, MATERIAL_IDS, USER_IDS, createSeed as createClosedSeed } from "./seed";
import {
  adjustStock,
  approveRequest,
  bulkApproveRequests,
  decideRequestItems,
  decideOperationItems,
  bulkApproveOperationLines,
  rejectOperationLine,
  assignTeamLeader,
  assignZoneSupervisor,
  clearTeamLeaderAssignment,
  createCategory,
  createMaterial,
  createTeamRequest,
  damageStock,
  deleteMaterial,
  updateCategory,
  isWaitingToIssue,
  issueRequest,
  normalizeWorkspace,
  prepareRequest,
  receiveStock,
  setMaterialActive,
  setZoneRequestStatus,
} from "./rules";
import type { DemoUser, Workspace } from "./types";
import { ZONE_CODES } from "./types";
import {
  buildTicket,
  projectIssueBoard,
  projectOperationHome,
  projectOperationReview,
  projectRequestDetail,
  projectSupervisor,
  projectSupervisorReview,
  projectTeamLeader,
  stockSignal,
  stockSnapshot,
  ticketForActor,
} from "./views";

const at = "2026-10-25T12:00:00.000Z";

function user(state: Workspace, id: string): DemoUser {
  const found = state.users.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

function stockOf(state: Workspace, id: string) {
  return state.materials.find((item) => item.id === id)?.currentStock;
}

function releaseToStore(state: Workspace, requestId: string, key: string) {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) throw new Error(requestId);
  return decideOperationItems(
    state,
    user(state, USER_IDS.operationManager),
    requestId,
    request.items
      .filter((item) => item.decision === "APPROVED")
      .map((item) => ({
        itemId: item.id,
        decision: "APPROVED" as const,
        approvedQuantity: item.approvedQuantity,
        rejectionReason: "",
      })),
    key,
    at,
  );
}

assert.equal(addQty("0.1", "0.2"), "0.3");
assert.equal(subQty("30.7", "3.4"), "27.3");
assert.equal(subQty("27.3", "2.0"), "25.3");

function openAllZones(state: Workspace, when: string) {
  let next = state;
  for (const code of ZONE_CODES) {
    const opened = setZoneRequestStatus(
      next,
      user(next, USER_IDS.operationManager),
      { zoneCode: code, status: "OPEN" },
      when,
    );
    if (!opened.ok) throw new Error(opened.error);
    next = opened.state;
  }
  return next;
}

function createSeed() {
  return openAllZones(createClosedSeed(), at);
}

const seed = createSeed();
assert.deepEqual(
  seed.zones.map((zone) => zone.name),
  ["ZONE A", "ZONE B", "ZONE C", "ZONE D", "ZONE E"],
);
assert.deepEqual(
  ZONE_CODES.map((code) => code),
  ["A", "B", "C", "D", "E"],
);

const reversed: Workspace = { ...seed, zones: [...seed.zones].reverse() };
const board = projectIssueBoard(reversed, ["APPROVED", "PREPARED"]);
assert.deepEqual(
  board.zones.map((zone) => zone.name),
  ["ZONE A", "ZONE B", "ZONE C", "ZONE D", "ZONE E"],
);
const queuedIds = board.zones.flatMap((zone) =>
  zone.leaders.flatMap((leader) => leader.requests.map((request) => request.requestNo)),
);
assert.deepEqual(queuedIds.sort(), ["MR-3", "MR-4", "MR-5", "MR-6"]);
assert.equal(queuedIds.includes("MR-1"), false);
assert.equal(queuedIds.includes("MR-2"), false);
assert.equal(queuedIds.includes("MR-7"), false);
assert.equal(board.zones[0]?.leaders.length, 2);
for (const request of seed.requests) {
  if (request.status === "PENDING" || request.status === "REJECTED" || request.status === "ISSUED") {
    assert.equal(isWaitingToIssue(request.status), false);
  }
}

const keeper = user(seed, USER_IDS.storeKeeper);
const supervisorA = user(seed, USER_IDS.supervisorA);
const supervisorB = user(seed, USER_IDS.supervisorB);
assert.equal(approveRequest(seed, keeper, "req-1", at).ok, false);
assert.equal(approveRequest(seed, supervisorB, "req-1", at).ok, false);
const approved = approveRequest(seed, supervisorA, "req-1", at);
assert.equal(approved.ok, true);
if (!approved.ok) throw new Error("approve");
assert.deepEqual(stockSnapshot(approved.state), stockSnapshot(seed));
assert.equal(approved.state.requests.find((request) => request.id === "req-1")?.status, "PENDING_OPERATION_MANAGER");
assert.equal(prepareRequest(approved.state, keeper, "req-1", at).ok, false);
assert.equal(approved.state.approvals.length, 1);
const approvedAgain = approveRequest(approved.state, supervisorA, "req-1", at);
assert.equal(approvedAgain.ok && approvedAgain.replayed, true);
assert.equal(approvedAgain.ok ? approvedAgain.state.approvals.length : -1, 1);
const preparedStock = stockSnapshot(seed);
const prepared = prepareRequest(seed, keeper, "req-3", at);
assert.equal(prepared.ok, true);
if (!prepared.ok) throw new Error("prepare");
assert.deepEqual(stockSnapshot(prepared.state), preparedStock);
assert.equal(issueRequest(seed, keeper, "req-3", [{ itemId: "req-3-line", quantity: "1.0" }], "early", at).ok, false);

const beforeIssue = stockOf(seed, MATERIAL_IDS.actellic);
const ticketBefore = JSON.stringify(stockSnapshot(seed));
const ticket = buildTicket(seed, "req-6");
assert.equal(ticket?.ticketNo, "MIT-0006");
assert.equal(JSON.stringify(stockSnapshot(seed)), ticketBefore);
assert.equal(buildTicket(seed, "req-1"), null);

const issued = issueRequest(
  seed,
  keeper,
  "req-6",
  [{ itemId: "req-6-line", quantity: "2.0" }],
  "key-1",
  at,
);
assert.equal(issued.ok, true);
if (!issued.ok) throw new Error("issue");
assert.equal(issued.state.requests.find((request) => request.id === "req-6")?.status, "ISSUED");
assert.equal(stockOf(issued.state, MATERIAL_IDS.actellic), "25.3");
assert.notEqual(stockOf(issued.state, MATERIAL_IDS.actellic), beforeIssue);
const replay = issueRequest(
  issued.state,
  keeper,
  "req-6",
  [{ itemId: "req-6-line", quantity: "2.0" }],
  "key-1",
  "2026-10-25T12:05:00.000Z",
);
assert.equal(replay.ok && replay.replayed, true);
if (!replay.ok) throw new Error("replay");
assert.equal(stockOf(replay.state, MATERIAL_IDS.actellic), "25.3");

const partialPrep = prepareRequest(seed, keeper, "req-3", at);
assert.equal(partialPrep.ok, true);
if (!partialPrep.ok) throw new Error("partial prepare");
const partial = issueRequest(
  partialPrep.state,
  keeper,
  "req-3",
  [{ itemId: "req-3-line", quantity: "1.0" }],
  "part-1",
  at,
);
assert.equal(partial.ok, true);
if (!partial.ok) throw new Error("partial");
assert.equal(partial.state.requests.find((request) => request.id === "req-3")?.status, "PREPARED");
assert.equal(stockOf(partial.state, MATERIAL_IDS.biopren), "100.7");
const rest = issueRequest(
  partial.state,
  keeper,
  "req-3",
  [{ itemId: "req-3-line", quantity: "1.5" }],
  "part-2",
  "2026-10-25T12:10:00.000Z",
);
assert.equal(rest.ok, true);
if (!rest.ok) throw new Error("rest");
assert.equal(rest.state.requests.find((request) => request.id === "req-3")?.status, "ISSUED");
assert.equal(stockOf(rest.state, MATERIAL_IDS.biopren), "99.2");
assert.equal(rest.state.materials.find((item) => item.id === MATERIAL_IDS.biopren)?.out, "2.5");
assert.equal(rest.state.materials.find((item) => item.id === MATERIAL_IDS.biopren)?.beginningInventory, "101.7");

const tooMuch = damageStock(seed, keeper, MATERIAL_IDS.actellic, "1000", "Broken container", at);
assert.equal(tooMuch.ok, false);
assert.equal(stockOf(seed, MATERIAL_IDS.actellic), "27.3");

const deactivated = setMaterialActive(seed, keeper, MATERIAL_IDS.actellic, false, at);
assert.equal(deactivated.ok, true);
if (!deactivated.ok) throw new Error("deactivate");
assert.equal(
  deactivated.state.materials.some((item) => item.id === MATERIAL_IDS.actellic && !item.active),
  true,
);
assert.equal(
  deactivated.state.requests.some((request) =>
    request.items.some((item) => item.materialId === MATERIAL_IDS.actellic),
  ),
  true,
);

const blankReceipt = receiveStock(
  seed,
  keeper,
  {
    materialId: MATERIAL_IDS.actellic,
    quantity: "2.0",
    receiptDate: "2026-10-25",
    reference: "",
    supplier: "",
    notes: "",
    idempotencyKey: "receipt-1",
  },
  at,
);
assert.equal(blankReceipt.ok, false);
const received = receiveStock(
  seed,
  keeper,
  {
    materialId: MATERIAL_IDS.actellic,
    quantity: "2.0",
    receiptDate: "2026-10-25",
    reference: "GRN-100",
    supplier: "Local supplier",
    notes: "Morning delivery",
    idempotencyKey: "receipt-1",
  },
  at,
);
assert.equal(received.ok, true);
if (!received.ok) throw new Error("receipt");
assert.equal(stockOf(received.state, MATERIAL_IDS.actellic), "29.3");
assert.equal(received.state.materials.find((item) => item.id === MATERIAL_IDS.actellic)?.newStock, "2.0");
assert.equal(received.state.materials.find((item) => item.id === MATERIAL_IDS.actellic)?.beginningInventory, "27.3");
const replayed = receiveStock(
  received.state,
  keeper,
  {
    materialId: MATERIAL_IDS.actellic,
    quantity: "2.0",
    receiptDate: "2026-10-25",
    reference: "GRN-100",
    supplier: "Local supplier",
    notes: "Morning delivery",
    idempotencyKey: "receipt-1",
  },
  at,
);
assert.equal(replayed.ok && replayed.replayed, true);
assert.equal(stockOf(replayed.ok ? replayed.state : seed, MATERIAL_IDS.actellic), "29.3");
const duplicateRef = receiveStock(
  received.state,
  keeper,
  {
    materialId: MATERIAL_IDS.actellic,
    quantity: "1.0",
    receiptDate: "2026-10-25",
    reference: "grn-100",
    supplier: "",
    notes: "",
    idempotencyKey: "receipt-2",
  },
  at,
);
assert.equal(duplicateRef.ok, false);
assert.equal(adjustStock(seed, keeper, { materialId: MATERIAL_IDS.actellic, mode: "decrease", quantity: "1", reason: " ", reference: "", idempotencyKey: "adj-1" }, at).ok, false);
const adjusted = adjustStock(
  seed,
  keeper,
  { materialId: MATERIAL_IDS.actellic, mode: "decrease", quantity: "0.3", reason: "Spillage", reference: "ADJ-1", idempotencyKey: "adj-1" },
  at,
);
assert.equal(adjusted.ok, true);
if (!adjusted.ok) throw new Error("adjust");
assert.equal(stockOf(adjusted.state, MATERIAL_IDS.actellic), "27.0");
assert.equal(adjusted.state.materials.find((item) => item.id === MATERIAL_IDS.actellic)?.out, "0.0");
const created = createMaterial(
  seed,
  keeper,
  { itemCode: "TMP-1", productName: "Temporary item", activeIngredient: "", unit: "PCS", currentStock: "0", requestable: false, categoryId: null },
  at,
);
assert.equal(created.ok, true);
if (!created.ok) throw new Error("create");
const temporary = created.state.materials.find((item) => item.itemCode === "TMP-1");
assert.equal(temporary !== undefined, true);
assert.equal(deleteMaterial(created.state, keeper, temporary?.id ?? "").ok, true);
assert.equal(deleteMaterial(seed, keeper, MATERIAL_IDS.actellic).ok, false);

const leaderView = projectTeamLeader(seed, user(seed, USER_IDS.leaderA));
const leaderJson = JSON.stringify(leaderView);
assert.equal(leaderJson.includes("currentStock"), false);
assert.equal(leaderJson.includes("27.3"), false);
assert.equal(leaderJson.includes("101.7"), false);
assert.equal(leaderView.requests.some((request) => request.requestNo === "MR-4"), false);
assert.equal(leaderView.materials.some((material) => material.itemCode === "PST-0001"), false);

const admin = user(seed, USER_IDS.admin);
const supervisorC = user(seed, USER_IDS.supervisorC);
const supervisorD = user(seed, USER_IDS.supervisorD);
const homeD = projectSupervisor(seed, supervisorD);
const homeA = projectSupervisor(seed, supervisorA);
const homeB = projectSupervisor(seed, supervisorB);
assert.equal(homeD.tickets.some((ticket) => ticket.ticketNo === "MIT-0007"), true);
assert.equal(homeD.tickets.find((ticket) => ticket.ticketNo === "MIT-0007")?.lines[0]?.issued, "3.0");
assert.equal(homeA.tickets.some((ticket) => ticket.ticketNo === "MIT-0007"), false);
assert.equal(homeB.tickets.length, 0);
assert.equal(homeA.pending.some((request) => request.requestNo === "MR-1"), true);
assert.equal(homeB.pending.some((request) => request.requestNo === "MR-1"), false);
assert.equal(homeA.approved.some((request) => request.requestNo === "MR-3"), true);
assert.equal(homeA.pending.some((request) => request.requestNo === "MR-3"), false);
assert.equal(homeA.approved.find((request) => request.requestNo === "MR-3")?.ticketState, "none");
assert.equal(homeD.issued.some((request) => request.requestNo === "MR-7"), true);
assert.equal(homeD.issued.find((request) => request.requestNo === "MR-7")?.ticketNo, "MIT-0007");
assert.equal(homeD.issued.find((request) => request.requestNo === "MR-7")?.ticketState, "final");
assert.equal(homeD.tickets.find((ticket) => ticket.ticketNo === "MIT-0007")?.lines[0]?.approved, "3.0");
assert.equal(homeA.issued.some((request) => request.requestNo === "MR-7"), false);
assert.equal(homeB.rejected.some((request) => request.requestNo === "MR-2"), true);
assert.equal(homeA.rejected.some((request) => request.requestNo === "MR-2"), false);
const homeAIds = [...homeA.pending, ...homeA.approved, ...homeA.issued, ...homeA.rejected].map(
  (request) => request.id,
);
assert.equal(new Set(homeAIds).size, homeAIds.length);

const issuedTickets = issued.state.tickets.filter((ticket) => ticket.requestId === "req-6");
assert.equal(issuedTickets.length, 1);
assert.equal(issuedTickets[0]?.supervisorId, USER_IDS.supervisorB);
assert.equal(issuedTickets[0]?.lines[0]?.issued, "2.0");
assert.equal(issuedTickets[0]?.lines[0]?.requested, "2.0");
const secondKey = issueRequest(
  issued.state,
  keeper,
  "req-6",
  [{ itemId: "req-6-line", quantity: "2.0" }],
  "key-2",
  "2026-10-25T12:06:00.000Z",
);
assert.equal(secondKey.ok, false);
assert.equal(
  issued.state.tickets.filter((ticket) => ticket.requestId === "req-6").length,
  1,
);
const printed = buildTicket(issued.state, "req-6");
assert.equal(printed?.lines[0]?.issued, "2.0");
assert.equal(stockOf(issued.state, MATERIAL_IDS.actellic), "25.3");
assert.equal(ticketForActor(issued.state, supervisorA, "req-6"), null);
assert.equal(ticketForActor(issued.state, supervisorB, "req-6")?.ticketNo, "MIT-0006");
assert.equal(partial.state.tickets.some((ticket) => ticket.requestId === "req-3"), false);
const partialCard = projectSupervisor(partial.state, supervisorA).issued.find((request) => request.id === "req-3");
assert.equal(partialCard?.status, "PREPARED");
assert.equal(partialCard?.ticketState, "in-progress");
assert.equal(partialCard?.totalApproved, "2.5 KG");
assert.equal(partialCard?.totalIssued, "1.0 KG");
assert.equal(projectSupervisor(partial.state, supervisorB).issued.some((request) => request.id === "req-3"), false);
const partialLive = ticketForActor(partial.state, supervisorA, "req-3");
assert.equal(partialLive?.lines[0]?.approved, "2.5");
assert.equal(partialLive?.lines[0]?.issued, "1.0");
assert.equal(ticketForActor(partial.state, supervisorB, "req-3"), null);
assert.equal(stockOf(partial.state, MATERIAL_IDS.biopren), "100.7");
assert.equal(rest.state.tickets.filter((ticket) => ticket.requestId === "req-3").length, 1);
assert.equal(
  rest.state.tickets.find((ticket) => ticket.requestId === "req-3")?.lines[0]?.issued,
  "2.5",
);

const flow = createSeed();
const moved = assignTeamLeader(flow, admin, USER_IDS.leaderE, USER_IDS.supervisorA);
assert.equal(moved.ok, true);
if (!moved.ok) throw new Error("assign leader");
const movedLeader = moved.state.users.find((item) => item.id === USER_IDS.leaderE);
assert.equal(movedLeader?.supervisorId, USER_IDS.supervisorA);
assert.equal(movedLeader?.zoneCode, "A");
assert.equal(
  moved.state.users.filter(
    (item) => item.id === USER_IDS.leaderE && item.supervisorId === USER_IDS.supervisorA,
  ).length,
  1,
);
const submitted = createTeamRequest(
  moved.state,
  user(moved.state, USER_IDS.leaderE),
  [{ materialId: MATERIAL_IDS.actellic, quantity: "1.0" }],
  at,
);
assert.equal(submitted.ok, true);
if (!submitted.ok) throw new Error("submit");
const createdRequest = submitted.state.requests.find((request) => request.requestNo === submitted.data.requestNo);
assert.equal(createdRequest?.zoneCode, "A");
assert.equal(createdRequest?.supervisorId, USER_IDS.supervisorA);
assert.equal(createdRequest?.teamLeaderId, USER_IDS.leaderE);
assert.equal(approveRequest(submitted.state, supervisorB, createdRequest?.id ?? "", at).ok, false);
const flowApproved = approveRequest(
  submitted.state,
  supervisorA,
  createdRequest?.id ?? "",
  at,
);
assert.equal(flowApproved.ok, true);
if (!flowApproved.ok) throw new Error("flow approve");
assert.deepEqual(stockSnapshot(flowApproved.state), stockSnapshot(submitted.state));
assert.equal(prepareRequest(flowApproved.state, keeper, createdRequest?.id ?? "", at).ok, false);
const flowReleased = releaseToStore(flowApproved.state, createdRequest?.id ?? "", "flow-om");
assert.equal(flowReleased.ok, true);
if (!flowReleased.ok) throw new Error("flow operation");
const flowPrepared = prepareRequest(flowReleased.state, keeper, createdRequest?.id ?? "", at);
assert.equal(flowPrepared.ok, true);
if (!flowPrepared.ok) throw new Error("flow prepare");
assert.deepEqual(stockSnapshot(flowPrepared.state), stockSnapshot(flowApproved.state));
const beforeFlowIssue = stockOf(flowPrepared.state, MATERIAL_IDS.actellic);
const flowIssued = issueRequest(
  flowPrepared.state,
  keeper,
  createdRequest?.id ?? "",
  [{ itemId: createdRequest?.items[0]?.id ?? "", quantity: "1.0" }],
  "flow-issue",
  at,
);
assert.equal(flowIssued.ok, true);
if (!flowIssued.ok) throw new Error("flow issue");
assert.equal(stockOf(flowIssued.state, MATERIAL_IDS.actellic), "26.3");
assert.notEqual(stockOf(flowIssued.state, MATERIAL_IDS.actellic), beforeFlowIssue);
const flowTicket = flowIssued.state.tickets.find((ticket) => ticket.requestId === createdRequest?.id);
assert.equal(flowTicket?.supervisorId, USER_IDS.supervisorA);
assert.equal(flowTicket?.lines[0]?.issued, "1.0");
assert.equal(flowIssued.state.tickets.filter((ticket) => ticket.requestId === createdRequest?.id).length, 1);
const flowReplay = issueRequest(
  flowIssued.state,
  keeper,
  createdRequest?.id ?? "",
  [{ itemId: createdRequest?.items[0]?.id ?? "", quantity: "1.0" }],
  "flow-issue",
  "2026-10-25T12:20:00.000Z",
);
assert.equal(flowReplay.ok && flowReplay.replayed, true);
assert.equal(stockOf(flowIssued.state, MATERIAL_IDS.actellic), "26.3");
const stockBeforePrint = stockOf(flowIssued.state, MATERIAL_IDS.actellic);
const supervisorView = projectSupervisor(flowIssued.state, supervisorA);
const otherView = projectSupervisor(flowIssued.state, supervisorB);
assert.equal(supervisorView.tickets.some((ticket) => ticket.ticketNo === flowTicket?.ticketNo), true);
assert.equal(otherView.tickets.some((ticket) => ticket.ticketNo === flowTicket?.ticketNo), false);
assert.equal(stockOf(flowIssued.state, MATERIAL_IDS.actellic), stockBeforePrint);
assert.equal(ticketForActor(flowIssued.state, keeper, createdRequest?.id ?? "")?.lines[0]?.issued, "1.0");

const reassigned = assignTeamLeader(
  flowIssued.state,
  admin,
  USER_IDS.leaderE,
  USER_IDS.supervisorB,
);
assert.equal(reassigned.ok, true);
if (!reassigned.ok) throw new Error("reassign");
const reassignedLeader = reassigned.state.users.find((item) => item.id === USER_IDS.leaderE);
assert.equal(reassignedLeader?.supervisorId, USER_IDS.supervisorB);
assert.equal(reassignedLeader?.zoneCode, "B");
assert.equal(
  reassigned.state.users.filter((item) => item.id === USER_IDS.leaderE && item.supervisorId).length,
  1,
);
const historical = reassigned.state.tickets.find((ticket) => ticket.requestId === createdRequest?.id);
assert.equal(historical?.supervisorId, USER_IDS.supervisorA);
assert.equal(historical?.lines[0]?.issued, "1.0");
assert.equal(
  reassigned.state.requests.find((request) => request.id === createdRequest?.id)?.zoneCode,
  "A",
);
assert.equal(projectSupervisor(reassigned.state, supervisorA).tickets.some((ticket) => ticket.requestId === createdRequest?.id), true);
assert.equal(projectSupervisor(reassigned.state, supervisorB).tickets.some((ticket) => ticket.requestId === createdRequest?.id), false);
const nextRequest = createTeamRequest(
  reassigned.state,
  user(reassigned.state, USER_IDS.leaderE),
  [{ materialId: MATERIAL_IDS.rotryn, quantity: "1.0" }],
  "2026-10-25T13:00:00.000Z",
);
assert.equal(nextRequest.ok, true);
if (!nextRequest.ok) throw new Error("next request");
const routed = nextRequest.state.requests.find((request) => request.requestNo === nextRequest.data.requestNo);
assert.equal(routed?.zoneCode, "B");
assert.equal(routed?.supervisorId, USER_IDS.supervisorB);
assert.equal(approveRequest(nextRequest.state, supervisorA, routed?.id ?? "", at).ok, false);
const routedApproved = approveRequest(nextRequest.state, supervisorB, routed?.id ?? "", at);
assert.equal(routedApproved.ok, true);
if (!routedApproved.ok) throw new Error("routed approve");
const routedReleased = releaseToStore(routedApproved.state, routed?.id ?? "", "routed-om");
assert.equal(routedReleased.ok, true);
if (!routedReleased.ok) throw new Error("routed operation");
const routedPrepared = prepareRequest(routedReleased.state, keeper, routed?.id ?? "", at);
assert.equal(routedPrepared.ok, true);
if (!routedPrepared.ok) throw new Error("routed prepare");
const routedIssued = issueRequest(
  routedPrepared.state,
  keeper,
  routed?.id ?? "",
  [{ itemId: routed?.items[0]?.id ?? "", quantity: "1.0" }],
  "routed-issue",
  "2026-10-25T13:10:00.000Z",
);
assert.equal(routedIssued.ok, true);
if (!routedIssued.ok) throw new Error("routed issue");
assert.equal(
  routedIssued.state.tickets.find((ticket) => ticket.requestId === routed?.id)?.supervisorId,
  USER_IDS.supervisorB,
);
assert.equal(projectSupervisor(routedIssued.state, supervisorB).tickets.some((ticket) => ticket.requestId === routed?.id), true);
assert.equal(projectSupervisor(routedIssued.state, supervisorA).tickets.some((ticket) => ticket.requestId === routed?.id), false);
assert.equal(projectSupervisor(routedIssued.state, supervisorA).tickets.some((ticket) => ticket.requestId === createdRequest?.id), true);

const cleared = clearTeamLeaderAssignment(seed, admin, USER_IDS.leaderA);
assert.equal(cleared.ok, true);
if (!cleared.ok) throw new Error("clear");
assert.equal(cleared.state.users.some((item) => item.id === USER_IDS.leaderA), true);
assert.equal(cleared.state.users.find((item) => item.id === USER_IDS.leaderA)?.supervisorId, null);
assert.equal(cleared.state.requests.some((request) => request.id === "req-1"), true);
assert.equal(
  createTeamRequest(
    cleared.state,
    user(cleared.state, USER_IDS.leaderA),
    [{ materialId: MATERIAL_IDS.actellic, quantity: "1.0" }],
    at,
  ).ok,
  false,
);
assert.equal(approveRequest(cleared.state, supervisorA, "req-1", at).ok, false);
assert.equal(assignTeamLeader(seed, keeper, USER_IDS.leaderE, USER_IDS.supervisorA).ok, false);
assert.equal(assignTeamLeader(seed, supervisorA, USER_IDS.leaderE, USER_IDS.supervisorC).ok, false);

const swapped = assignZoneSupervisor(seed, admin, "A", USER_IDS.supervisorB);
assert.equal(swapped.ok, true);
if (!swapped.ok) throw new Error("swap");
assert.equal(swapped.state.zones.find((zone) => zone.code === "A")?.supervisorId, USER_IDS.supervisorB);
assert.equal(swapped.state.zones.find((zone) => zone.code === "B")?.supervisorId, USER_IDS.supervisorA);
assert.equal(swapped.state.users.find((item) => item.id === USER_IDS.leaderA)?.zoneCode, "A");
assert.equal(swapped.state.users.find((item) => item.id === USER_IDS.leaderA)?.supervisorId, USER_IDS.supervisorB);
assert.equal(swapped.state.users.find((item) => item.id === USER_IDS.leaderB)?.zoneCode, "B");
assert.equal(swapped.state.users.find((item) => item.id === USER_IDS.leaderB)?.supervisorId, USER_IDS.supervisorA);
assert.equal(swapped.state.requests.find((request) => request.id === "req-1")?.supervisorId, USER_IDS.supervisorB);
assert.equal(swapped.state.requests.find((request) => request.id === "req-6")?.zoneCode, "B");
assert.equal(swapped.state.requests.find((request) => request.id === "req-6")?.supervisorId, USER_IDS.supervisorB);
assert.equal(swapped.state.tickets.find((ticket) => ticket.requestId === "req-7")?.supervisorId, USER_IDS.supervisorD);

const legacyUsers = seed.users.map((item) => {
  const copy = { ...item };
  delete (copy as { supervisorId?: string | null }).supervisorId;
  return copy;
});
const normalized = normalizeWorkspace({
  ...seed,
  tickets: [],
  users: legacyUsers as DemoUser[],
});
assert.equal(normalized.users.find((item) => item.id === USER_IDS.leaderA)?.supervisorId, USER_IDS.supervisorA);
assert.equal(normalized.users.find((item) => item.id === USER_IDS.leaderA)?.zoneCode, "A");
assert.equal(normalized.tickets.find((ticket) => ticket.requestId === "req-7")?.lines[0]?.issued, "3.0");
assert.equal(projectIssueBoard(normalized, ["APPROVED", "PREPARED"]).zones[0]?.name, "ZONE A");
assert.equal(supervisorC.id.length > 0, true);

assert.equal(
  seed.materials.find((item) => item.itemCode === "PST-0125")?.categoryId,
  CATEGORY_IDS.pesticides,
);

const catalog = projectTeamLeader(seed, user(seed, USER_IDS.leaderA));
assert.equal(catalog.materials.some((material) => material.itemCode === "PPE-0001"), true);
assert.equal(catalog.materials.some((material) => material.itemCode === "PST-0001"), false);
assert.equal(JSON.stringify(catalog).includes("40.0"), false);
assert.equal(JSON.stringify(catalog).includes("25.0"), false);
assert.equal(JSON.stringify(catalog).includes("6.0"), false);

const ppeRequest = createTeamRequest(
  seed,
  user(seed, USER_IDS.leaderE),
  {
    lines: [{ materialId: MATERIAL_IDS.actellic, quantity: "1.0" }],
    employees: [
      { employeeId: "  E-100 ", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "2.0" }] },
      {
        employeeId: "E-200",
        lines: [
          { materialId: MATERIAL_IDS.gloves, quantity: "1.0" },
          { materialId: MATERIAL_IDS.mask, quantity: "1.0" },
        ],
      },
    ],
  },
  at,
);
assert.equal(ppeRequest.ok, true);
if (!ppeRequest.ok) throw new Error("ppe request");
const ppeStored = ppeRequest.state.requests.find((request) => request.requestNo === ppeRequest.data.requestNo);
assert.equal(ppeStored?.items.find((item) => item.materialId === MATERIAL_IDS.gloves)?.quantityRequested, "3.0");
assert.equal(ppeStored?.ppeAllocations.find((item) => item.employeeId === "E-100")?.quantity, "2.0");
assert.equal(stockOf(ppeRequest.state, MATERIAL_IDS.gloves), "40.0");
assert.equal(stockOf(ppeRequest.state, MATERIAL_IDS.actellic), "27.3");
assert.equal(
  createTeamRequest(seed, user(seed, USER_IDS.leaderE), {
    employees: [{ employeeId: "   ", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "1.0" }] }],
  }, at).ok,
  false,
);
assert.equal(
  createTeamRequest(seed, user(seed, USER_IDS.leaderE), {
    employees: [
      { employeeId: "E-100", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "1.0" }] },
      { employeeId: "E-100", lines: [{ materialId: MATERIAL_IDS.mask, quantity: "1.0" }] },
    ],
  }, at).ok,
  false,
);
assert.equal(
  createTeamRequest(seed, user(seed, USER_IDS.leaderE), {
    lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "1.0" }],
  }, at).ok,
  false,
);
assert.equal(
  createTeamRequest(seed, user(seed, USER_IDS.leaderE), {
    employees: [{ employeeId: "E-100", lines: [{ materialId: MATERIAL_IDS.actellic, quantity: "1.0" }] }],
  }, at).ok,
  false,
);
const hidden = updateCategory(
  seed,
  keeper,
  { categoryId: CATEGORY_IDS.ppe, name: "PPE", active: false },
  at,
);
assert.equal(hidden.ok, true);
if (!hidden.ok) throw new Error("hide ppe");
assert.equal(
  projectTeamLeader(hidden.state, user(seed, USER_IDS.leaderA)).materials.some(
    (material) => material.itemCode === "PPE-0001",
  ),
  false,
);
const added = createCategory(seed, keeper, "Baits", at);
assert.equal(added.ok, true);
if (!added.ok) throw new Error("category");
assert.equal(added.state.categories.some((category) => category.name === "Baits"), true);
assert.equal(createCategory(seed, supervisorA, "Baits", at).ok, false);

const unclassified = normalizeWorkspace({
  ...createSeed(),
  materials: createSeed().materials.map((material) => ({ ...material, categoryId: null })),
});
assert.equal(
  unclassified.materials.find((material) => material.productName === "ACTELLIC 50%")?.categoryId,
  null,
);
assert.equal(unclassified.categories.some((category) => category.name === "PPE"), true);

const queueA = projectSupervisor(seed, supervisorA);
assert.equal(queueA.pending.some((request) => request.teamLeaderName.length > 0), true);
assert.equal(queueA.pending.some((request) => request.id === "req-1"), true);
assert.equal(queueA.pending.some((request) => request.id === "req-5"), false);
assert.equal(projectSupervisor(seed, supervisorB).pending.some((request) => request.id === "req-1"), false);
const visibleLeader = queueA.pending.find((request) => request.id === "req-1");
assert.equal(visibleLeader?.teamLeaderName.includes("Team Leader"), true);

const leaderForPair = user(seed, USER_IDS.leaderA);
const pair = createTeamRequest(
  seed,
  leaderForPair,
  {
    lines: [
      { materialId: MATERIAL_IDS.actellic, quantity: "10" },
      { materialId: MATERIAL_IDS.biopren, quantity: "5" },
    ],
    employees: [],
  },
  at,
);
assert.equal(pair.ok, true);
if (!pair.ok) throw new Error("pair");
const pairRequest = pair.state.requests.find((request) => request.requestNo === pair.data.requestNo);
if (!pairRequest) throw new Error("pair request");
const actellicLine = pairRequest.items.find((item) => item.materialId === MATERIAL_IDS.actellic);
const bioprenLine = pairRequest.items.find((item) => item.materialId === MATERIAL_IDS.biopren);
if (!actellicLine || !bioprenLine) throw new Error("pair lines");
const glovesRequest = createTeamRequest(
  seed,
  leaderForPair,
  {
    lines: [],
    employees: [
      { employeeId: "E-77", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "2" }] },
    ],
  },
  at,
);
assert.equal(glovesRequest.ok, true);
if (!glovesRequest.ok) throw new Error("ppe request");
const ppe = glovesRequest.state.requests.find((request) => request.requestNo === glovesRequest.data.requestNo);
if (!ppe) throw new Error("ppe row");
const allocationsBefore = JSON.stringify(ppe.ppeAllocations);
const stockBeforeDecision = stockSnapshot(pair.state);
const split = decideRequestItems(
  pair.state,
  supervisorA,
  pairRequest.id,
  [
    { itemId: actellicLine.id, decision: "APPROVED", approvedQuantity: "7", rejectionReason: "" },
    { itemId: bioprenLine.id, decision: "REJECTED", approvedQuantity: "5", rejectionReason: "Quantity not justified for the requested work" },
  ],
  "split-1",
  at,
);
assert.equal(split.ok, true);
if (!split.ok) throw new Error("split");
assert.deepEqual(stockSnapshot(split.state), stockBeforeDecision);
const splitRequest = split.state.requests.find((request) => request.id === pairRequest.id);
assert.equal(splitRequest?.status, "PENDING_OPERATION_MANAGER");
assert.equal(splitRequest?.items.find((item) => item.id === actellicLine.id)?.approvedQuantity, "7");
assert.equal(splitRequest?.items.find((item) => item.id === bioprenLine.id)?.decision, "REJECTED");
assert.equal(split.state.approvals.length, 2);
const replayedSplit = decideRequestItems(
  split.state,
  supervisorA,
  pairRequest.id,
  [
    { itemId: actellicLine.id, decision: "APPROVED", approvedQuantity: "7", rejectionReason: "" },
    { itemId: bioprenLine.id, decision: "REJECTED", approvedQuantity: "9", rejectionReason: "Quantity not justified for the requested work" },
  ],
  "split-1",
  at,
);
assert.equal(replayedSplit.ok && replayedSplit.replayed, true);
assert.equal(replayedSplit.ok ? replayedSplit.state.approvals.length : -1, 2);
assert.equal(
  decideRequestItems(
    pair.state,
    supervisorA,
    pairRequest.id,
    [{ itemId: bioprenLine.id, decision: "REJECTED", approvedQuantity: "0", rejectionReason: "   " }],
    "split-reason",
    at,
  ).ok,
  false,
);
assert.equal(
  decideRequestItems(
    pair.state,
    supervisorA,
    pairRequest.id,
    [{ itemId: actellicLine.id, decision: "APPROVED", approvedQuantity: "11", rejectionReason: "" }],
    "split-high",
    at,
  ).ok,
  false,
);
assert.equal(
  decideRequestItems(
    pair.state,
    supervisorA,
    pairRequest.id,
    [{ itemId: actellicLine.id, decision: "APPROVED", approvedQuantity: "-1", rejectionReason: "" }],
    "split-negative",
    at,
  ).ok,
  false,
);
assert.equal(decideRequestItems(pair.state, supervisorB, pairRequest.id, [
  { itemId: actellicLine.id, decision: "APPROVED", approvedQuantity: "1", rejectionReason: "" },
], "split-other", at).ok, false);

const second = createTeamRequest(
  split.state,
  leaderForPair,
  { lines: [{ materialId: MATERIAL_IDS.rotryn, quantity: "1.5" }], employees: [] },
  at,
);
assert.equal(second.ok, true);
if (!second.ok) throw new Error("second");
const secondRequest = second.state.requests.find((request) => request.requestNo === second.data.requestNo);
if (!secondRequest) throw new Error("second request");
const bulk = bulkApproveRequests(
  second.state,
  supervisorA,
  [pairRequest.id, secondRequest.id],
  "bulk-1",
  at,
);
assert.equal(bulk.ok, false);
const bulkOk = bulkApproveRequests(second.state, supervisorA, [secondRequest.id], "bulk-2", at);
assert.equal(bulkOk.ok, true);
if (!bulkOk.ok) throw new Error("bulk");
assert.equal(bulkOk.state.requests.find((request) => request.id === secondRequest.id)?.status, "PENDING_OPERATION_MANAGER");
assert.deepEqual(stockSnapshot(bulkOk.state), stockSnapshot(second.state));
const bulkAgain = bulkApproveRequests(bulkOk.state, supervisorA, [secondRequest.id], "bulk-2", at);
assert.equal(bulkAgain.ok && bulkAgain.replayed, true);
assert.equal(bulkAgain.ok ? bulkAgain.state.approvals.length : -1, bulkOk.state.approvals.length);

assert.equal(prepareRequest(split.state, keeper, pairRequest.id, at).ok, false);
const releasedPartial = releaseToStore(split.state, pairRequest.id, "split-om");
assert.equal(releasedPartial.ok, true);
if (!releasedPartial.ok) throw new Error("operation partial");
assert.equal(
  releasedPartial.state.requests.find((request) => request.id === pairRequest.id)?.items.find((item) => item.id === actellicLine.id)?.approvedQuantity,
  "7",
);
const preparedPartial = prepareRequest(releasedPartial.state, keeper, pairRequest.id, at);
assert.equal(preparedPartial.ok, true);
if (!preparedPartial.ok) throw new Error("prepare partial");
assert.deepEqual(stockSnapshot(preparedPartial.state), stockBeforeDecision);
const rejectedIssue = issueRequest(
  preparedPartial.state,
  keeper,
  pairRequest.id,
  [{ itemId: bioprenLine.id, quantity: "1" }],
  "issue-rejected",
  at,
);
assert.equal(rejectedIssue.ok, false);
assert.equal(rejectedIssue.ok ? "" : rejectedIssue.error.includes("cannot be issued"), true);
const issuedPartial = issueRequest(
  preparedPartial.state,
  keeper,
  pairRequest.id,
  [{ itemId: actellicLine.id, quantity: "7" }],
  "issue-approved",
  at,
);
assert.equal(issuedPartial.ok, true);
if (!issuedPartial.ok) throw new Error("issue partial");
assert.equal(stockOf(issuedPartial.state, MATERIAL_IDS.actellic), "20.3");
assert.equal(issuedPartial.state.requests.find((request) => request.id === pairRequest.id)?.status, "ISSUED");
const issuedAgain = issueRequest(
  issuedPartial.state,
  keeper,
  pairRequest.id,
  [{ itemId: actellicLine.id, quantity: "7" }],
  "issue-approved",
  at,
);
assert.equal(issuedAgain.ok && issuedAgain.replayed, true);
assert.equal(stockOf(issuedAgain.ok ? issuedAgain.state : issuedPartial.state, MATERIAL_IDS.actellic), "20.3");
const partialTicket = buildTicket(issuedPartial.state, pairRequest.id);
assert.equal(partialTicket?.title, "MATERIAL ISSUE TICKET");
assert.equal(partialTicket?.lines.some((line) => line.itemCode === "PST-0125" && line.issued === "7" && line.approved === "7"), true);
assert.equal(partialTicket?.notes?.includes("Quantity not justified for the requested work"), true);

const ppeDecision = decideRequestItems(
  glovesRequest.state,
  supervisorA,
  ppe.id,
  ppe.items.map((item) => ({
    itemId: item.id,
    decision: "APPROVED" as const,
    approvedQuantity: item.quantityRequested,
    rejectionReason: "",
  })),
  "ppe-1",
  at,
);
assert.equal(ppeDecision.ok, true);
if (!ppeDecision.ok) throw new Error("ppe decision");
assert.equal(
  JSON.stringify(ppeDecision.state.requests.find((request) => request.id === ppe.id)?.ppeAllocations),
  allocationsBefore,
);

const legacy = normalizeWorkspace({
  ...createSeed(),
  requests: createSeed().requests.map((request) =>
    request.id === "req-3"
      ? {
          ...request,
          status: "APPROVED" as const,
          items: request.items.map((item) => ({ ...item, decision: undefined as never })),
        }
      : request,
  ),
});
assert.equal(legacy.requests.find((request) => request.id === "req-3")?.status, "OPERATION_MANAGER_APPROVED");
assert.equal(legacy.requests.find((request) => request.id === "req-3")?.items[0]?.decision, "APPROVED");
assert.equal(legacy.requests.find((request) => request.id === "req-3")?.items[0]?.approvedQuantity, "2.5");
assert.equal(legacy.requests.find((request) => request.id === "req-3")?.items[0]?.omDecision, "APPROVED");
assert.equal(legacy.requests.find((request) => request.id === "req-3")?.items[0]?.omApprovedQuantity, "2.5");

const tracked = createTeamRequest(
  seed,
  user(seed, USER_IDS.leaderA),
  [{ materialId: MATERIAL_IDS.actellic, quantity: "10" }],
  at,
);
assert.equal(tracked.ok, true);
if (!tracked.ok) throw new Error("tracked request");
const trackedRequest = tracked.state.requests.find((request) => request.requestNo === tracked.data.requestNo);
if (!trackedRequest) throw new Error("tracked row");
const trackedLine = trackedRequest.items[0];
if (!trackedLine) throw new Error("tracked line");
const stockBeforeTracked = stockOf(tracked.state, MATERIAL_IDS.actellic);
const approvedTen = decideRequestItems(
  tracked.state,
  supervisorA,
  trackedRequest.id,
  [{ itemId: trackedLine.id, decision: "APPROVED", approvedQuantity: "10", rejectionReason: "" }],
  "track-approve",
  at,
);
assert.equal(approvedTen.ok, true);
if (!approvedTen.ok) throw new Error("approve ten");
assert.equal(stockOf(approvedTen.state, MATERIAL_IDS.actellic), stockBeforeTracked);
const approvedRow = approvedTen.state.requests.find((request) => request.id === trackedRequest.id);
assert.equal(approvedRow?.status, "PENDING_OPERATION_MANAGER");
assert.equal(approvedRow?.items[0]?.approvedQuantity, "10");
assert.equal(projectSupervisor(approvedTen.state, supervisorA).approved.some((request) => request.id === trackedRequest.id), true);
assert.equal(projectSupervisor(approvedTen.state, supervisorA).issued.some((request) => request.id === trackedRequest.id), false);
assert.equal(ticketForActor(approvedTen.state, supervisorA, trackedRequest.id), null);
assert.equal(projectSupervisor(approvedTen.state, supervisorB).approved.some((request) => request.id === trackedRequest.id), false);
assert.equal(prepareRequest(approvedTen.state, keeper, trackedRequest.id, at).ok, false);
const releasedTen = releaseToStore(approvedTen.state, trackedRequest.id, "track-om");
assert.equal(releasedTen.ok, true);
if (!releasedTen.ok) throw new Error("track operation");
const preparedTen = prepareRequest(releasedTen.state, keeper, trackedRequest.id, at);
assert.equal(preparedTen.ok, true);
if (!preparedTen.ok) throw new Error("prepare ten");
assert.equal(stockOf(preparedTen.state, MATERIAL_IDS.actellic), stockBeforeTracked);
assert.equal(preparedTen.state.requests.find((request) => request.id === trackedRequest.id)?.status, "PREPARED");
assert.equal(ticketForActor(preparedTen.state, supervisorA, trackedRequest.id), null);
const issuedSeven = issueRequest(
  preparedTen.state,
  keeper,
  trackedRequest.id,
  [{ itemId: trackedLine.id, quantity: "7" }],
  "track-seven",
  at,
);
assert.equal(issuedSeven.ok, true);
if (!issuedSeven.ok) throw new Error("issue seven");
const sevenRow = issuedSeven.state.requests.find((request) => request.id === trackedRequest.id);
assert.equal(sevenRow?.status, "PREPARED");
assert.equal(sevenRow?.items[0]?.approvedQuantity, "10");
assert.equal(sevenRow?.items[0]?.quantityIssued, "7");
assert.equal(stockOf(issuedSeven.state, MATERIAL_IDS.actellic), "20.3");
assert.equal(issuedSeven.state.tickets.some((ticket) => ticket.requestId === trackedRequest.id), false);
const sevenCard = projectSupervisor(issuedSeven.state, supervisorA).issued.find(
  (request) => request.id === trackedRequest.id,
);
assert.equal(sevenCard?.teamLeaderName.includes("Team Leader"), true);
assert.equal(sevenCard?.totalApproved, "10 LTR");
assert.equal(sevenCard?.totalIssued, "7 LTR");
assert.equal(sevenCard?.ticketState, "in-progress");
assert.equal(projectSupervisor(issuedSeven.state, supervisorA).approved.some((request) => request.id === trackedRequest.id), false);
assert.equal(projectSupervisor(issuedSeven.state, supervisorB).issued.some((request) => request.id === trackedRequest.id), false);
assert.equal(projectSupervisor(issuedSeven.state, supervisorB).tickets.some((ticket) => ticket.requestId === trackedRequest.id), false);
const sevenTicket = ticketForActor(issuedSeven.state, supervisorA, trackedRequest.id);
assert.equal(sevenTicket?.lines[0]?.approved, "10");
assert.equal(sevenTicket?.lines[0]?.issued, "7");
assert.equal(ticketForActor(issuedSeven.state, supervisorB, trackedRequest.id), null);
const sevenPrint = buildTicket(issuedSeven.state, trackedRequest.id);
assert.equal(sevenPrint?.lines[0]?.issued, "7");
assert.equal(stockOf(issuedSeven.state, MATERIAL_IDS.actellic), "20.3");
const sevenReplay = issueRequest(
  issuedSeven.state,
  keeper,
  trackedRequest.id,
  [{ itemId: trackedLine.id, quantity: "7" }],
  "track-seven",
  "2026-10-25T12:20:00.000Z",
);
assert.equal(sevenReplay.ok && sevenReplay.replayed, true);
assert.equal(stockOf(sevenReplay.ok ? sevenReplay.state : issuedSeven.state, MATERIAL_IDS.actellic), "20.3");
const issuedRest = issueRequest(
  issuedSeven.state,
  keeper,
  trackedRequest.id,
  [{ itemId: trackedLine.id, quantity: "3" }],
  "track-rest",
  "2026-10-25T12:30:00.000Z",
);
assert.equal(issuedRest.ok, true);
if (!issuedRest.ok) throw new Error("issue rest");
const restRow = issuedRest.state.requests.find((request) => request.id === trackedRequest.id);
assert.equal(restRow?.status, "ISSUED");
assert.equal(restRow?.items[0]?.approvedQuantity, "10");
assert.equal(restRow?.items[0]?.quantityIssued, "10");
assert.equal(stockOf(issuedRest.state, MATERIAL_IDS.actellic), "17.3");
assert.equal(issuedRest.state.tickets.filter((ticket) => ticket.requestId === trackedRequest.id).length, 1);
assert.equal(issuedRest.state.tickets.find((ticket) => ticket.requestId === trackedRequest.id)?.lines[0]?.approved, "10");
assert.equal(issuedRest.state.tickets.find((ticket) => ticket.requestId === trackedRequest.id)?.lines[0]?.issued, "10");
const finalTicket = ticketForActor(issuedRest.state, supervisorA, trackedRequest.id);
assert.equal(finalTicket?.lines[0]?.approved, "10");
assert.equal(finalTicket?.lines[0]?.issued, "10");
assert.equal(projectSupervisor(issuedRest.state, supervisorA).issued.find((request) => request.id === trackedRequest.id)?.ticketState, "final");
assert.equal(ticketForActor(issuedRest.state, supervisorB, trackedRequest.id), null);

const ppeReleased = releaseToStore(ppeDecision.state, ppe.id, "ppe-om");
assert.equal(ppeReleased.ok, true);
if (!ppeReleased.ok) throw new Error("ppe operation");
assert.equal(
  JSON.stringify(ppeReleased.state.requests.find((request) => request.id === ppe.id)?.ppeAllocations),
  allocationsBefore,
);
const ppePrepared = prepareRequest(ppeReleased.state, keeper, ppe.id, at);
assert.equal(ppePrepared.ok, true);
if (!ppePrepared.ok) throw new Error("prepare ppe");
const ppeLine = ppe.items[0];
if (!ppeLine) throw new Error("ppe line");
const ppeIssued = issueRequest(
  ppePrepared.state,
  keeper,
  ppe.id,
  [{ itemId: ppeLine.id, quantity: ppeLine.quantityRequested }],
  "ppe-issue",
  at,
);
assert.equal(ppeIssued.ok, true);
if (!ppeIssued.ok) throw new Error("issue ppe");
assert.equal(
  JSON.stringify(ppeIssued.state.requests.find((request) => request.id === ppe.id)?.ppeAllocations),
  allocationsBefore,
);
const ppeTicket = ticketForActor(ppeIssued.state, supervisorA, ppe.id);
assert.equal(ppeTicket?.ppe[0]?.employeeId, "E-77");
assert.equal(ppeTicket?.ppe[0]?.quantity, "2");
assert.equal(ppeTicket?.lines[0]?.approved, "2");
assert.equal(ppeTicket?.lines[0]?.issued, "2");
assert.equal(projectSupervisor(ppeIssued.state, supervisorA).issued.some((request) => request.id === ppe.id), true);
assert.equal(projectSupervisor(ppeIssued.state, supervisorB).issued.some((request) => request.id === ppe.id), false);
assert.equal(ticketForActor(ppeIssued.state, supervisorB, ppe.id), null);

assert.equal(stockSignal(true, "45", "10"), "Available");
assert.equal(stockSignal(true, "5", "5"), "Low Stock");
assert.equal(stockSignal(true, "2", "5"), "Insufficient Stock");
assert.equal(stockSignal(false, "45", "10"), "Inactive Material");

const operationManager = user(seed, USER_IDS.operationManager);
const operationLeader = user(seed, USER_IDS.leaderA);
const operationRequest = createTeamRequest(
  seed,
  operationLeader,
  [{ materialId: MATERIAL_IDS.actellic, quantity: "10" }],
  at,
);
assert.equal(operationRequest.ok, true);
if (!operationRequest.ok) throw new Error("operation request");
const operationRow = operationRequest.state.requests.find(
  (request) => request.requestNo === operationRequest.data.requestNo,
);
if (!operationRow) throw new Error("operation row");
const operationLine = operationRow.items[0];
if (!operationLine) throw new Error("operation line");
assert.equal(
  decideOperationItems(
    operationRequest.state,
    operationManager,
    operationRow.id,
    [{ itemId: operationLine.id, decision: "APPROVED", approvedQuantity: "10", rejectionReason: "" }],
    "om-early",
    at,
  ).ok,
  false,
);
assert.equal(prepareRequest(operationRequest.state, keeper, operationRow.id, at).ok, false);
assert.equal(
  projectIssueBoard(operationRequest.state, ["OPERATION_MANAGER_APPROVED", "APPROVED", "PREPARED"]).zones
    .flatMap((zone) => zone.leaders.flatMap((leader) => leader.requests.map((request) => request.id)))
    .includes(operationRow.id),
  false,
);
const supervisorPass = decideRequestItems(
  operationRequest.state,
  supervisorA,
  operationRow.id,
  [{ itemId: operationLine.id, decision: "APPROVED", approvedQuantity: "8", rejectionReason: "" }],
  "om-supervisor",
  at,
);
assert.equal(supervisorPass.ok, true);
if (!supervisorPass.ok) throw new Error("operation supervisor");
const waiting = supervisorPass.state.requests.find((request) => request.id === operationRow.id);
assert.equal(waiting?.status, "PENDING_OPERATION_MANAGER");
assert.equal(waiting?.items[0]?.decision, "APPROVED");
assert.equal(waiting?.items[0]?.approvedQuantity, "8");
assert.equal(waiting?.items[0]?.omDecision, "PENDING");
assert.equal(prepareRequest(supervisorPass.state, keeper, operationRow.id, at).ok, false);
assert.equal(
  decideOperationItems(
    supervisorPass.state,
    supervisorA,
    operationRow.id,
    [{ itemId: operationLine.id, decision: "APPROVED", approvedQuantity: "8", rejectionReason: "" }],
    "om-as-supervisor",
    at,
  ).ok,
  false,
);
assert.equal(
  decideOperationItems(
    supervisorPass.state,
    keeper,
    operationRow.id,
    [{ itemId: operationLine.id, decision: "APPROVED", approvedQuantity: "8", rejectionReason: "" }],
    "om-as-store",
    at,
  ).ok,
  false,
);
assert.equal(
  decideOperationItems(
    supervisorPass.state,
    operationManager,
    operationRow.id,
    [{ itemId: operationLine.id, decision: "APPROVED", approvedQuantity: "9", rejectionReason: "" }],
    "om-high",
    at,
  ).ok,
  false,
);
const blankOperation = decideOperationItems(
  supervisorPass.state,
  operationManager,
  operationRow.id,
  [{ itemId: operationLine.id, decision: "REJECTED", approvedQuantity: "0", rejectionReason: "  " }],
  "om-blank-reason",
  at,
);
assert.equal(blankOperation.ok, true);
if (!blankOperation.ok) throw new Error("blank operation reject");
const blankOperationRow = blankOperation.state.requests.find((request) => request.id === operationRow.id);
assert.equal(blankOperationRow?.items[0]?.omDecision, "REJECTED");
assert.equal(blankOperationRow?.items[0]?.omRejectionReason, null);
assert.equal(blankOperationRow?.items[0]?.decision, "APPROVED");
assert.equal(blankOperationRow?.items[0]?.rejectionReason ?? null, null);
assert.equal(blankOperationRow?.status, "REJECTED");
const operationRejected = decideOperationItems(
  supervisorPass.state,
  operationManager,
  operationRow.id,
  [{ itemId: operationLine.id, decision: "REJECTED", approvedQuantity: "0", rejectionReason: "Not required this week" }],
  "om-reject",
  at,
);
assert.equal(operationRejected.ok, true);
if (!operationRejected.ok) throw new Error("operation reject");
const rejectedRow = operationRejected.state.requests.find((request) => request.id === operationRow.id);
assert.equal(rejectedRow?.status, "REJECTED");
assert.equal(rejectedRow?.items[0]?.decision, "APPROVED");
assert.equal(rejectedRow?.items[0]?.approvedQuantity, "8");
assert.equal(rejectedRow?.items[0]?.omDecision, "REJECTED");
assert.equal(rejectedRow?.items[0]?.omRejectionReason, "Not required this week");
assert.equal(prepareRequest(operationRejected.state, keeper, operationRow.id, at).ok, false);
assert.equal(issueRequest(supervisorPass.state, operationManager, operationRow.id, [], "om-issue", at).ok, false);
assert.equal(damageStock(supervisorPass.state, operationManager, MATERIAL_IDS.actellic, "1", "Not allowed", at).ok, false);
assert.equal(receiveStock(supervisorPass.state, operationManager, {
  materialId: MATERIAL_IDS.actellic,
  quantity: "1",
  reference: "R-1",
  supplier: "Supplier",
  receiptDate: "2026-10-26",
  notes: "",
  idempotencyKey: "om-receipt",
}, at).ok, false);

const damaged = damageStock(
  supervisorPass.state,
  keeper,
  MATERIAL_IDS.actellic,
  "25.3",
  "Damaged container",
  at,
);
assert.equal(damaged.ok, true);
if (!damaged.ok) throw new Error("damage");
assert.equal(stockOf(damaged.state, MATERIAL_IDS.actellic), "2.0");
const beforeDecision = projectOperationReview(damaged.state, operationManager, operationRow.id);
assert.equal(beforeDecision?.teamLeaderName, operationLeader.displayName);
assert.equal(beforeDecision?.supervisorName, supervisorA.displayName);
assert.equal(beforeDecision?.items[0]?.supervisorApproved, "8");
assert.equal(beforeDecision?.items[0]?.currentStock, stockOf(damaged.state, MATERIAL_IDS.actellic));
assert.equal(beforeDecision?.items[0]?.availableStock, beforeDecision?.items[0]?.currentStock);
assert.equal(beforeDecision?.items[0]?.signal, "Insufficient Stock");
assert.equal(
  projectOperationHome(damaged.state, operationManager).alerts.some(
    (alert) => alert.itemCode === "PST-0125" && alert.currentStock === "2.0" && alert.signal === "Insufficient Stock",
  ),
  true,
);
assert.equal(projectSupervisorReview(damaged.state, supervisorA, operationRow.id)?.items[0] && "currentStock" in (projectSupervisorReview(damaged.state, supervisorA, operationRow.id)?.items[0] ?? {}), false);
const operationApproved = decideOperationItems(
  damaged.state,
  operationManager,
  operationRow.id,
  [{ itemId: operationLine.id, decision: "APPROVED", approvedQuantity: "2", rejectionReason: "" }],
  "om-final",
  at,
);
assert.equal(operationApproved.ok, true);
if (!operationApproved.ok) throw new Error("operation final");
const finalRow = operationApproved.state.requests.find((request) => request.id === operationRow.id);
assert.equal(finalRow?.status, "OPERATION_MANAGER_APPROVED");
assert.equal(finalRow?.items[0]?.approvedQuantity, "8");
assert.equal(finalRow?.items[0]?.omApprovedQuantity, "2");
assert.equal(finalRow?.items[0]?.decidedBy, USER_IDS.supervisorA);
assert.equal(finalRow?.items[0]?.omDecidedBy, USER_IDS.operationManager);
const stages = operationApproved.state.approvals.filter((record) => record.requestId === operationRow.id);
assert.equal(stages.some((record) => record.stage === "SUPERVISOR" && record.approvedQuantity === "8"), true);
assert.equal(stages.some((record) => record.stage === "OPERATION_MANAGER" && record.approvedQuantity === "2"), true);
assert.equal(
  projectIssueBoard(operationApproved.state, ["OPERATION_MANAGER_APPROVED", "PREPARED"]).zones
    .flatMap((zone) => zone.leaders.flatMap((leader) => leader.requests.map((request) => request.id)))
    .includes(operationRow.id),
  true,
);
assert.equal(ticketForActor(operationApproved.state, operationManager, operationRow.id), null);
const operationPrepared = prepareRequest(operationApproved.state, keeper, operationRow.id, at);
assert.equal(operationPrepared.ok, true);
if (!operationPrepared.ok) throw new Error("operation prepare");
assert.equal(stockOf(operationPrepared.state, MATERIAL_IDS.actellic), "2.0");
assert.equal(
  issueRequest(
    operationPrepared.state,
    keeper,
    operationRow.id,
    [{ itemId: operationLine.id, quantity: "8" }],
    "om-too-much",
    at,
  ).ok,
  false,
);
const operationIssued = issueRequest(
  operationPrepared.state,
  keeper,
  operationRow.id,
  [{ itemId: operationLine.id, quantity: "2" }],
  "om-issue-once",
  at,
);
assert.equal(operationIssued.ok, true);
if (!operationIssued.ok) throw new Error("operation issue");
assert.equal(stockOf(operationIssued.state, MATERIAL_IDS.actellic), "0.0");
assert.equal(operationIssued.state.requests.find((request) => request.id === operationRow.id)?.items[0]?.quantityIssued, "2");
assert.equal(operationIssued.state.requests.find((request) => request.id === operationRow.id)?.items[0]?.approvedQuantity, "8");
assert.equal(operationIssued.state.requests.find((request) => request.id === operationRow.id)?.items[0]?.omApprovedQuantity, "2");
const operationReplay = issueRequest(
  operationIssued.state,
  keeper,
  operationRow.id,
  [{ itemId: operationLine.id, quantity: "2" }],
  "om-issue-once",
  at,
);
assert.equal(operationReplay.ok && operationReplay.replayed, true);
assert.equal(stockOf(operationReplay.ok ? operationReplay.state : operationIssued.state, MATERIAL_IDS.actellic), "0.0");
assert.equal(
  operationIssued.state.movements.filter(
    (movement) => movement.type === "ISSUE" && movement.requestId === operationRow.id,
  ).length,
  1,
);
const operationTicket = operationIssued.state.tickets.find((ticket) => ticket.requestId === operationRow.id);
assert.equal(operationTicket?.lines[0]?.approved, "2");
assert.equal(operationTicket?.lines[0]?.issued, "2");
const operationPrinted = ticketForActor(operationIssued.state, operationManager, operationRow.id);
assert.equal(operationPrinted?.lines[0]?.supervisorApproved, "8");
assert.equal(operationPrinted?.lines[0]?.approved, "2");
assert.equal(operationPrinted?.lines[0]?.issued, "2");
assert.equal(ticketForActor(operationIssued.state, supervisorA, operationRow.id)?.lines[0]?.approved, "2");
assert.equal(ticketForActor(operationIssued.state, supervisorB, operationRow.id), null);
const operationHistory = projectOperationReview(operationIssued.state, operationManager, operationRow.id);
assert.equal(operationHistory?.canDecide, false);
assert.equal(operationHistory?.canOpenTicket, true);
assert.equal(operationHistory?.history.some((row) => row.stage === "SUPERVISOR" && row.approvedQuantity === "8"), true);
assert.equal(operationHistory?.history.some((row) => row.stage === "OPERATION_MANAGER" && row.approvedQuantity === "2"), true);

const fast = createTeamRequest(
  seed,
  user(seed, USER_IDS.leaderA),
  [
    { materialId: MATERIAL_IDS.actellic, quantity: "10" },
    { materialId: MATERIAL_IDS.biopren, quantity: "1" },
  ],
  at,
);
assert.equal(fast.ok, true);
if (!fast.ok) throw new Error("fast request");
const fastRequest = fast.state.requests.find((request) => request.requestNo === fast.data.requestNo);
if (!fastRequest) throw new Error("fast row");
const fastActellic = fastRequest.items.find((item) => item.materialId === MATERIAL_IDS.actellic);
const fastBiopren = fastRequest.items.find((item) => item.materialId === MATERIAL_IDS.biopren);
if (!fastActellic || !fastBiopren) throw new Error("fast lines");
const fastSelection = [
  { requestId: fastRequest.id, itemId: fastActellic.id },
  { requestId: fastRequest.id, itemId: fastBiopren.id },
];
assert.equal(bulkApproveOperationLines(fast.state, operationManager, fastSelection, "fast-early", at).ok, false);
assert.equal(bulkApproveOperationLines(fast.state, supervisorA, fastSelection, "fast-supervisor", at).ok, false);
assert.equal(bulkApproveOperationLines(fast.state, keeper, fastSelection, "fast-store", at).ok, false);
const fastSupervised = decideRequestItems(
  fast.state,
  supervisorA,
  fastRequest.id,
  [
    { itemId: fastActellic.id, decision: "APPROVED", approvedQuantity: "10", rejectionReason: "" },
    { itemId: fastBiopren.id, decision: "APPROVED", approvedQuantity: "1", rejectionReason: "" },
  ],
  "fast-supervisor-items",
  at,
);
assert.equal(fastSupervised.ok, true);
if (!fastSupervised.ok) throw new Error("fast supervisor");
const fastDamaged = damageStock(fastSupervised.state, keeper, MATERIAL_IDS.actellic, "25.3", "Damaged container", at);
assert.equal(fastDamaged.ok, true);
if (!fastDamaged.ok) throw new Error("fast damage");
assert.equal(stockOf(fastDamaged.state, MATERIAL_IDS.actellic), "2.0");
const fastHome = projectOperationHome(fastDamaged.state, operationManager);
const fastQueued = fastHome.queue.flatMap((group) => group.lines).filter((line) => line.requestId === fastRequest.id);
assert.equal(fastQueued.length, 2);
const queuedActellic = fastQueued.find((line) => line.itemCode === "PST-0125");
const queuedBiopren = fastQueued.find((line) => line.itemCode === "PST-0231");
assert.equal(queuedActellic?.quantityRequested, "10");
assert.equal(queuedActellic?.supervisorApproved, "10");
assert.equal(queuedActellic?.currentStock, "2.0");
assert.equal(queuedActellic?.availableStock, "2.0");
assert.equal(queuedActellic?.signal, "Insufficient Stock");
assert.equal(queuedBiopren?.signal, "Available");
assert.equal(queuedActellic?.teamLeaderName, user(seed, USER_IDS.leaderA).displayName);
assert.equal(queuedActellic?.supervisorName, supervisorA.displayName);
const stockBeforeFast = stockSnapshot(fastDamaged.state);
const fastBulk = bulkApproveOperationLines(fastDamaged.state, operationManager, fastSelection, "fast-bulk", at);
assert.equal(fastBulk.ok, true);
if (!fastBulk.ok) throw new Error("fast bulk");
assert.equal(fastBulk.data.approvedCount, 2);
assert.equal(fastBulk.data.requestCount, 1);
assert.deepEqual(stockSnapshot(fastBulk.state), stockBeforeFast);
const fastApproved = fastBulk.state.requests.find((request) => request.id === fastRequest.id);
assert.equal(fastApproved?.status, "OPERATION_MANAGER_APPROVED");
assert.equal(fastApproved?.items.find((item) => item.id === fastActellic.id)?.approvedQuantity, "10");
assert.equal(fastApproved?.items.find((item) => item.id === fastActellic.id)?.omApprovedQuantity, "10");
assert.equal(fastApproved?.items.find((item) => item.id === fastActellic.id)?.decision, "APPROVED");
assert.equal(fastApproved?.items.find((item) => item.id === fastActellic.id)?.decidedBy, USER_IDS.supervisorA);
assert.equal(fastApproved?.items.find((item) => item.id === fastBiopren.id)?.omApprovedQuantity, "1");
const fastOmRows = fastBulk.state.approvals.filter(
  (record) => record.requestId === fastRequest.id && record.stage === "OPERATION_MANAGER",
);
assert.equal(fastOmRows.length, 2);
assert.equal(
  fastBulk.state.approvals.filter((record) => record.requestId === fastRequest.id && record.stage === "SUPERVISOR").length,
  2,
);
const fastReplay = bulkApproveOperationLines(fastBulk.state, operationManager, fastSelection, "fast-bulk", at);
assert.equal(fastReplay.ok && fastReplay.replayed, true);
assert.equal(
  (fastReplay.ok ? fastReplay.state : fastBulk.state).approvals.filter(
    (record) => record.requestId === fastRequest.id && record.stage === "OPERATION_MANAGER",
  ).length,
  2,
);
const fastAgain = bulkApproveOperationLines(fastBulk.state, operationManager, fastSelection, "fast-again", at);
assert.equal(fastAgain.ok && fastAgain.replayed, true);
assert.equal(
  (fastAgain.ok ? fastAgain.state : fastBulk.state).approvals.filter(
    (record) => record.requestId === fastRequest.id && record.stage === "OPERATION_MANAGER",
  ).length,
  2,
);
assert.equal(prepareRequest(fastSupervised.state, keeper, fastRequest.id, at).ok, false);
assert.equal(prepareRequest(fastBulk.state, keeper, fastRequest.id, at).ok, true);

const partialFast = bulkApproveOperationLines(
  fastDamaged.state,
  operationManager,
  [{ requestId: fastRequest.id, itemId: fastBiopren.id }],
  "fast-one",
  at,
);
assert.equal(partialFast.ok, true);
if (!partialFast.ok) throw new Error("fast one");
assert.equal(partialFast.state.requests.find((request) => request.id === fastRequest.id)?.status, "PENDING_OPERATION_MANAGER");
assert.equal(prepareRequest(partialFast.state, keeper, fastRequest.id, at).ok, false);
assert.equal(
  partialFast.state.requests.find((request) => request.id === fastRequest.id)?.items.find((item) => item.id === fastActellic.id)?.omDecision,
  "PENDING",
);

const reduced = decideOperationItems(
  fastDamaged.state,
  operationManager,
  fastRequest.id,
  [{ itemId: fastActellic.id, decision: "APPROVED", approvedQuantity: "7", rejectionReason: "" }],
  "fast-reduce",
  at,
);
assert.equal(reduced.ok, true);
if (!reduced.ok) throw new Error("fast reduce");
const reducedAgain = bulkApproveOperationLines(
  reduced.state,
  operationManager,
  [{ requestId: fastRequest.id, itemId: fastActellic.id }],
  "fast-overwrite",
  at,
);
assert.equal(reducedAgain.ok, false);
assert.equal(
  reduced.state.requests.find((request) => request.id === fastRequest.id)?.items.find((item) => item.id === fastActellic.id)?.omApprovedQuantity,
  "7",
);
assert.equal(
  reduced.state.requests.find((request) => request.id === fastRequest.id)?.items.find((item) => item.id === fastActellic.id)?.approvedQuantity,
  "10",
);

const blankLine = rejectOperationLine(
  fastDamaged.state,
  operationManager,
  { requestId: fastRequest.id, itemId: fastBiopren.id, rejectionReason: "   " },
  "mix-blank",
  at,
);
assert.equal(blankLine.ok, true);
if (!blankLine.ok) throw new Error("blank line reject");
const blankBiopren = blankLine.state.requests
  .find((request) => request.id === fastRequest.id)
  ?.items.find((item) => item.id === fastBiopren.id);
assert.equal(blankBiopren?.omDecision, "REJECTED");
assert.equal(blankBiopren?.omRejectionReason, null);
assert.equal(blankBiopren?.decision, "APPROVED");
assert.equal(blankBiopren?.rejectionReason ?? null, null);
assert.equal(
  rejectOperationLine(
    fastDamaged.state,
    operationManager,
    { requestId: fastRequest.id, itemId: fastBiopren.id, rejectionReason: "x".repeat(501) },
    "mix-long",
    at,
  ).ok,
  false,
);
assert.equal(
  rejectOperationLine(fastDamaged.state, supervisorA, {
    requestId: fastRequest.id,
    itemId: fastBiopren.id,
    rejectionReason: "Not required this week",
  }, "mix-supervisor", at).ok,
  false,
);
assert.equal(
  rejectOperationLine(fastDamaged.state, keeper, {
    requestId: fastRequest.id,
    itemId: fastBiopren.id,
    rejectionReason: "Not required this week",
  }, "mix-store", at).ok,
  false,
);
const mixedReject = rejectOperationLine(
  fastDamaged.state,
  operationManager,
  { requestId: fastRequest.id, itemId: fastBiopren.id, rejectionReason: "  Not required this week  " },
  "mix-reject",
  at,
);
assert.equal(mixedReject.ok, true);
if (!mixedReject.ok) throw new Error("mix reject");
const mixedPending = mixedReject.state.requests.find((request) => request.id === fastRequest.id);
assert.equal(mixedPending?.status, "PENDING_OPERATION_MANAGER");
const rejectedBiopren = mixedPending?.items.find((item) => item.id === fastBiopren.id);
assert.equal(rejectedBiopren?.decision, "APPROVED");
assert.equal(rejectedBiopren?.approvedQuantity, "1");
assert.equal(rejectedBiopren?.decidedBy, USER_IDS.supervisorA);
assert.equal(rejectedBiopren?.omDecision, "REJECTED");
assert.equal(rejectedBiopren?.omApprovedQuantity, "0");
assert.equal(rejectedBiopren?.omRejectionReason, "Not required this week");
assert.equal(rejectedBiopren?.omDecidedBy, USER_IDS.operationManager);
assert.equal(
  mixedReject.state.approvals.some(
    (record) =>
      record.requestId === fastRequest.id &&
      record.itemId === fastBiopren.id &&
      record.stage === "SUPERVISOR" &&
      record.decision === "APPROVED",
  ),
  true,
);
assert.equal(
  mixedReject.state.approvals.filter(
    (record) => record.requestId === fastRequest.id && record.itemId === fastBiopren.id && record.stage === "OPERATION_MANAGER",
  ).length,
  1,
);
const mixedReplay = rejectOperationLine(
  mixedReject.state,
  operationManager,
  { requestId: fastRequest.id, itemId: fastBiopren.id, rejectionReason: "Not required this week" },
  "mix-reject-again",
  at,
);
assert.equal(mixedReplay.ok && mixedReplay.replayed, true);
const mixedLocked = rejectOperationLine(
  mixedReject.state,
  operationManager,
  { requestId: fastRequest.id, itemId: fastBiopren.id, rejectionReason: "A different reason" },
  "mix-locked",
  at,
);
assert.equal(mixedLocked.ok, false);
const mixedApproved = bulkApproveOperationLines(
  mixedReject.state,
  operationManager,
  [{ requestId: fastRequest.id, itemId: fastActellic.id }],
  "mix-approve",
  at,
);
assert.equal(mixedApproved.ok, true);
if (!mixedApproved.ok) throw new Error("mix approve");
const mixedRow = mixedApproved.state.requests.find((request) => request.id === fastRequest.id);
assert.equal(mixedRow?.status, "PARTIALLY_APPROVED");
assert.equal(mixedRow?.items.find((item) => item.id === fastActellic.id)?.omDecision, "APPROVED");
assert.equal(mixedRow?.items.find((item) => item.id === fastBiopren.id)?.omDecision, "REJECTED");
assert.equal(mixedRow?.items.find((item) => item.id === fastActellic.id)?.decision, "APPROVED");
assert.equal(prepareRequest(mixedReject.state, keeper, fastRequest.id, at).ok, false);
const mixedBoard = projectIssueBoard(
  mixedApproved.state,
  ["PARTIALLY_APPROVED", "OPERATION_MANAGER_APPROVED", "PREPARED"],
);
const mixedCard = mixedBoard.zones
  .flatMap((zone) => zone.leaders.flatMap((leader) => leader.requests))
  .find((request) => request.id === fastRequest.id);
assert.equal(mixedCard?.items.some((item) => item.name === "ACTELLIC 50%"), true);
assert.equal(mixedCard?.items.some((item) => item.name === "BIOPREN 4 GR"), false);
const mixedDetail = projectRequestDetail(mixedApproved.state, keeper, fastRequest.id);
assert.equal(mixedDetail?.items.some((item) => item.itemCode === "PST-0125"), true);
assert.equal(mixedDetail?.items.some((item) => item.itemCode === "PST-0231"), false);
const mixedPrepared = prepareRequest(mixedApproved.state, keeper, fastRequest.id, at);
assert.equal(mixedPrepared.ok, true);
if (!mixedPrepared.ok) throw new Error("mix prepare");
assert.equal(
  issueRequest(
    mixedPrepared.state,
    keeper,
    fastRequest.id,
    [{ itemId: fastBiopren.id, quantity: "1" }],
    "mix-issue-rejected",
    at,
  ).ok,
  false,
);
assert.equal(stockOf(mixedPrepared.state, MATERIAL_IDS.biopren), stockOf(fastDamaged.state, MATERIAL_IDS.biopren));
const bothRejected = rejectOperationLine(
  mixedReject.state,
  operationManager,
  { requestId: fastRequest.id, itemId: fastActellic.id, rejectionReason: "Not required this week" },
  "mix-all",
  at,
);
assert.equal(bothRejected.ok, true);
if (!bothRejected.ok) throw new Error("mix all");
assert.equal(bothRejected.state.requests.find((request) => request.id === fastRequest.id)?.status, "REJECTED");
assert.equal(prepareRequest(bothRejected.state, keeper, fastRequest.id, at).ok, false);
assert.equal(
  projectIssueBoard(bothRejected.state, ["PARTIALLY_APPROVED", "OPERATION_MANAGER_APPROVED", "APPROVED", "PREPARED"]).zones
    .flatMap((zone) => zone.leaders.flatMap((leader) => leader.requests.map((request) => request.id)))
    .includes(fastRequest.id),
  false,
);

const inactiveRequest = createTeamRequest(
  seed,
  user(seed, USER_IDS.leaderA),
  [{ materialId: MATERIAL_IDS.aqua, quantity: "2" }],
  at,
);
assert.equal(inactiveRequest.ok, true);
if (!inactiveRequest.ok) throw new Error("inactive request");
const inactiveRow = inactiveRequest.state.requests.find((request) => request.requestNo === inactiveRequest.data.requestNo);
if (!inactiveRow?.items[0]) throw new Error("inactive line");
const inactiveSupervised = decideRequestItems(
  inactiveRequest.state,
  supervisorA,
  inactiveRow.id,
  [{ itemId: inactiveRow.items[0].id, decision: "APPROVED", approvedQuantity: "2", rejectionReason: "" }],
  "inactive-supervisor",
  at,
);
assert.equal(inactiveSupervised.ok, true);
if (!inactiveSupervised.ok) throw new Error("inactive supervisor");
const aquaOff = setMaterialActive(inactiveSupervised.state, keeper, MATERIAL_IDS.aqua, false, at);
assert.equal(aquaOff.ok, true);
if (!aquaOff.ok) throw new Error("deactivate");
const inactiveQueued = projectOperationHome(aquaOff.state, operationManager).queue
  .flatMap((group) => group.lines)
  .find((line) => line.requestId === inactiveRow.id);
assert.equal(inactiveQueued?.signal, "Inactive Material");
assert.equal(inactiveQueued?.selectable, false);
const inactiveBulk = bulkApproveOperationLines(
  aquaOff.state,
  operationManager,
  [{ requestId: inactiveRow.id, itemId: inactiveRow.items[0].id }],
  "inactive-bulk",
  at,
);
assert.equal(inactiveBulk.ok, false);
assert.equal(
  aquaOff.state.requests.find((request) => request.id === inactiveRow.id)?.items[0]?.omDecision,
  "PENDING",
);

async function checkFileLock() {
  const directory = await mkdtemp(path.join(tmpdir(), "mrs-workspace-"));
  process.env.MRS_DATA_FILE = path.join(directory, "workspace.json");
  const store = await import("./store");
  await store.resetWorkspace();
  const state = await store.readWorkspace();
  const actor = user(state, USER_IDS.storeKeeper);
  const results = await Promise.all([
    store.updateWorkspace((current) =>
      issueRequest(current, actor, "req-6", [{ itemId: "req-6-line", quantity: "2.0" }], "a", at),
    ),
    store.updateWorkspace((current) =>
      issueRequest(current, actor, "req-6", [{ itemId: "req-6-line", quantity: "2.0" }], "b", at),
    ),
  ]);
  const after = await store.readWorkspace();
  assert.equal(stockOf(after, MATERIAL_IDS.actellic), "25.3");
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok).length, 1);
  const movements = after.movements.filter(
    (movement) => movement.materialId === MATERIAL_IDS.actellic && movement.type === "ISSUE",
  );
  assert.equal(movements.length, 1);
  assert.equal(after.tickets.filter((ticket) => ticket.requestId === "req-6").length, 1);
  const saved = await store.updateWorkspace((current) =>
    assignTeamLeader(current, user(current, USER_IDS.admin), USER_IDS.leaderE, USER_IDS.supervisorA),
  );
  assert.equal(saved.ok, true);
  const disk = JSON.parse(await readFile(process.env.MRS_DATA_FILE ?? "", "utf8")) as Workspace;
  assert.equal(disk.users.find((item) => item.id === USER_IDS.leaderE)?.supervisorId, USER_IDS.supervisorA);
  assert.equal(disk.users.find((item) => item.id === USER_IDS.leaderE)?.zoneCode, "A");
  assert.equal(disk.tickets.some((ticket) => ticket.requestId === "req-6"), true);
  assert.equal(disk.tickets.find((ticket) => ticket.requestId === "req-7")?.supervisorId, USER_IDS.supervisorD);
  assert.equal(disk.requests.find((request) => request.id === "req-7")?.status, "ISSUED");
  await rm(directory, { recursive: true, force: true });
  delete process.env.MRS_DATA_FILE;
}

checkFileLock()
  .then(() => {
    console.log("Workspace rules checks passed.");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
