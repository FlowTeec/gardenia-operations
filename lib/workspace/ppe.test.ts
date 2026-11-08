import assert from "node:assert/strict";

import { ticketLabel } from "@/lib/format";
import { canReadPpeHistory, ppeIndex } from "./ppe";
import {
  createTeamRequest,
  decideOperationItems,
  decideRequestItems,
  issueRequest,
  activatePpeInterval,
  addPpeInterval,
  normalizeWorkspace,
  prepareRequest,
  removePpeInterval,
  setPpeReplacementDays,
  setZoneRequestStatus,
  updatePpeInterval,
} from "./rules";
import { MATERIAL_IDS, USER_IDS, createSeed } from "./seed";
import type { DemoUser, MaterialRequest, Mutation, Workspace } from "./types";
import { dubaiDayNumber, usageByLeaderMaterial } from "./usage";
import {
  buildTicket,
  projectIssueBoard,
  projectOperationHome,
  projectOperationReview,
  projectRequestDetail,
  projectSupervisorReview,
} from "./views";

const TODAY = "2026-10-27T12:00:00.000Z";
const YESTERDAY = "2026-10-26T12:00:00.000Z";
const DAYS_30 = "2026-09-27T12:00:00.000Z";
const DAYS_89 = "2026-07-30T12:00:00.000Z";
const DAYS_90 = "2026-07-29T12:00:00.000Z";

function user(state: Workspace, id: string): DemoUser {
  const found = state.users.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

function must<T>(result: Mutation<T>, label: string) {
  if (!result.ok) throw new Error(`${label}: ${result.error}`);
  return result;
}

function stockOf(state: Workspace, materialId: string) {
  return state.materials.find((item) => item.id === materialId)?.currentStock ?? "";
}

function requestById(state: Workspace, id: string) {
  const request = state.requests.find((item) => item.id === id);
  if (!request) throw new Error(id);
  return request;
}

function openZone(state: Workspace, when: string) {
  return must(
    setZoneRequestStatus(
      state,
      user(state, USER_IDS.operationManager),
      { zoneCode: "A", status: "OPEN" },
      when,
    ),
    `open ${when}`,
  ).state;
}

type EmployeeInput = { employeeId: string; lines: { materialId: string; quantity: string }[] };

function submitPpe(state: Workspace, when: string, employees: EmployeeInput[], key: string) {
  const created = must(
    createTeamRequest(
      openZone(state, when),
      user(state, USER_IDS.leaderA),
      { lines: [], employees },
      when,
    ),
    `${key} create`,
  );
  const request = created.state.requests.find((item) => item.requestNo === created.data.requestNo);
  if (!request) throw new Error(`${key} row`);
  return { state: created.state, request };
}

function approvePpe(state: Workspace, request: MaterialRequest, when: string, key: string) {
  let next = must(
    decideRequestItems(
      state,
      user(state, USER_IDS.supervisorA),
      request.id,
      request.items.map((item) => ({
        itemId: item.id,
        decision: "APPROVED" as const,
        approvedQuantity: item.quantityRequested,
        rejectionReason: "",
      })),
      `${key}-sup`,
      when,
    ),
    `${key} supervisor`,
  ).state;
  const supervised = requestById(next, request.id);
  next = must(
    decideOperationItems(
      next,
      user(next, USER_IDS.operationManager),
      request.id,
      supervised.items
        .filter((item) => item.decision === "APPROVED")
        .map((item) => ({
          itemId: item.id,
          decision: "APPROVED" as const,
          approvedQuantity: item.approvedQuantity,
          rejectionReason: "",
        })),
      `${key}-om`,
      when,
    ),
    `${key} operation`,
  ).state;
  return { state: next, request: requestById(next, request.id) };
}

function supervisorOnly(state: Workspace, request: MaterialRequest, when: string, key: string) {
  const next = must(
    decideRequestItems(
      state,
      user(state, USER_IDS.supervisorA),
      request.id,
      request.items.map((item) => ({
        itemId: item.id,
        decision: "APPROVED" as const,
        approvedQuantity: item.quantityRequested,
        rejectionReason: "",
      })),
      `${key}-sup`,
      when,
    ),
    `${key} supervisor`,
  ).state;
  return { state: next, request: requestById(next, request.id) };
}

function issuePpe(
  state: Workspace,
  request: MaterialRequest,
  when: string,
  key: string,
  quantities?: Record<string, string>,
  employees?: Record<string, { employeeId: string; quantity: string }[]>,
) {
  const keeper = user(state, USER_IDS.storeKeeper);
  let next = must(prepareRequest(state, keeper, request.id, when), `${key} prepare`).state;
  const prepared = requestById(next, request.id);
  next = must(
    issueRequest(
      next,
      keeper,
      request.id,
      prepared.items.map((item) => ({
        itemId: item.id,
        quantity: quantities?.[item.materialId] ?? item.quantityRequested,
        ...(employees?.[item.materialId] ? { employees: employees[item.materialId] } : {}),
      })),
      `${key}-issue`,
      when,
    ),
    `${key} issue`,
  ).state;
  return { state: next, request: requestById(next, request.id) };
}

function checkOf(state: Workspace, employeeId: string, materialId: string, asOf = TODAY) {
  return ppeIndex(state, asOf).check(employeeId, materialId, "1", "PAIR", "0");
}

assert.equal(dubaiDayNumber(TODAY)! - dubaiDayNumber(DAYS_30)!, 30);
assert.equal(dubaiDayNumber(TODAY)! - dubaiDayNumber(DAYS_89)!, 89);
assert.equal(dubaiDayNumber(TODAY)! - dubaiDayNumber(DAYS_90)!, 90);
assert.equal(dubaiDayNumber(TODAY)! - dubaiDayNumber(YESTERDAY)!, 1);

const leader = user(createSeed(), USER_IDS.leaderA);
const supervisor = user(createSeed(), USER_IDS.supervisorA);
const manager = user(createSeed(), USER_IDS.operationManager);
const keeper = user(createSeed(), USER_IDS.storeKeeper);
const admin = user(createSeed(), USER_IDS.admin);
assert.equal(canReadPpeHistory(manager), true);
assert.equal(canReadPpeHistory(keeper), true);
assert.equal(canReadPpeHistory(admin), true);
assert.equal(canReadPpeHistory(leader), false);
assert.equal(canReadPpeHistory(supervisor), false);
assert.equal(canReadPpeHistory({ ...manager, active: false }), false);

const firstSeen = submitPpe(createSeed(), TODAY, [
  { employeeId: " EMP-1025 ", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "2" }] },
], "none");
assert.equal(firstSeen.request.ppeAllocations?.[0]?.employeeId, "EMP-1025");
const noIssue = checkOf(firstSeen.state, " EMP-1025 ", MATERIAL_IDS.gloves);
assert.equal(noIssue.status, "No Previous Issue");
assert.equal(noIssue.employeeId, "EMP-1025");
assert.equal(noIssue.lastQuantity, null);
assert.equal(noIssue.lastIssuedAt, null);
assert.equal(noIssue.daysSince, null);
assert.equal(noIssue.intervalDays, 90);

