"use server";

import { redirect } from "next/navigation";

import { portalPath, LOGIN_UNAVAILABLE } from "./access";
import {
  assessLogin,
  findCredential,
  hasActiveAdminCredential,
  replaceOwnPassword,
  setEmployeeLogin,
} from "./accounts";
import { hashPassword, passwordPolicy, verifyPassword } from "./password";
import { clearSession, currentActor, currentTokenHash, enterArea, startSession } from "./session";
import {
  addDemoUser,
  approveRequest,
  assignTeamLeader,
  assignZoneSupervisor,
  clearTeamLeaderAssignment,
  adjustStock,
  createCategory,
  createMaterial,
  createSupervisorProfile,
  bulkApproveRequests,
  bulkApproveOperationLines,
  canChangeInventory,
  canReadInventory,
  createTeamRequest,
  decideOperationItems,
  decideRequestItems,
  deleteMaterial,
  displayName,
  issueRequest,
  prepareRequest,
  receiveStock,
  rejectOperationLine,
  rejectRequest,
  reverseMovement,
  setCountedStock,
  setMaterialActive,
  setMaterialCategory,
  activatePpeInterval,
  addPpeInterval,
  removePpeInterval,
  setPpeReplacementDays,
  setRequestable,
  updatePpeInterval,
  setZoneRequestStatus,
  updateCategory,
  updateDemoUser,
  updateMaterialDetails,
  updateSupervisorProfile,
} from "./rules";
import { StoreConflict } from "./blob-store";
import { readWorkspace, resetWorkspace, updateWorkspace } from "./store";
import {
  buildInventoryWorkbook,
  buildMaterialHistoryWorkbook,
} from "@/lib/inventory/export-workbook";
import { formatDubai } from "@/lib/format";
import { canReadPpeHistory, normalizeEmployeeId, ppeIndex, ppeReplacementDays } from "./ppe";
import type {
  Area,
  RequestStatus,
  Role,
  ZoneAvailability,
  ZoneCode,
} from "./types";
import {
  projectAdmin,
  projectInventory,
  projectIssueBoard,
  projectIssuedHistory,
  projectMaterialHistory,
  projectOperationHome,
  projectOperationReports,
  projectOperationReview,
  projectRequestDetail,
  projectStoreDashboard,
  projectSupervisor,
  projectSupervisorReview,
  projectTeamLeader,
  ticketForActor,
} from "./views";

function now() {
  return new Date().toISOString();
}

const SAFE_STORE_ERRORS = new Set([
  "The demonstration file is unreadable.",
  "The account store is unreadable.",
  "The account store could not be read. Try again.",
  "The account could not be saved. Try again.",
]);

function storeError(error: unknown) {
  if (error instanceof StoreConflict) return error.message;
  if (error instanceof Error && SAFE_STORE_ERRORS.has(error.message)) return error.message;
  return "The change could not be saved.";
}

async function mutate(
  fn: (
    state: Awaited<ReturnType<typeof readWorkspace>>,
    actor: NonNullable<Awaited<ReturnType<typeof currentActor>>>,
  ) => ReturnType<typeof approveRequest> | { ok: false; error: string },
) {
  const actor = await currentActor();
  if (!actor) {
    return { ok: false as const, error: "Sign in to continue." };
  }
  let result: Awaited<ReturnType<typeof updateWorkspace>>;
  try {
    result = await updateWorkspace((state) => fn(state, actor));
  } catch (error) {
    return { ok: false as const, error: storeError(error) };
  }
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, replayed: result.replayed };
}

async function mutateInventory(
  fn: (
    state: Awaited<ReturnType<typeof readWorkspace>>,
    actor: NonNullable<Awaited<ReturnType<typeof currentActor>>>,
  ) => ReturnType<typeof createMaterial>,
) {
  const actor = await currentActor();
  if (!canChangeInventory(actor)) {
    return { ok: false as const, error: "Only a store keeper can change inventory." };
  }
  return mutate(fn);
}

