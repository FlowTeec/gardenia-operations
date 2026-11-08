import assert from "node:assert/strict";

import { ticketLabel } from "@/lib/format";
import { MATERIAL_IDS, USER_IDS, createSeed } from "./seed";
import {
  bulkApproveOperationLines,
  createTeamRequest,
  damageStock,
  decideOperationItems,
  decideRequestItems,
  issueRequest,
  prepareRequest,
  setZoneRequestStatus,
} from "./rules";
import type { DemoUser, Mutation, Workspace, ZoneCode } from "./types";
import { dubaiDayNumber, usageByLeaderMaterial } from "./usage";
import { buildTicket, projectOperationHome, projectSupervisorReview, stockSnapshot } from "./views";

const asOf = "2026-10-27T12:00:00.000Z";

function user(state: Workspace, id: string): DemoUser {
  const found = state.users.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

function must<T>(result: Mutation<T>, label: string) {
  if (!result.ok) throw new Error(`${label}: ${result.error}`);
  return result;
}

function byNo(state: Workspace, requestNo: number) {
  const request = state.requests.find((item) => item.requestNo === requestNo);
  if (!request) throw new Error(`MR-${requestNo}`);
  return request;
}

function usageOf(state: Workspace, leaderId: string, materialId: string, compared: string) {
  return usageByLeaderMaterial(state, asOf).for(leaderId, materialId, compared);
}

function openZone(state: Workspace, zoneCode: ZoneCode | null, when: string) {
  if (!zoneCode) throw new Error("zone");
  return must(
    setZoneRequestStatus(
      state,
      user(state, USER_IDS.operationManager),
      { zoneCode, status: "OPEN" },
      when,
    ),
    `open ${zoneCode}`,
  ).state;
}

function issueAll(
  state: Workspace,
  leader: DemoUser,
  supervisor: DemoUser,
  materialId: string,
  quantity: string,
  when: string,
  key: string,
) {
  const created = must(
    createTeamRequest(openZone(state, leader.zoneCode, when), leader, [{ materialId, quantity }], when),
    `${key} create`,
  );
  let next = created.state;
  const request = byNo(next, created.data.requestNo);
  const itemId = request.items[0]?.id;
  if (!itemId) throw new Error(`${key} item`);
  next = must(
    decideRequestItems(next, supervisor, request.id, [{
      itemId,
      decision: "APPROVED",
      approvedQuantity: quantity,
      rejectionReason: "",
    }], `${key}-sup`, when),
    `${key} supervisor`,
  ).state;
  next = must(
    decideOperationItems(next, user(next, USER_IDS.operationManager), request.id, [{
      itemId,
      decision: "APPROVED",
      approvedQuantity: quantity,
      rejectionReason: "",
    }], `${key}-om`, when),
    `${key} operation`,
  ).state;
  next = must(prepareRequest(next, user(next, USER_IDS.storeKeeper), request.id, when), `${key} prepare`).state;
  next = must(
    issueRequest(next, user(next, USER_IDS.storeKeeper), request.id, [{ itemId, quantity }], `${key}-issue`, when),
    `${key} issue`,
  ).state;
  return next;
}

const seed = createSeed();
const leaderA = user(seed, USER_IDS.leaderA);
const supervisorA = user(seed, USER_IDS.supervisorA);
const keeper = user(seed, USER_IDS.storeKeeper);
const operationManager = user(seed, USER_IDS.operationManager);

const seeded = usageOf(seed, USER_IDS.leaderD, MATERIAL_IDS.aqua, "1");
assert.equal(seeded.lastQuantity, "3.0");
assert.equal(seeded.lastIssuedAt, "2026-10-25T10:00:00.000Z");
assert.equal(seeded.daysSince, 2);
assert.equal(seeded.days30, "3.0");
assert.equal(seeded.days60, "3.0");
assert.equal(seeded.days90, "3.0");
assert.equal(seeded.averageMonthly, null);
assert.equal(seeded.level, "Normal Usage");
assert.equal(seeded.recent.length, 1);
assert.equal(seeded.recent[0]?.reference, "MIT-0007");

assert.equal(usageOf(seed, USER_IDS.leaderA, MATERIAL_IDS.actellic, "1").level, "No Previous Issue");
assert.equal(usageOf(seed, USER_IDS.leaderA, MATERIAL_IDS.actellic, "1").days30, "0");
assert.equal(usageOf(seed, USER_IDS.leaderA, MATERIAL_IDS.actellic, "1").recent.length, 0);
assert.equal(usageOf(seed, USER_IDS.leaderB, MATERIAL_IDS.actellic, "2").level, "No Previous Issue");

const preparedOnly = must(
  createTeamRequest(openZone(seed, leaderA.zoneCode, asOf), leaderA, [{ materialId: MATERIAL_IDS.sprayer, quantity: "1" }], asOf),
  "sprayer",
);
let held = preparedOnly.state;
const heldRequest = byNo(held, preparedOnly.data.requestNo);
held = must(
  decideRequestItems(held, supervisorA, heldRequest.id, [{
    itemId: heldRequest.items[0].id,
    decision: "APPROVED",
    approvedQuantity: "1",
    rejectionReason: "",
  }], "sprayer-sup", asOf),
  "sprayer supervisor",
).state;
held = must(
  decideOperationItems(held, operationManager, heldRequest.id, [{
    itemId: heldRequest.items[0].id,
    decision: "APPROVED",
    approvedQuantity: "1",
    rejectionReason: "",
  }], "sprayer-om", asOf),
  "sprayer operation",
).state;
held = must(prepareRequest(held, keeper, heldRequest.id, asOf), "sprayer prepare").state;
assert.equal(usageOf(held, USER_IDS.leaderA, MATERIAL_IDS.sprayer, "1").level, "No Previous Issue");

const leaderBIssued = must(
  issueRequest(held, keeper, "req-6", [{ itemId: "req-6-line", quantity: "2.0" }], "leader-b-issue", asOf),
  "leader b issue",
).state;
assert.equal(usageOf(leaderBIssued, USER_IDS.leaderB, MATERIAL_IDS.actellic, "1").lastQuantity, "2.0");
assert.equal(usageOf(leaderBIssued, USER_IDS.leaderA, MATERIAL_IDS.actellic, "1").level, "No Previous Issue");

let history = leaderBIssued;
const historyRows = [
  ["2026-07-29T12:00:00.000Z", "4", "hist-jul"],
  ["2026-09-25T12:00:00.000Z", "2", "hist-sep"],
  ["2026-10-07T12:00:00.000Z", "3", "hist-oct7"],
  ["2026-10-18T12:00:00.000Z", "2", "hist-oct18"],
] as const;
for (const [when, quantity, key] of historyRows) {
  history = issueAll(history, leaderA, supervisorA, MATERIAL_IDS.actellic, quantity, when, key);
}

const aged = usageOf(history, USER_IDS.leaderA, MATERIAL_IDS.actellic, "12");
assert.equal(dubaiDayNumber(asOf)! - dubaiDayNumber("2026-10-18T12:00:00.000Z")!, 9);
assert.equal(aged.lastQuantity, "2");
assert.equal(aged.lastIssuedAt, "2026-10-18T12:00:00.000Z");
assert.equal(aged.daysSince, 9);
assert.equal(aged.days30, "5");
assert.equal(aged.days60, "7");
assert.equal(aged.days90, "11");
assert.equal(aged.averageMonthly, "3.666667");
assert.equal(aged.level, "Above Historical Usage");
assert.deepEqual(
  aged.recent.map((issue) => [issue.issuedAt.slice(0, 10), issue.quantity]),
  [
    ["2026-10-18", "2"],
    ["2026-10-07", "3"],
    ["2026-09-25", "2"],
  ],
);
assert.equal(aged.recent[0]?.reference, ticketLabel(byNo(history, history.requests.at(-1)?.requestNo ?? 0).requestNo));
assert.equal(usageOf(history, USER_IDS.leaderB, MATERIAL_IDS.actellic, "1").days90, "2.0");
assert.equal(usageOf(history, USER_IDS.leaderA, MATERIAL_IDS.biopren, "1").level, "No Previous Issue");

const pending = must(
  createTeamRequest(openZone(history, leaderA.zoneCode, asOf), leaderA, [
    { materialId: MATERIAL_IDS.actellic, quantity: "12" },
    { materialId: MATERIAL_IDS.biopren, quantity: "1" },
  ], asOf),
  "pending",
);
let queueState = pending.state;
const pendingRequest = byNo(queueState, pending.data.requestNo);
const actellicLine = pendingRequest.items.find((item) => item.materialId === MATERIAL_IDS.actellic);
const bioprenLine = pendingRequest.items.find((item) => item.materialId === MATERIAL_IDS.biopren);
if (!actellicLine || !bioprenLine) throw new Error("pending lines");
queueState = must(
  decideRequestItems(queueState, supervisorA, pendingRequest.id, [
    { itemId: actellicLine.id, decision: "APPROVED", approvedQuantity: "12", rejectionReason: "" },
    { itemId: bioprenLine.id, decision: "APPROVED", approvedQuantity: "1", rejectionReason: "" },
  ], "pending-sup", asOf),
  "pending supervisor",
).state;

const home = projectOperationHome(queueState, operationManager, asOf);
const queued = home.queue.flatMap((group) => group.lines).filter((line) => line.requestId === pendingRequest.id);
const queuedActellic = queued.find((line) => line.itemCode === "PST-0125");
const queuedBiopren = queued.find((line) => line.itemCode === "PST-0231");
assert.equal(queuedActellic?.usage.days90, "11");
assert.equal(queuedActellic?.usage.level, "Above Historical Usage");
assert.equal(queuedActellic?.usage.daysSince, 9);
assert.equal(queuedActellic?.signal, "Available");
assert.equal(queuedBiopren?.usage.level, "No Previous Issue");
assert.equal(queuedBiopren?.usage.lastQuantity, null);
assert.equal(queuedBiopren?.usage.days30, "0");

const short = must(damageStock(queueState, keeper, MATERIAL_IDS.actellic, "10", "Damaged container", asOf), "damage");
const shortHome = projectOperationHome(short.state, operationManager, asOf);
const shortLine = shortHome.queue.flatMap((group) => group.lines).find((line) => line.itemId === actellicLine.id);
assert.equal(shortLine?.signal, "Insufficient Stock");
assert.equal(shortLine?.usage.lastQuantity, "2");
assert.equal(shortLine?.usage.level, "Above Historical Usage");
assert.equal(shortLine?.supervisorApproved, "12");
const stockBeforeApproval = stockSnapshot(short.state);
const bulk = must(
  bulkApproveOperationLines(short.state, operationManager, [
    { requestId: pendingRequest.id, itemId: actellicLine.id },
    { requestId: pendingRequest.id, itemId: bioprenLine.id },
  ], "usage-bulk", asOf),
  "bulk",
);
assert.deepEqual(stockSnapshot(bulk.state), stockBeforeApproval);
assert.equal(bulk.state.requests.find((request) => request.id === pendingRequest.id)?.status, "OPERATION_MANAGER_APPROVED");

const beforeAqua = stockSnapshot(bulk.state).find((row) => row.itemCode === "PST-0228")?.currentStock;
const aquaCreated = must(
  createTeamRequest(openZone(bulk.state, leaderA.zoneCode, asOf), leaderA, [{ materialId: MATERIAL_IDS.aqua, quantity: "10" }], asOf),
  "aqua",
);
let aqua = aquaCreated.state;
const aquaRequest = byNo(aqua, aquaCreated.data.requestNo);
const aquaItem = aquaRequest.items[0];
if (!aquaItem) throw new Error("aqua item");
aqua = must(
  decideRequestItems(aqua, supervisorA, aquaRequest.id, [{
    itemId: aquaItem.id,
    decision: "APPROVED",
    approvedQuantity: "10",
    rejectionReason: "",
  }], "aqua-sup", asOf),
  "aqua supervisor",
).state;
aqua = must(
  decideOperationItems(aqua, operationManager, aquaRequest.id, [{
    itemId: aquaItem.id,
    decision: "APPROVED",
    approvedQuantity: "7",
    rejectionReason: "",
  }], "aqua-om", asOf),
  "aqua operation",
).state;
const approvedRow = aqua.requests.find((request) => request.id === aquaRequest.id)?.items[0];
assert.equal(approvedRow?.approvedQuantity, "10");
assert.equal(approvedRow?.omApprovedQuantity, "7");
assert.equal(usageOf(aqua, USER_IDS.leaderA, MATERIAL_IDS.aqua, "7").level, "No Previous Issue");
aqua = must(prepareRequest(aqua, keeper, aquaRequest.id, asOf), "aqua prepare").state;
const ticketCount = aqua.tickets.length;
aqua = must(
  issueRequest(aqua, keeper, aquaRequest.id, [{ itemId: aquaItem.id, quantity: "6" }], "aqua-issue", asOf),
  "aqua issue",
).state;
const issuedRow = aqua.requests.find((request) => request.id === aquaRequest.id);
assert.equal(issuedRow?.status, "PREPARED");
assert.equal(issuedRow?.items[0]?.quantityIssued, "6");
assert.equal(issuedRow?.items[0]?.approvedQuantity, "10");
assert.equal(issuedRow?.items[0]?.omApprovedQuantity, "7");
assert.equal(aqua.tickets.length, ticketCount);
const partialTicket = buildTicket(aqua, aquaRequest.id);
assert.equal(partialTicket?.lines[0]?.issued, "6");
assert.equal(partialTicket?.lines[0]?.supervisorApproved, "10");
assert.equal(partialTicket?.lines[0]?.approved, "7");
assert.equal(partialTicket?.lines[0]?.requested, "10");
const issueMovements = aqua.movements.filter(
  (movement) => movement.type === "ISSUE" && movement.requestId === aquaRequest.id,
);
assert.equal(issueMovements.length, 1);
assert.equal(issueMovements[0]?.quantityChange, "-6.0");
const afterAqua = aqua.materials.find((material) => material.id === MATERIAL_IDS.aqua)?.currentStock;
assert.equal(beforeAqua, "100.0");
assert.equal(afterAqua, "94.0");
const stages = aqua.approvals.filter((record) => record.requestId === aquaRequest.id).map((record) => record.stage);
assert.deepEqual(stages, ["SUPERVISOR", "OPERATION_MANAGER"]);

const followUp = must(
  createTeamRequest(openZone(aqua, leaderA.zoneCode, asOf), leaderA, [{ materialId: MATERIAL_IDS.aqua, quantity: "1" }], asOf),
  "follow",
);
let follow = followUp.state;
const followRequest = byNo(follow, followUp.data.requestNo);
follow = must(
  decideRequestItems(follow, supervisorA, followRequest.id, [{
    itemId: followRequest.items[0].id,
    decision: "APPROVED",
    approvedQuantity: "1",
    rejectionReason: "",
  }], "follow-sup", asOf),
  "follow supervisor",
).state;
const followUsage = usageOf(follow, USER_IDS.leaderA, MATERIAL_IDS.aqua, "1");
assert.equal(followUsage.lastQuantity, "6");
assert.equal(followUsage.days30, "6");
assert.equal(followUsage.recent[0]?.quantity, "6");
assert.equal(followUsage.recent[0]?.reference, ticketLabel(aquaRequest.requestNo));
assert.equal(usageOf(follow, USER_IDS.leaderD, MATERIAL_IDS.aqua, "1").lastQuantity, "3.0");
assert.equal(usageOf(follow, USER_IDS.leaderD, MATERIAL_IDS.aqua, "1").days30, "3.0");

const supervisorReview = projectSupervisorReview(follow, supervisorA, followRequest.id);
assert.equal(supervisorReview?.items.some((item) => "usage" in item), false);
assert.equal(supervisorReview?.items.some((item) => "currentStock" in item), false);

console.log("Usage history checks passed.");