const issued30 = issuePpe(
  approvePpe(firstSeen.state, firstSeen.request, DAYS_30, "age30").state,
  firstSeen.request,
  DAYS_30,
  "age30",
);
assert.equal(issued30.request.issueReceipts[0]?.lines[0]?.employees?.[0]?.quantity, "2");
assert.equal(issued30.request.issueReceipts[0]?.lines[0]?.quantity, "2");
const within30 = checkOf(issued30.state, "EMP-1025", MATERIAL_IDS.gloves);
assert.equal(within30.status, "Within 3-Month Cycle");
assert.equal(within30.daysSince, 30);
assert.equal(within30.lastQuantity, "2");

const issued90 = issuePpe(
  ...(() => {
    const submitted = submitPpe(createSeed(), DAYS_90, [
      { employeeId: "EMP-1025", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "2" }] },
    ], "age90");
    const approved = approvePpe(submitted.state, submitted.request, DAYS_90, "age90");
    return [approved.state, approved.request, DAYS_90, "age90"] as const;
  })(),
);
assert.equal(checkOf(issued90.state, "EMP-1025", MATERIAL_IDS.gloves).status, "Eligible");
assert.equal(checkOf(issued90.state, "EMP-1025", MATERIAL_IDS.gloves).daysSince, 90);

const issued89 = issuePpe(
  ...(() => {
    const submitted = submitPpe(createSeed(), DAYS_89, [
      { employeeId: "EMP-1025", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "2" }] },
    ], "age89");
    const approved = approvePpe(submitted.state, submitted.request, DAYS_89, "age89");
    return [approved.state, approved.request, DAYS_89, "age89"] as const;
  })(),
);
assert.equal(checkOf(issued89.state, "EMP-1025", MATERIAL_IDS.gloves).status, "Within 3-Month Cycle");
assert.equal(checkOf(issued89.state, "EMP-1025", MATERIAL_IDS.gloves).daysSince, 89);