export async function openArea(area: Area, userId?: string) {
  const actor = await enterArea(area, userId);
  return {
    id: actor.id,
    displayName: actor.displayName,
    role: actor.role,
  };
}

export async function getStoreDashboard() {
  const actor = await enterArea("store");
  const state = await readWorkspace();
  return projectStoreDashboard(state, actor);
}

export async function getInventoryPage() {
  const actor = await enterArea("store");
  const state = await readWorkspace();
  return projectInventory(state, actor);
}

export async function getIssueBoard(statuses: RequestStatus[]) {
  const actor = await enterArea("store");
  const state = await readWorkspace();
  const allowed = statuses.filter(
    (status) =>
      status === "APPROVED" ||
      status === "FULLY_APPROVED" ||
      status === "PARTIALLY_APPROVED" ||
      status === "OPERATION_MANAGER_APPROVED" ||
      status === "PREPARED",
  );
  const board = projectIssueBoard(
    state,
    allowed.length > 0
      ? allowed
      : ["FULLY_APPROVED", "PARTIALLY_APPROVED", "APPROVED", "OPERATION_MANAGER_APPROVED", "PREPARED"],
  );
  return { actor: projectStoreDashboard(state, actor).actor, zones: board.zones };
}

export async function getIssuedHistory() {
  const actor = await enterArea("store");
  const state = await readWorkspace();
  return projectIssuedHistory(state, actor);
}

export async function getRequestDetail(requestId: string) {
  const actor = await currentActor();
  if (!actor || actor.role !== "STORE_KEEPER") {
    return { ok: false as const, error: "Only a store keeper can open this request." };
  }
  const state = await readWorkspace();
  const detail = projectRequestDetail(state, actor, requestId);
  if (!detail) return { ok: false as const, error: "That request was not found." };
  return { ok: true as const, detail };
}

export async function prepareRequestAction(requestId: string) {
  return mutate((state, actor) => prepareRequest(state, actor, requestId, now()));
}

export async function issueRequestAction(
  requestId: string,
  lines: { itemId: string; quantity: string; employees?: { employeeId: string; quantity: string }[] }[],
  idempotencyKey: string,
) {
  return mutate((state, actor) =>
    issueRequest(state, actor, requestId, lines, idempotencyKey, now()),
  );
}

export async function getPpeIssueHistoryAction(employeeId: string, materialId: string) {
  const actor = await currentActor();
  if (!actor || !canReadPpeHistory(actor)) {
    return { ok: false as const, error: "You do not have permission for this action." };
  }
  const key = normalizeEmployeeId(employeeId);
  if (!key) return { ok: false as const, error: "Enter an employee ID." };
  const state = await readWorkspace();
  const material = state.materials.find((item) => item.id === materialId);
  const rows = ppeIndex(state, now()).history(key, materialId, (id) => displayName(state, id));
  return {
    ok: true as const,
    employeeId: key,
    productName: material?.productName ?? "PPE",
    unit: material?.unit ?? "",
    intervalDays: ppeReplacementDays(state),
    rows,
  };
}

export async function setPpeReplacementDaysAction(days: number) {
  return mutate((state, actor) => setPpeReplacementDays(state, actor, days));
}

export async function addPpeIntervalAction(days: number) {
  return mutate((state, actor) => {
    const result = addPpeInterval(state, actor, days);
    if (!result.ok) return result;
    return { ok: true as const, state: result.state, replayed: result.replayed, data: null };
  });
}

export async function updatePpeIntervalAction(id: string, days: number) {
  return mutate((state, actor) => updatePpeInterval(state, actor, id, days));
}

export async function activatePpeIntervalAction(id: string) {
  return mutate((state, actor) => activatePpeInterval(state, actor, id));
}

export async function removePpeIntervalAction(id: string) {
  return mutate((state, actor) => removePpeInterval(state, actor, id));
}

export async function createMaterialAction(input: {
  itemCode: string;
  productName: string;
  activeIngredient: string;
  unit: string;
  currentStock: string;
  requestable: boolean;
  categoryId?: string | null;
}) {
  return mutateInventory((state, actor) => createMaterial(state, actor, input, now()));
}

