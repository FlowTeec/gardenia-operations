import assert from "node:assert/strict";

import { MATERIAL_IDS, USER_IDS, createSeed } from "./seed";
import {
  adjustStock,
  canChangeInventory,
  canReadInventory,
  createCategory,
  createMaterial,
  damageStock,
  decideOperationItems,
  deleteMaterial,
  receiveStock,
  reverseMovement,
  setCountedStock,
  setMaterialActive,
  setMaterialCategory,
  setRequestable,
  updateCategory,
  updateMaterialDetails,
} from "./rules";
import type { DemoUser, Workspace } from "./types";
import { projectMaterialHistory, projectOperationReports, stockSnapshot } from "./views";

const at = "2026-10-28T08:00:00.000Z";

function user(state: Workspace, id: string): DemoUser {
  const found = state.users.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

const seed = createSeed();
const manager = user(seed, USER_IDS.operationManager);
const keeper = user(seed, USER_IDS.storeKeeper);
const supervisor = user(seed, USER_IDS.supervisorA);
const leader = user(seed, USER_IDS.leaderA);
const before = stockSnapshot(seed);

assert.equal(canChangeInventory(manager), false);
assert.equal(canChangeInventory(supervisor), false);
assert.equal(canChangeInventory(leader), false);
assert.equal(canChangeInventory(keeper), true);
assert.equal(canReadInventory(manager), true);
assert.equal(canReadInventory(keeper), true);
assert.equal(canReadInventory(supervisor), false);
assert.equal(canReadInventory(leader), false);

const denied = [
  createMaterial(seed, manager, {
    itemCode: "PST-ZZ01",
    productName: "Should not save",
    activeIngredient: "",
    unit: "PCS",
    currentStock: "1",
    requestable: true,
    categoryId: null,
  }, at),
  updateMaterialDetails(seed, manager, {
    materialId: MATERIAL_IDS.actellic,
    productName: "Changed",
    activeIngredient: "",
    unit: "LTR",
    categoryId: null,
  }, at),
  receiveStock(seed, manager, {
    materialId: MATERIAL_IDS.actellic,
    quantity: "1",
    receiptDate: "2026-10-28",
    reference: "OM-1",
    supplier: "",
    notes: "",
    idempotencyKey: "om-receipt",
  }, at),
  adjustStock(seed, manager, {
    materialId: MATERIAL_IDS.actellic,
    mode: "increase",
    quantity: "1",
    reason: "Should fail",
    reference: "",
    idempotencyKey: "om-adjust",
  }, at),
  setCountedStock(seed, manager, MATERIAL_IDS.actellic, "1", "Should fail", at),
  reverseMovement(seed, manager, "missing", "Should fail", "om-reverse", at),
  deleteMaterial(seed, manager, MATERIAL_IDS.actellic),
  setMaterialActive(seed, manager, MATERIAL_IDS.actellic, false, at),
  setRequestable(seed, manager, MATERIAL_IDS.actellic, false, at),
  setMaterialCategory(seed, manager, MATERIAL_IDS.actellic, null, at),
  createCategory(seed, manager, "Should fail", at),
  updateCategory(seed, manager, { categoryId: "missing", name: "Should fail", active: true }, at),
  damageStock(seed, manager, MATERIAL_IDS.actellic, "1", "Should fail", at),
];

for (const result of denied) {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "You do not have permission for this action.");
}
assert.deepEqual(stockSnapshot(seed), before);
assert.equal(seed.materials.length, createSeed().materials.length);
assert.equal(seed.movements.length, createSeed().movements.length);

const created = createMaterial(seed, keeper, {
  itemCode: "PST-ZZ01",
  productName: "Keeper material",
  activeIngredient: "",
  unit: "PCS",
  currentStock: "2",
  requestable: true,
  categoryId: null,
}, at);
assert.equal(created.ok, true);

const request = seed.requests.find((item) => item.status === "PENDING_OPERATION_MANAGER");
if (request) {
  const decided = decideOperationItems(
    seed,
    manager,
    request.id,
    request.items
      .filter((item) => item.decision === "APPROVED" && item.omDecision === "PENDING")
      .map((item) => ({
        itemId: item.id,
        decision: "APPROVED" as const,
        approvedQuantity: item.approvedQuantity,
        rejectionReason: "",
      })),
    "om-stock-unchanged",
    at,
  );
  if (decided.ok) assert.deepEqual(stockSnapshot(decided.state), stockSnapshot(seed));
}

const history = projectMaterialHistory(seed, manager, MATERIAL_IDS.actellic, "operations");
assert.ok(history);
assert.equal(history.material.canDelete, false);
assert.equal(history.entries.every((entry) => entry.canReverse === false), true);
assert.equal(history.material.currentStock, seed.materials.find((item) => item.id === MATERIAL_IDS.actellic)?.currentStock);

const reports = projectOperationReports(seed, manager, at);
assert.ok(reports);
assert.equal(projectOperationReports(seed, keeper, at), null);
assert.equal(reports.consumption.every((row) => row.issued !== "0"), true);

console.log("Inventory access checks passed.");