const glovesThenMask = issuePpe(
  ...(() => {
    const submitted = submitPpe(issued30.state, YESTERDAY, [
      { employeeId: "EMP-1025", lines: [{ materialId: MATERIAL_IDS.mask, quantity: "1" }] },
    ], "mask");
    const approved = approvePpe(submitted.state, submitted.request, YESTERDAY, "mask");
    return [approved.state, approved.request, YESTERDAY, "mask"] as const;
  })(),
);
const glovesOnly = checkOf(glovesThenMask.state, "EMP-1025", MATERIAL_IDS.gloves);
const maskOnly = checkOf(glovesThenMask.state, "EMP-1025", MATERIAL_IDS.mask);
assert.equal(glovesOnly.status, "Within 3-Month Cycle");
assert.equal(glovesOnly.daysSince, 30);
assert.equal(glovesOnly.lastQuantity, "2");
assert.equal(maskOnly.status, "Within 3-Month Cycle");
assert.equal(maskOnly.daysSince, 1);
assert.equal(maskOnly.lastQuantity, "1");

const otherEmployee = submitPpe(issued90.state, TODAY, [
  { employeeId: "EMP-1025", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "2" }] },
  { employeeId: "EMP-1031", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "2" }] },
], "two");
assert.equal(checkOf(otherEmployee.state, "EMP-1025", MATERIAL_IDS.gloves).status, "Eligible");
assert.equal(checkOf(otherEmployee.state, "EMP-1031", MATERIAL_IDS.gloves).status, "No Previous Issue");
assert.equal(otherEmployee.request.ppeAllocations?.length, 2);

const mixed = submitPpe(glovesThenMask.state, TODAY, [
  {
    employeeId: "EMP-1025",
    lines: [
      { materialId: MATERIAL_IDS.gloves, quantity: "2" },
      { materialId: MATERIAL_IDS.mask, quantity: "1" },
    ],
  },
], "mixed");
assert.equal(checkOf(mixed.state, "EMP-1025", MATERIAL_IDS.gloves).daysSince, 30);
assert.equal(checkOf(mixed.state, "EMP-1025", MATERIAL_IDS.mask).daysSince, 1);
assert.notEqual(
  checkOf(mixed.state, "EMP-1025", MATERIAL_IDS.gloves).lastIssuedAt,
  checkOf(mixed.state, "EMP-1025", MATERIAL_IDS.mask).lastIssuedAt,
);

const waiting = supervisorOnly(mixed.state, mixed.request, TODAY, "visible");
const home = projectOperationHome(waiting.state, manager, TODAY);
const gloveLine = home.queue
  .flatMap((group) => group.lines)
  .find((line) => line.itemCode === "PPE-0001" && line.requestId === mixed.request.id);
const maskLine = home.queue
  .flatMap((group) => group.lines)
  .find((line) => line.itemCode === "PPE-0002" && line.requestId === mixed.request.id);
assert.equal(gloveLine?.ppeChecks[0]?.status, "Within 3-Month Cycle");
assert.equal(gloveLine?.ppeChecks[0]?.daysSince, 30);
assert.equal(gloveLine?.ppeChecks[0]?.lastQuantity, "2");
assert.equal(gloveLine?.approvalStatus, "Pending operation manager");
assert.equal(maskLine?.ppeChecks[0]?.status, "Within 3-Month Cycle");
assert.equal(maskLine?.ppeChecks[0]?.daysSince, 1);
assert.equal(maskLine?.ppeChecks[0]?.employeeId, "EMP-1025");
const review = projectOperationReview(waiting.state, manager, mixed.request.id, TODAY);
assert.equal(
  review?.items.find((item) => item.itemCode === "PPE-0001")?.allocations[0]?.status,
  "Within 3-Month Cycle",
);
assert.equal(
  review?.items.find((item) => item.itemCode === "PPE-0002")?.allocations[0]?.status,
  "Within 3-Month Cycle",
);
const stillApproved = decideOperationItems(
  waiting.state,
  manager,
  mixed.request.id,
  waiting.request.items.map((item) => ({
    itemId: item.id,
    decision: "APPROVED" as const,
    approvedQuantity: item.approvedQuantity,
    rejectionReason: "",
  })),
  "within-ok",
  TODAY,
);
assert.equal(stillApproved.ok, true);
if (!stillApproved.ok) throw new Error("within cycle");
assert.equal(
  requestById(stillApproved.state, mixed.request.id).items.every((item) => item.omDecision === "APPROVED"),
  true,
);