export async function updateMaterialAction(input: {
  materialId: string;
  productName: string;
  activeIngredient: string;
  unit: string;
  categoryId?: string | null;
}) {
  return mutateInventory((state, actor) => updateMaterialDetails(state, actor, input, now()));
}

export async function getMaterialHistory(materialId: string) {
  const actor = await enterArea("store");
  const state = await readWorkspace();
  const page = projectMaterialHistory(state, actor, materialId, "store");
  if (!page) return { ok: false as const, error: "That material was not found." };
  return { ok: true as const, page };
}

export async function getOperationMaterialList() {
  const actor = await enterArea("operations");
  if (actor.role !== "OPERATION_MANAGER" || !actor.active) {
    throw new Error("Only an operation manager can view this inventory.");
  }
  const state = await readWorkspace();
  return projectInventory(state, actor);
}

export async function getOperationMaterialHistory(materialId: string) {
  const actor = await enterArea("operations");
  if (actor.role !== "OPERATION_MANAGER" || !actor.active) {
    return { ok: false as const, error: "Only an operation manager can view this inventory." };
  }
  const state = await readWorkspace();
  const page = projectMaterialHistory(state, actor, materialId, "operations");
  if (!page) return { ok: false as const, error: "That material was not found." };
  return { ok: true as const, page };
}

export async function getOperationReports() {
  const actor = await enterArea("operations");
  const state = await readWorkspace();
  const report = projectOperationReports(state, actor);
  if (!report) return { ok: false as const, error: "Only an operation manager can open these reports." };
  return { ok: true as const, report };
}

export async function receiveStockAction(input: {
  materialId: string;
  quantity: string;
  receiptDate: string;
  reference: string;
  supplier: string;
  notes: string;
  idempotencyKey: string;
}) {
  return mutateInventory((state, actor) => receiveStock(state, actor, input, now()));
}

export async function adjustStockAction(input: {
  materialId: string;
  mode: "increase" | "decrease" | "count";
  quantity: string;
  reason: string;
  reference: string;
  idempotencyKey: string;
}) {
  return mutateInventory((state, actor) => adjustStock(state, actor, input, now()));
}

export async function reverseMovementAction(input: {
  movementId: string;
  reason: string;
  idempotencyKey: string;
}) {
  return mutateInventory((state, actor) =>
    reverseMovement(state, actor, input.movementId, input.reason, input.idempotencyKey, now()),
  );
}

export async function deleteMaterialAction(materialId: string) {
  return mutateInventory((state, actor) => deleteMaterial(state, actor, materialId));
}

export async function setCountedStockAction(input: {
  materialId: string;
  quantity: string;
  reason: string;
}) {
  return mutateInventory((state, actor) =>
    setCountedStock(state, actor, input.materialId, input.quantity, input.reason, now()),
  );
}

export async function setRequestableAction(materialId: string, requestable: boolean) {
  return mutateInventory((state, actor) => setRequestable(state, actor, materialId, requestable, now()));
}

export async function setMaterialActiveAction(materialId: string, active: boolean) {
  return mutateInventory((state, actor) => setMaterialActive(state, actor, materialId, active, now()));
}

export async function exportInventoryAction(materialIds: string[] | null) {
  const actor = await currentActor();
  if (!actor || !canReadInventory(actor)) {
    return { ok: false as const, error: "Only a store keeper or an operation manager can export inventory." };
  }
  const state = await readWorkspace();
  const page = projectInventory(state, actor);
  const selected = materialIds
    ? page.materials.filter((material) => materialIds.includes(material.id))
    : page.materials;
  const scopeLabel =
    !materialIds || selected.length === page.materials.length
      ? `All materials (${page.materials.length}).`
      : `Filtered materials (${selected.length} of ${page.materials.length}).`;
  const file = await buildInventoryWorkbook({
    exportedAtIso: now(),
    scopeLabel,
    rows: selected.map((material) => ({
      itemCode: material.itemCode,
      description: material.productName,
      category: material.categoryName ?? "Unassigned",
      unit: material.unit,
      opening: material.beginningInventory,
      received: material.newStock,
      issued: material.out,
      current: material.currentStock,
      status: material.active ? "Active" : "Inactive",
      requestable: material.requestable ? "Yes" : "No",
    })),
  });
  return { ok: true as const, ...file, scopeLabel };
}

