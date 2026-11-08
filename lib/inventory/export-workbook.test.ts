import assert from "node:assert/strict";

import ExcelJS from "exceljs";

import { buildInventoryWorkbook, buildMaterialHistoryWorkbook } from "./export-workbook";

async function main() {
const inventory = await buildInventoryWorkbook({
  exportedAtIso: "2026-10-25T12:00:00.000Z",
  scopeLabel: "Filtered materials (1 of 8).",
  rows: [
    {
      itemCode: "PST-0125",
      description: "ACTELLIC 50%",
      category: "Pesticides",
      unit: "LTR",
      opening: "30.7",
      received: "0.0",
      issued: "3.4",
      current: "27.3",
      status: "Active",
      requestable: "Yes",
    },
  ],
});
assert.equal(inventory.fileName, "Inventory_Report_2026-10-25.xlsx");
const inventoryBook = new ExcelJS.Workbook();
await inventoryBook.xlsx.load(Buffer.from(inventory.base64, "base64") as never);
const inventorySheet = inventoryBook.getWorksheet("Inventory");
assert.equal(inventorySheet?.getCell("A1").value, "Inventory Report");
assert.equal(inventorySheet?.getCell("A3").value, "Filtered materials (1 of 8).");
assert.equal(inventorySheet?.getCell("B5").value, "PST-0125");
assert.equal(inventorySheet?.getCell("I5").value, 27.3);
assert.equal(inventorySheet?.views[0]?.state, "frozen");
assert.ok(inventorySheet?.autoFilter);

const history = await buildMaterialHistoryWorkbook({
  exportedAtIso: "2026-10-25T12:00:00.000Z",
  scopeLabel: "Full history (1 transactions).",
  itemCode: "PST-0125",
  description: "ACTELLIC 50%",
  category: "Pesticides",
  unit: "LTR",
  status: "Active",
  opening: "30.7",
  current: "27.3",
  received: "0.0",
  issued: "3.4",
  transactionCount: 1,
  rows: [
    {
      when: "25 Oct 2026, 16:00 GST",
      receiptDate: "2026-10-25",
      type: "Stock Receipt",
      quantity: "2.0",
      before: "27.3",
      after: "29.3",
      reference: "GRN-100",
      supplier: "Local supplier",
      teamLeader: "",
      supervisor: "",
      storeKeeper: "Store Keeper (demo)",
      performedBy: "Store Keeper (demo)",
      reason: "Morning delivery",
    },
  ],
});
assert.equal(history.fileName, "Material_History_PST-0125_2026-10-25.xlsx");
const historyBook = new ExcelJS.Workbook();
await historyBook.xlsx.load(Buffer.from(history.base64, "base64") as never);
const historySheet = historyBook.getWorksheet("Material history");
assert.equal(historySheet?.getCell("A16").value, "Date and time");
assert.equal(historySheet?.getCell("G17").value, "GRN-100");
assert.equal(historySheet?.getCell("D17").value, 2);

console.log("Export workbook checks passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