const preparedBoard = projectIssueBoard(
  stillApproved.state,
  ["OPERATION_MANAGER_APPROVED", "PREPARED"],
  TODAY,
);
const boardCard = preparedBoard.zones
  .flatMap((zone) => zone.leaders.flatMap((group) => group.requests))
  .find((card) => card.id === mixed.request.id);
assert.equal(boardCard?.ppeChecks?.find((check) => check.materialId === MATERIAL_IDS.gloves)?.status, "Within 3-Month Cycle");
assert.equal(boardCard?.ppeChecks?.find((check) => check.materialId === MATERIAL_IDS.mask)?.daysSince, 1);
const storeDetail = projectRequestDetail(stillApproved.state, keeper, mixed.request.id, TODAY);
assert.equal(
  storeDetail?.items.find((item) => item.itemCode === "PPE-0001")?.ppeChecks[0]?.status,
  "Within 3-Month Cycle",
);
assert.equal(projectRequestDetail(stillApproved.state, leader, mixed.request.id, TODAY)?.items[0]?.ppeChecks.length, 0);
assert.equal(projectRequestDetail(stillApproved.state, supervisor, mixed.request.id, TODAY)?.items[0]?.ppeChecks.length, 0);
const supervisorReview = projectSupervisorReview(waiting.state, supervisor, mixed.request.id);
const supervisorAllocation = supervisorReview?.items.find((item) => item.itemCode === "PPE-0001")?.allocations[0];
assert.equal(supervisorAllocation?.employeeId, "EMP-1025");
assert.equal(supervisorAllocation !== undefined && "status" in supervisorAllocation, false);

const partialFlow = submitPpe(createSeed(), TODAY, [
  { employeeId: "EMP-1025", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "2" }] },
], "partial");
const partialApproved = approvePpe(partialFlow.state, partialFlow.request, TODAY, "partial");
const partialIssued = issuePpe(
  partialApproved.state,
  partialApproved.request,
  TODAY,
  "partial",
  { [MATERIAL_IDS.gloves]: "1" },
);
assert.equal(partialIssued.request.status, "PREPARED");
assert.equal(partialIssued.request.items[0]?.quantityIssued, "1");
assert.equal(partialIssued.request.issueReceipts[0]?.lines[0]?.quantity, "1");
assert.equal(partialIssued.request.issueReceipts[0]?.lines[0]?.employees?.[0]?.employeeId, "EMP-1025");
assert.equal(partialIssued.request.issueReceipts[0]?.lines[0]?.employees?.[0]?.quantity, "1");
assert.equal(stockOf(partialIssued.state, MATERIAL_IDS.gloves), "39.0");
const partialTicket = buildTicket(partialIssued.state, partialIssued.request.id);
assert.equal(partialTicket?.ppe[0]?.quantity, "2");
assert.equal(partialTicket?.ppe[0]?.issued, "1");
assert.equal(checkOf(partialIssued.state, "EMP-1025", MATERIAL_IDS.gloves).status, "Within 3-Month Cycle");
assert.equal(checkOf(partialIssued.state, "EMP-1025", MATERIAL_IDS.gloves).daysSince, 0);
assert.equal(checkOf(partialIssued.state, "EMP-1025", MATERIAL_IDS.gloves).lastQuantity, "1");
const laterPartial = submitPpe(partialIssued.state, TODAY, [
  { employeeId: "EMP-1025", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "2" }] },
], "partial-next");
assert.equal(checkOf(laterPartial.state, "EMP-1025", MATERIAL_IDS.gloves).lastQuantity, "1");

const splitFlow = submitPpe(createSeed(), TODAY, [
  { employeeId: "EMP-1025", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "2" }] },
  { employeeId: "EMP-1031", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "2" }] },
], "split");
const splitApproved = approvePpe(splitFlow.state, splitFlow.request, TODAY, "split");
const splitIssued = issuePpe(
  splitApproved.state,
  splitApproved.request,
  TODAY,
  "split",
  { [MATERIAL_IDS.gloves]: "1" },
);
assert.deepEqual(splitIssued.request.issueReceipts[0]?.lines[0]?.employees, [
  { employeeId: "EMP-1025", quantity: "1" },
]);
assert.equal(checkOf(splitIssued.state, "EMP-1025", MATERIAL_IDS.gloves).lastQuantity, "1");
assert.equal(checkOf(splitIssued.state, "EMP-1031", MATERIAL_IDS.gloves).status, "No Previous Issue");

