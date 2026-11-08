import assert from "node:assert/strict";

import { dubaiDateString } from "@/lib/format";
import { MATERIAL_IDS, USER_IDS, createSeed } from "./seed";
import {
  ZONE_CLOSED_MESSAGE,
  bulkApproveOperationLines,
  createTeamRequest,
  decideOperationItems,
  decideRequestItems,
  isZoneOpen,
  issueRequest,
  normalizeWorkspace,
  prepareRequest,
  setZoneRequestStatus,
} from "./rules";
import type { DemoUser, Mutation, Workspace, ZoneCode } from "./types";
import { usageByLeaderMaterial } from "./usage";
import { filterOperationRecords, projectOperationHome, projectTeamLeader, stockSnapshot } from "./views";

const today = "2026-10-27T12:00:00.000Z";
const yesterday = "2026-10-26T12:00:00.000Z";

function user(state: Workspace, id: string): DemoUser {
  const found = state.users.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

function must<T>(result: Mutation<T>, label: string) {
  if (!result.ok) throw new Error(`${label}: ${result.error}`);
  return result;
}

function stock(state: Workspace, id: string) {
  return state.materials.find((item) => item.id === id)?.currentStock ?? "";
}

function open(state: Workspace, zoneCode: ZoneCode, when: string, note?: string) {
  return must(
    setZoneRequestStatus(state, user(state, USER_IDS.operationManager), { zoneCode, status: "OPEN", note }, when),
    `open ${zoneCode}`,
  ).state;
}

function close(state: Workspace, zoneCode: ZoneCode, when: string, note?: string) {
  return must(
    setZoneRequestStatus(state, user(state, USER_IDS.operationManager), { zoneCode, status: "CLOSED", note }, when),
    `close ${zoneCode}`,
  ).state;
}

assert.equal(dubaiDateString("2026-10-27T12:00:00.000Z"), "2026-10-27");
assert.equal(dubaiDateString("2026-10-27T20:30:00.000Z"), "2026-10-28");

const seed = createSeed();
const leaderC = user(seed, USER_IDS.leaderC);
const leaderD = user(seed, USER_IDS.leaderD);
const supervisorC = user(seed, USER_IDS.supervisorC);
const operationManager = user(seed, USER_IDS.operationManager);
const keeper = user(seed, USER_IDS.storeKeeper);
assert.equal(isZoneOpen(seed, "C", today), false);
assert.equal(projectOperationHome(seed, operationManager, today).openZoneCodes.length, 0);
assert.equal(projectOperationHome(seed, operationManager, today).closedZoneCodes.join(","), "A,B,C,D,E");
assert.equal(projectTeamLeader(seed, leaderC, today).canSubmit, false);
assert.equal(projectTeamLeader(seed, leaderC, today).requestClosedMessage, ZONE_CLOSED_MESSAGE);

const closedSubmit = createTeamRequest(seed, leaderC, [{ materialId: MATERIAL_IDS.actellic, quantity: "1.0" }], today);
assert.equal(closedSubmit.ok, false);
if (closedSubmit.ok) throw new Error("closed submit");
assert.equal(closedSubmit.error, ZONE_CLOSED_MESSAGE);
assert.equal(seed.requests.length, createSeed().requests.length);

const openedC = open(seed, "C", today, "Morning cycle");
assert.equal(isZoneOpen(openedC, "C", today), true);
assert.equal(isZoneOpen(openedC, "D", today), false);
assert.equal(isZoneOpen(openedC, "C", yesterday), false);
assert.equal(openedC.zoneRequestDays.length, 1);
assert.equal(openedC.zoneRequestChanges.length, 1);
assert.equal(openedC.zoneRequestChanges[0]?.previousStatus, "CLOSED");
assert.equal(openedC.zoneRequestChanges[0]?.newStatus, "OPEN");
assert.equal(openedC.zoneRequestChanges[0]?.note, "Morning cycle");
assert.equal(projectTeamLeader(openedC, leaderC, today).canSubmit, true);
assert.equal(projectTeamLeader(openedC, leaderC, today).requestClosedMessage, null);

const submitted = must(
  createTeamRequest(openedC, leaderC, [{ materialId: MATERIAL_IDS.actellic, quantity: "1.0" }], today),
  "zone c submit",
);
const created = submitted.state.requests.find((request) => request.requestNo === submitted.data.requestNo);
if (!created) throw new Error("created");
assert.equal(created.zoneCode, "C");
assert.equal(created.teamLeaderId, USER_IDS.leaderC);
assert.equal(created.status, "PENDING");

const replay = setZoneRequestStatus(submitted.state, operationManager, { zoneCode: "C", status: "OPEN" }, today);
assert.equal(replay.ok && replay.replayed, true);
if (!replay.ok) throw new Error("replay");
assert.equal(replay.state.zoneRequestChanges.length, 1);

const closedAfter = close(submitted.state, "C", today, "Cycle finished");
assert.equal(closedAfter.zoneRequestDays.filter((row) => row.zoneCode === "C" && row.requestDate === "2026-10-27").length, 1);
assert.equal(closedAfter.zoneRequestDays.find((row) => row.zoneCode === "C")?.status, "CLOSED");
assert.equal(closedAfter.zoneRequestChanges.length, 2);
assert.equal(closedAfter.zoneRequestChanges[1]?.previousStatus, "OPEN");
assert.equal(closedAfter.zoneRequestChanges[1]?.newStatus, "CLOSED");
const existing = closedAfter.requests.find((request) => request.id === created.id);
assert.equal(existing?.status, "PENDING");
assert.equal(stock(closedAfter, MATERIAL_IDS.actellic), stock(seed, MATERIAL_IDS.actellic));

const blockedAgain = createTeamRequest(
  closedAfter,
  leaderC,
  [{ materialId: MATERIAL_IDS.actellic, quantity: "1.0" }],
  today,
);
assert.equal(blockedAgain.ok, false);
if (blockedAgain.ok) throw new Error("blocked");
assert.equal(blockedAgain.error, ZONE_CLOSED_MESSAGE);

const zoneD = open(closedAfter, "D", today);
const otherZone = must(
  createTeamRequest(zoneD, leaderD, [{ materialId: MATERIAL_IDS.aqua, quantity: "1.0" }], today),
  "zone d submit",
);
assert.equal(
  otherZone.state.requests.find((request) => request.requestNo === otherZone.data.requestNo)?.zoneCode,
  "D",
);
const stillBlocked = createTeamRequest(zoneD, leaderC, [{ materialId: MATERIAL_IDS.actellic, quantity: "1.0" }], today);
assert.equal(stillBlocked.ok, false);

const supervisorClosed = createTeamRequest(
  seed,
  supervisorC,
  [{ materialId: MATERIAL_IDS.actellic, quantity: "1.0" }],
  today,
);
assert.equal(supervisorClosed.ok, false);
if (supervisorClosed.ok) throw new Error("supervisor closed");
assert.equal(supervisorClosed.error, ZONE_CLOSED_MESSAGE);
const supervisorOpen = createTeamRequest(
  openedC,
  supervisorC,
  [{ materialId: MATERIAL_IDS.actellic, quantity: "1.0" }],
  today,
);
assert.equal(supervisorOpen.ok, false);
if (supervisorOpen.ok) throw new Error("supervisor open");
assert.equal(supervisorOpen.error.includes("Supervisors do not submit"), true);
assert.equal(
  createTeamRequest(openedC, keeper, [{ materialId: MATERIAL_IDS.actellic, quantity: "1.0" }], today).ok,
  false,
);
assert.equal(
  setZoneRequestStatus(seed, user(seed, USER_IDS.admin), { zoneCode: "C", status: "OPEN" }, today).ok,
  false,
);

let flowing = closedAfter;
const flowRequest = flowing.requests.find((request) => request.id === created.id);
if (!flowRequest) throw new Error("flow");
const flowItem = flowRequest.items[0];
if (!flowItem) throw new Error("flow item");
const beforeApproval = stockSnapshot(flowing);
flowing = must(
  decideRequestItems(flowing, supervisorC, flowRequest.id, [{
    itemId: flowItem.id,
    decision: "APPROVED",
    approvedQuantity: "1.0",
    rejectionReason: "",
  }], "zone-sup", today),
  "supervisor after close",
).state;
assert.equal(flowing.requests.find((request) => request.id === flowRequest.id)?.status, "PENDING_OPERATION_MANAGER");
const queued = projectOperationHome(flowing, operationManager, today);
assert.equal(queued.queue.some((group) => group.requestId === flowRequest.id), true);
assert.equal(queued.approvedLines.some((line) => line.itemId === flowItem.id), false);
flowing = must(
  decideOperationItems(flowing, operationManager, flowRequest.id, [{
    itemId: flowItem.id,
    decision: "APPROVED",
    approvedQuantity: "1.0",
    rejectionReason: "",
  }], "zone-om", today),
  "operation after close",
).state;
assert.deepEqual(stockSnapshot(flowing), beforeApproval);
assert.equal(flowing.requests.find((request) => request.id === flowRequest.id)?.status, "OPERATION_MANAGER_APPROVED");
const approvedHome = projectOperationHome(flowing, operationManager, today);
assert.equal(approvedHome.queue.some((group) => group.requestId === flowRequest.id), false);
assert.equal(approvedHome.approvedLines.some((line) => line.itemId === flowItem.id), true);
assert.equal(approvedHome.rejectedLines.some((line) => line.itemId === flowItem.id), false);
assert.equal(approvedHome.approvedToday >= 1, true);
flowing = must(prepareRequest(flowing, keeper, flowRequest.id, today), "prepare after close").state;
const issued = must(
  issueRequest(flowing, keeper, flowRequest.id, [{ itemId: flowItem.id, quantity: "1.0" }], "zone-issue", today),
  "issue after close",
);
assert.equal(issued.state.requests.find((request) => request.id === flowRequest.id)?.status, "ISSUED");
assert.notEqual(stock(issued.state, MATERIAL_IDS.actellic), stock(seed, MATERIAL_IDS.actellic));
assert.equal(
  issued.state.movements.filter((movement) => movement.type === "ISSUE" && movement.requestId === flowRequest.id).length,
  1,
);

const rejectBase = open(createSeed(), "A", today);
const rejectCreated = must(
  createTeamRequest(rejectBase, user(rejectBase, USER_IDS.leaderA), [{ materialId: MATERIAL_IDS.biopren, quantity: "2.0" }], today),
  "reject create",
);
let rejecting = rejectCreated.state;
const rejectRequest = rejecting.requests.find((request) => request.requestNo === rejectCreated.data.requestNo);
if (!rejectRequest) throw new Error("reject request");
const rejectItem = rejectRequest.items[0];
if (!rejectItem) throw new Error("reject item");
rejecting = must(
  decideRequestItems(rejecting, user(rejecting, USER_IDS.supervisorA), rejectRequest.id, [{
    itemId: rejectItem.id,
    decision: "APPROVED",
    approvedQuantity: "1.5",
    rejectionReason: "",
  }], "reject-sup", today),
  "reject supervisor",
).state;
const beforeReject = projectOperationHome(rejecting, operationManager, today);
assert.equal(beforeReject.queue.some((group) => group.lines.some((line) => line.itemId === rejectItem.id)), true);
rejecting = must(
  decideOperationItems(rejecting, operationManager, rejectRequest.id, [{
    itemId: rejectItem.id,
    decision: "REJECTED",
    approvedQuantity: "0",
    rejectionReason: "Not required today",
  }], "reject-om", today),
  "reject operation",
).state;
const rejectedHome = projectOperationHome(rejecting, operationManager, today);
assert.equal(rejectedHome.queue.some((group) => group.lines.some((line) => line.itemId === rejectItem.id)), false);
const rejectedLine = rejectedHome.rejectedLines.find((line) => line.itemId === rejectItem.id);
assert.equal(rejectedLine?.quantityRequested, "2.0");
assert.equal(rejectedLine?.supervisorApproved, "1.5");
assert.equal(rejectedLine?.rejectedQuantity, "1.5");
assert.equal(rejectedLine?.omRejectionReason, "Not required today");
assert.equal(rejectedLine?.decidedByName, operationManager.displayName);
assert.equal(rejectedHome.approvedLines.some((line) => line.itemId === rejectItem.id), false);
assert.equal(stock(rejecting, MATERIAL_IDS.biopren), stock(seed, MATERIAL_IDS.biopren));

const history = projectOperationHome(issued.state, operationManager, today);
const foundIssued = filterOperationRecords(history.history, {
  date: "2026-10-27",
  zone: "C",
  teamLeaderId: USER_IDS.leaderC,
  supervisorId: USER_IDS.supervisorC,
  material: "ACTELLIC",
  status: "ISSUED",
  requestId: created.requestNo ? `MR-${created.requestNo}` : "",
});
assert.equal(foundIssued.length, 1);
assert.equal(foundIssued[0]?.ticketNo !== null, true);
assert.equal(foundIssued[0]?.quantityIssued, "1.0");
const older = filterOperationRecords(history.history, {
  date: "2026-10-25",
  zone: "D",
  teamLeaderId: "all",
  supervisorId: "all",
  material: "",
  status: "ISSUED",
  requestId: "MR-7",
});
assert.equal(older.length >= 1, true);
const supervisorRejection = filterOperationRecords(history.history, {
  date: "",
  zone: "all",
  teamLeaderId: "all",
  supervisorId: "all",
  material: "",
  status: "REJECTED",
  requestId: "MR-2",
});
assert.equal(supervisorRejection.length >= 1, true);
assert.equal(supervisorRejection.every((line) => line.omDecision !== "APPROVED"), true);

const usageBase = open(createSeed(), "C", today);
const usageCreated = must(
  createTeamRequest(usageBase, leaderC, [{ materialId: MATERIAL_IDS.actellic, quantity: "2.0" }], today),
  "usage create",
);
let usageState = usageCreated.state;
const usageRequest = usageState.requests.find((request) => request.requestNo === usageCreated.data.requestNo);
if (!usageRequest) throw new Error("usage request");
const usageItem = usageRequest.items[0];
if (!usageItem) throw new Error("usage item");
usageState = must(
  decideRequestItems(usageState, supervisorC, usageRequest.id, [{
    itemId: usageItem.id,
    decision: "APPROVED",
    approvedQuantity: "2.0",
    rejectionReason: "",
  }], "usage-sup", today),
  "usage supervisor",
).state;
usageState = must(
  decideOperationItems(usageState, operationManager, usageRequest.id, [{
    itemId: usageItem.id,
    decision: "APPROVED",
    approvedQuantity: "1.5",
    rejectionReason: "",
  }], "usage-om", today),
  "usage operation",
).state;
usageState = must(prepareRequest(usageState, keeper, usageRequest.id, today), "usage prepare").state;
const beforeIssue = stock(usageState, MATERIAL_IDS.actellic);
usageState = must(
  issueRequest(usageState, keeper, usageRequest.id, [{ itemId: usageItem.id, quantity: "1.0" }], "usage-issue", today),
  "usage issue",
).state;
const usage = usageByLeaderMaterial(usageState, today).for(USER_IDS.leaderC, MATERIAL_IDS.actellic, "2.0");
assert.equal(usage.lastQuantity, "1.0");
assert.equal(usage.days30, "1.0");
assert.notEqual(usage.lastQuantity, "2.0");
assert.notEqual(usage.lastQuantity, "1.5");
assert.equal(usageState.requests.find((request) => request.id === usageRequest.id)?.items[0]?.quantityRequested, "2.0");
assert.equal(usageState.requests.find((request) => request.id === usageRequest.id)?.items[0]?.omApprovedQuantity, "1.5");
assert.notEqual(stock(usageState, MATERIAL_IDS.actellic), beforeIssue);

const carried = open(createSeed(), "A", yesterday);
assert.equal(isZoneOpen(carried, "A", today), false);
assert.equal(projectTeamLeader(carried, user(carried, USER_IDS.leaderA), today).requestClosedMessage, ZONE_CLOSED_MESSAGE);
assert.equal(projectTeamLeader(carried, user(carried, USER_IDS.leaderA), yesterday).canSubmit, true);

const bare = { ...createSeed() } as Workspace;
delete (bare as { zoneRequestDays?: unknown }).zoneRequestDays;
delete (bare as { zoneRequestChanges?: unknown }).zoneRequestChanges;
const normalized = normalizeWorkspace(bare);
assert.equal(Array.isArray(normalized.zoneRequestDays), true);
assert.equal(Array.isArray(normalized.zoneRequestChanges), true);

const bulkState = open(createSeed(), "A", today);
const bulkCreated = must(
  createTeamRequest(bulkState, user(bulkState, USER_IDS.leaderA), [{ materialId: MATERIAL_IDS.aqua, quantity: "1.0" }], today),
  "bulk create",
);
let bulk = bulkCreated.state;
const bulkRequest = bulk.requests.find((request) => request.requestNo === bulkCreated.data.requestNo);
if (!bulkRequest?.items[0]) throw new Error("bulk item");
bulk = must(
  decideRequestItems(bulk, user(bulk, USER_IDS.supervisorA), bulkRequest.id, [{
    itemId: bulkRequest.items[0].id,
    decision: "APPROVED",
    approvedQuantity: "1.0",
    rejectionReason: "",
  }], "bulk-sup", today),
  "bulk supervisor",
).state;
const bulkResult = must(
  bulkApproveOperationLines(bulk, operationManager, [{ requestId: bulkRequest.id, itemId: bulkRequest.items[0].id }], "zone-bulk", today),
  "bulk approve",
);
const bulkHome = projectOperationHome(bulkResult.state, operationManager, today);
assert.equal(bulkHome.queue.some((group) => group.requestId === bulkRequest.id), false);
assert.equal(bulkHome.approvedLines.some((line) => line.itemId === bulkRequest.items[0].id), true);
assert.equal(stock(bulkResult.state, MATERIAL_IDS.aqua), stock(seed, MATERIAL_IDS.aqua));

console.log("zone-control.test.ts passed");