export async function exportMaterialHistoryAction(materialId: string, movementIds: string[] | null) {
  const actor = await currentActor();
  if (!actor || !canReadInventory(actor)) {
    return { ok: false as const, error: "Only a store keeper or an operation manager can export material history." };
  }
  const state = await readWorkspace();
  const page = projectMaterialHistory(state, actor, materialId);
  if (!page) return { ok: false as const, error: "That material was not found." };
  const selected = movementIds
    ? page.entries.filter((entry) => movementIds.includes(entry.id))
    : page.entries;
  const scopeLabel =
    !movementIds || selected.length === page.entries.length
      ? `Full history (${page.entries.length} transactions).`
      : `Filtered history (${selected.length} of ${page.entries.length} transactions).`;
  const file = await buildMaterialHistoryWorkbook({
    exportedAtIso: now(),
    scopeLabel,
    itemCode: page.material.itemCode,
    description: page.material.productName,
    category: page.material.categoryName ?? "Unassigned",
    unit: page.material.unit,
    status: page.material.active ? "Active" : "Inactive",
    opening: page.material.beginningInventory,
    current: page.material.currentStock,
    received: page.material.newStock,
    issued: page.material.out,
    transactionCount: page.material.transactionCount,
    rows: selected.map((entry) => ({
      when: formatDubai(entry.createdAt),
      receiptDate: entry.receiptDate ?? "",
      type: entry.typeLabel,
      quantity: entry.quantityChange,
      before: entry.quantityBefore,
      after: entry.quantityAfter,
      reference: entry.reference ?? "",
      supplier: entry.supplier ?? "",
      teamLeader: entry.teamLeaderName ?? "",
      supervisor: entry.supervisorName ?? "",
      storeKeeper: entry.storeKeeperName ?? "",
      performedBy: entry.performedByName,
      reason: entry.reason,
    })),
  });
  return { ok: true as const, ...file, scopeLabel };
}

export async function getTeamLeaderHome() {
  const actor = await enterArea("leader");
  const state = await readWorkspace();
  return projectTeamLeader(state, actor, now());
}

export async function setZoneRequestStatusAction(input: {
  zoneCode: ZoneCode;
  status: ZoneAvailability;
  note?: string;
}) {
  return mutate((state, actor) => setZoneRequestStatus(state, actor, input, now()));
}

export async function createCategoryAction(name: string) {
  return mutateInventory((state, actor) => createCategory(state, actor, name, now()));
}

export async function updateCategoryAction(input: {
  categoryId: string;
  name: string;
  active: boolean;
}) {
  return mutateInventory((state, actor) => updateCategory(state, actor, input, now()));
}

export async function setMaterialCategoryAction(materialId: string, categoryId: string | null) {
  return mutateInventory((state, actor) => setMaterialCategory(state, actor, materialId, categoryId, now()));
}

export async function createTeamRequestAction(input: {
  lines: { materialId: string; quantity: string }[];
  employees: { employeeId: string; lines: { materialId: string; quantity: string }[] }[];
}) {
  const actor = await currentActor();
  if (!actor) return { ok: false as const, error: "Open the team leader page again." };
  const result = await updateWorkspace((state) => createTeamRequest(state, actor, input, now()));
  if (!result.ok) return result;
  return { ok: true as const, requestNo: result.data.requestNo };
}

export async function getSupervisorHome() {
  const actor = await enterArea("supervisor");
  const state = await readWorkspace();
  return projectSupervisor(state, actor);
}

export async function approveRequestAction(requestId: string) {
  return mutate((state, actor) => approveRequest(state, actor, requestId, now()));
}

export async function rejectRequestAction(requestId: string, reason: string) {
  return mutate((state, actor) => rejectRequest(state, actor, requestId, reason, now()));
}