const trimmed = submitPpe(createSeed(), TODAY, [
  { employeeId: "EMP-1025", lines: [{ materialId: MATERIAL_IDS.gloves, quantity: "2" }] },
], "trim");
const trimmedApproved = approvePpe(trimmed.state, trimmed.request, TODAY, "trim");
const trimmedPrepared = must(
  prepareRequest(trimmedApproved.state, keeper, trimmed.request.id, TODAY),
  "trim prepare",
).state;
const gloveItem = requestById(trimmedPrepared, trimmed.request.id).items[0];
if (!gloveItem) throw new Error("trim item");
const explicit = must(
  issueRequest(
    trimmedPrepared,
    keeper,
    trimmed.request.id,
    [{ itemId: gloveItem.id, quantity: "2", employees: [{ employeeId: " EMP-1025 ", quantity: "2" }] }],
    "trim-issue",
    TODAY,
  ),
  "trim issue",
);
assert.equal(requestById(explicit.state, trimmed.request.id).issueReceipts[0]?.lines[0]?.employees?.[0]?.employeeId, "EMP-1025");
assert.equal(checkOf(explicit.state, "emp-1025", MATERIAL_IDS.gloves).status, "No Previous Issue");

const beforeMismatch = stockOf(trimmedPrepared, MATERIAL_IDS.gloves);
const mismatch = issueRequest(
  trimmedPrepared,
  keeper,
  trimmed.request.id,
  [{ itemId: gloveItem.id, quantity: "2", employees: [{ employeeId: "EMP-1025", quantity: "1" }] }],
  "mismatch",
  TODAY,
);
assert.equal(mismatch.ok, false);
if (mismatch.ok) throw new Error("mismatch");
assert.match(mismatch.error, /add up/);
assert.equal(stockOf(trimmedPrepared, MATERIAL_IDS.gloves), beforeMismatch);

const chemicalDraft = (() => {
  const created = must(
    createTeamRequest(
      openZone(createSeed(), TODAY),
      leader,
      [{ materialId: MATERIAL_IDS.actellic, quantity: "1" }],
      TODAY,
    ),
    "chemical create",
  );
  const request = created.state.requests.find((item) => item.requestNo === created.data.requestNo);
  if (!request) throw new Error("chemical row");
  const approved = approvePpe(created.state, request, TODAY, "chemical");
  const prepared = must(prepareRequest(approved.state, keeper, request.id, TODAY), "chemical prepare").state;
  return { state: prepared, request: requestById(prepared, request.id) };
})();
const chemicalItem = chemicalDraft.request.items[0];
if (!chemicalItem) throw new Error("chemical item");
const chemicalStock = stockOf(chemicalDraft.state, MATERIAL_IDS.actellic);
const refusedEmployees = issueRequest(
  chemicalDraft.state,
  keeper,
  chemicalDraft.request.id,
  [{ itemId: chemicalItem.id, quantity: "1", employees: [{ employeeId: "EMP-1025", quantity: "1" }] }],
  "chemical-employees",
  TODAY,
);
assert.equal(refusedEmployees.ok, false);
if (refusedEmployees.ok) throw new Error("chemical employees");
assert.match(refusedEmployees.error, /Only PPE/);
assert.equal(stockOf(chemicalDraft.state, MATERIAL_IDS.actellic), chemicalStock);
const chemicalIssued = must(
  issueRequest(
    chemicalDraft.state,
    keeper,
    chemicalDraft.request.id,
    [{ itemId: chemicalItem.id, quantity: "1" }],
    "chemical-issue",
    TODAY,
  ),
  "chemical issue",
);
const chemical = { state: chemicalIssued.state, request: requestById(chemicalIssued.state, chemicalDraft.request.id) };
assert.equal(chemical.request.issueReceipts[0]?.lines[0]?.employees, undefined);
assert.equal(chemical.request.ppeAllocations?.length ?? 0, 0);
const chemicalUsage = usageByLeaderMaterial(chemical.state, TODAY).for(USER_IDS.leaderA, MATERIAL_IDS.actellic, "1");
assert.equal(chemicalUsage.lastQuantity, "1");
assert.equal(chemicalUsage.daysSince, 0);
assert.equal(checkOf(chemical.state, "EMP-1025", MATERIAL_IDS.actellic).status, "No Previous Issue");