export async function bulkApproveRequestsAction(requestIds: string[], idempotencyKey: string) {
  return mutate((state, actor) =>
    bulkApproveRequests(state, actor, requestIds, idempotencyKey, now()),
  );
}

export async function decideRequestItemsAction(
  requestId: string,
  decisions: {
    itemId: string;
    decision: "APPROVED" | "REJECTED";
    approvedQuantity: string;
    rejectionReason: string;
  }[],
  idempotencyKey: string,
) {
  return mutate((state, actor) =>
    decideRequestItems(state, actor, requestId, decisions, idempotencyKey, now()),
  );
}

export async function getSupervisorReview(requestId: string) {
  const actor = await enterArea("supervisor");
  const state = await readWorkspace();
  const review = projectSupervisorReview(state, actor, requestId);
  if (!review) return { ok: false as const, error: "That request is not assigned to you." };
  return { ok: true as const, review };
}

export async function getOperationHome() {
  const actor = await enterArea("operations");
  const state = await readWorkspace();
  return projectOperationHome(state, actor);
}

export async function getOperationReview(requestId: string) {
  const actor = await enterArea("operations");
  const state = await readWorkspace();
  const review = projectOperationReview(state, actor, requestId);
  if (!review) return { ok: false as const, error: "That request is not ready for the operation manager." };
  return { ok: true as const, review };
}

export async function bulkApproveOperationLinesAction(
  lines: { requestId: string; itemId: string }[],
  idempotencyKey: string,
) {
  const actor = await currentActor();
  if (!actor) {
    return { ok: false as const, error: "Sign in to continue." };
  }
  const result = await updateWorkspace((state) =>
    bulkApproveOperationLines(state, actor, lines, idempotencyKey, now()),
  );
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, replayed: result.replayed, data: result.data };
}

export async function rejectOperationLineAction(
  input: { requestId: string; itemId: string; rejectionReason: string },
  idempotencyKey: string,
) {
  return mutate((state, actor) => rejectOperationLine(state, actor, input, idempotencyKey, now()));
}

export async function decideOperationItemsAction(
  requestId: string,
  decisions: {
    itemId: string;
    decision: "APPROVED" | "REJECTED";
    approvedQuantity: string;
    rejectionReason: string;
  }[],
  idempotencyKey: string,
) {
  return mutate((state, actor) =>
    decideOperationItems(state, actor, requestId, decisions, idempotencyKey, now()),
  );
}

export async function getAdminHome() {
  const actor = await enterArea("admin");
  const state = await readWorkspace();
  return projectAdmin(state, actor);
}

export async function assignSupervisorAction(zoneCode: ZoneCode, supervisorId: string) {
  return mutate((state, actor) => assignZoneSupervisor(state, actor, zoneCode, supervisorId));
}

export async function updateUserAction(input: {
  userId: string;
  displayName: string;
  role: Role;
  zoneCode: ZoneCode | null;
  supervisorId: string | null;
  active: boolean;
  teamName: string | null;
  employeeId: string;
  email: string;
  password: string;
}) {
  const password = input.password;
  if (password) {
    const policy = passwordPolicy(password);
    if (policy) return { ok: false as const, error: policy };
  }
  const passwordHash = password ? await hashPassword(password) : null;
  return mutate((state, actor) => {
    const updated = updateDemoUser(state, actor, {
      userId: input.userId,
      displayName: input.displayName,
      role: input.role,
      zoneCode: input.zoneCode,
      supervisorId: input.supervisorId,
      active: input.active,
      teamName: input.teamName,
    });
    if (!updated.ok) return updated;
    return setEmployeeLogin(updated.state, actor, {
      userId: input.userId,
      employeeId: input.employeeId,
      email: input.email,
      passwordHash,
    });
  });
}

export async function addUserAction(input: {
  displayName: string;
  role: Role;
  zoneCode: ZoneCode | null;
  supervisorId: string | null;
  teamName: string | null;
  employeeId: string;
  email: string;
  password: string;
}) {
  const policy = passwordPolicy(input.password);
  if (policy) return { ok: false as const, error: policy };
  const passwordHash = await hashPassword(input.password);
  const actor = await currentActor();
  if (!actor) return { ok: false as const, error: "Sign in to continue." };
  let result: Awaited<ReturnType<typeof updateWorkspace>>;
  try {
    result = await updateWorkspace((state) => {
      const created = addDemoUser(state, actor, input);
      if (!created.ok) return created;
      return setEmployeeLogin(created.state, actor, {
        userId: created.data,
        employeeId: input.employeeId,
        email: input.email,
        passwordHash,
      });
    });
  } catch (error) {
    return { ok: false as const, error: storeError(error) };
  }
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const };
}

let timingHash: Promise<string> | null = null;

export async function loginAction(identifier: string, password: string) {
  let state;
  try {
    state = await readWorkspace();
  } catch (error) {
    return { ok: false as const, error: storeError(error) };
  }
  if (!hasActiveAdminCredential(state)) {
    return { ok: false as const, error: LOGIN_UNAVAILABLE };
  }
  const credential = findCredential(state, identifier);
  timingHash ??= hashPassword("unused-timing-pad");
  const passwordOk = await verifyPassword(password, credential?.passwordHash ?? (await timingHash));
  const decision = assessLogin(state, identifier, Boolean(credential) && passwordOk);
  if (!decision.ok) return { ok: false as const, error: decision.error };
  let started;
  try {
    started = await startSession(decision.user.id);
  } catch (error) {
    return { ok: false as const, error: storeError(error) };
  }
  if (!started.ok) return { ok: false as const, error: started.error };
  return { ok: true as const, href: portalPath(decision.user.role) };
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}

export async function changePasswordAction(
  currentPassword: string,
  nextPassword: string,
  confirmPassword: string,
) {
  if (nextPassword !== confirmPassword) {
    return { ok: false as const, error: "Enter the same new password in both fields." };
  }
  const policy = passwordPolicy(nextPassword);
  if (policy) return { ok: false as const, error: policy };
  const actor = await currentActor();
  const keep = await currentTokenHash();
  if (!actor || !keep) return { ok: false as const, error: "Sign in to continue." };
  const state = await readWorkspace();
  const credential = state.credentials.find((item) => item.userId === actor.id);
  if (!credential) {
    return { ok: false as const, error: "This account has no password yet. Ask an administrator." };
  }
  const matches = await verifyPassword(currentPassword, credential.passwordHash);
  if (!matches) return { ok: false as const, error: "The current password is incorrect." };
  const passwordHash = await hashPassword(nextPassword);
  const saved = await updateWorkspace((current) =>
    replaceOwnPassword(current, actor.id, passwordHash, keep),
  );
  if (!saved.ok) return { ok: false as const, error: saved.error };
  return { ok: true as const };
}

export async function resetDemonstrationAction() {
  const actor = await currentActor();
  if (!actor || actor.role !== "ADMIN") {
    return { ok: false as const, error: "Only the administrator can reset the demonstration file." };
  }
  await resetWorkspace();
  return { ok: true as const };
}

export async function readTicket(requestId: string) {
  const actor = await currentActor();
  if (!actor) return null;
  const state = await readWorkspace();
  return ticketForActor(state, actor, requestId);
}

export async function createSupervisorAction(displayName: string) {
  return mutate((state, actor) => createSupervisorProfile(state, actor, displayName));
}

export async function updateSupervisorAction(input: {
  userId: string;
  displayName: string;
  active: boolean;
}) {
  return mutate((state, actor) => updateSupervisorProfile(state, actor, input));
}

export async function assignTeamLeaderAction(teamLeaderId: string, supervisorId: string) {
  return mutate((state, actor) => assignTeamLeader(state, actor, teamLeaderId, supervisorId));
}

export async function clearTeamLeaderAction(teamLeaderId: string) {
  return mutate((state, actor) => clearTeamLeaderAssignment(state, actor, teamLeaderId));
}