const legacy = structuredClone(issued30.state);
const legacyRequest = legacy.requests.find((item) => item.id === issued30.request.id);
if (!legacyRequest?.issueReceipts[0]?.lines[0]) throw new Error("legacy receipt");
delete legacyRequest.issueReceipts[0].lines[0].employees;
assert.equal(checkOf(legacy, "EMP-1025", MATERIAL_IDS.gloves).status, "No PPE History");
assert.equal(checkOf(legacy, "EMP-1099", MATERIAL_IDS.gloves).status, "No PPE History");
const legacyHistory = ppeIndex(legacy, TODAY).history("EMP-1025", MATERIAL_IDS.gloves, () => "Store");
assert.equal(legacyHistory.length, 0);

const history = ppeIndex(glovesThenMask.state, TODAY).history("EMP-1025", MATERIAL_IDS.gloves, () => "Store Keeper (demo)");
assert.equal(history.length, 1);
assert.equal(history[0]?.quantity, "2");
assert.equal(history[0]?.reference, ticketLabel(issued30.request.requestNo));
assert.equal(history[0]?.productName, "NITRILE GLOVES");
const maskHistory = ppeIndex(glovesThenMask.state, TODAY).history("EMP-1025", MATERIAL_IDS.mask, () => "Store");
assert.equal(maskHistory.length, 1);
assert.equal(maskHistory[0]?.reference, ticketLabel(glovesThenMask.request.requestNo));
assert.notEqual(history[0]?.reference, maskHistory[0]?.reference);

assert.equal(setPpeReplacementDays(issued30.state, admin, 30).ok, false);
const interval = must(setPpeReplacementDays(issued30.state, manager, 30), "interval").state;
assert.equal(checkOf(interval, "EMP-1025", MATERIAL_IDS.gloves).status, "Eligible");
assert.equal(interval.ppeIntervals.find((item) => item.active)?.days, 30);
const replayedInterval = setPpeReplacementDays(interval, manager, 30);
assert.equal(replayedInterval.ok && replayedInterval.replayed, true);
const tighter = must(setPpeReplacementDays(interval, manager, 31), "tighter").state;
assert.equal(checkOf(tighter, "EMP-1025", MATERIAL_IDS.gloves).status, "Within 3-Month Cycle");
assert.equal(setPpeReplacementDays(tighter, admin, 10).ok, false);
assert.equal(setPpeReplacementDays(tighter, manager, 0).ok, false);
assert.equal(setPpeReplacementDays(tighter, manager, 3651).ok, false);
assert.equal(tighter.ppeReplacementDays, 31);
assert.equal(addPpeInterval(tighter, admin, 10).ok, false);
assert.equal(addPpeInterval(tighter, keeper, 10).ok, false);
const added = must(addPpeInterval(tighter, manager, 10), "add interval");
assert.equal(added.state.ppeReplacementDays, 31);
assert.equal(checkOf(added.state, "EMP-1025", MATERIAL_IDS.gloves).status, "Within 3-Month Cycle");
const edited = must(updatePpeInterval(added.state, manager, added.data, 12), "edit interval");
assert.equal(edited.state.ppeReplacementDays, 31);
const activated = must(activatePpeInterval(edited.state, manager, added.data), "activate interval");
assert.equal(activated.state.ppeReplacementDays, 12);
assert.equal(checkOf(activated.state, "EMP-1025", MATERIAL_IDS.gloves).status, "Eligible");
assert.equal(removePpeInterval(activated.state, manager, added.data).ok, false);
assert.equal(removePpeInterval(activated.state, admin, added.data).ok, false);
const previous = activated.state.ppeIntervals.find((item) => !item.active);
if (!previous) throw new Error("inactive interval");
const removed = must(removePpeInterval(activated.state, manager, previous.id), "remove interval");
assert.equal(removed.state.ppeIntervals.length, 1);
assert.equal(removed.state.ppeReplacementDays, 12);
const blank = createSeed();
blank.ppeReplacementDays = 0;
assert.equal(normalizeWorkspace(blank).ppeReplacementDays, 90);
assert.equal(normalizeWorkspace(blank).ppeIntervals.some((item) => item.active && item.days === 90), true);

const future = checkOf(issued30.state, "EMP-1025", MATERIAL_IDS.gloves, "2026-09-01T12:00:00.000Z");
assert.equal(future.status, "No Previous Issue");
