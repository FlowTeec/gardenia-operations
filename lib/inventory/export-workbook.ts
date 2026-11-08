import ExcelJS from "exceljs";

import { FACILITY_NAME } from "@/lib/workspace/types";

const HEADER_FILL = "FF1F2937";
const TITLE_FILL = "FFF8FAFC";

export type InventoryExportRow = {
  itemCode: string;
  description: string;
  category: string;
  unit: string;
  opening: string;
  received: string;
  issued: string;
  current: string;
  status: string;
  requestable: string;
};

export type HistoryExportRow = {
  when: string;
  receiptDate: string;
  type: string;
  quantity: string;
  before: string;
  after: string;
  reference: string;
  supplier: string;
  teamLeader: string;
  supervisor: string;
  storeKeeper: string;
  performedBy: string;
  reason: string;
};

function dubaiStamp(iso: string) {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return { day, label: `${day} ${clock} GST` };
}

function writeQuantity(cell: ExcelJS.Cell, value: string) {
  const text = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    cell.value = text;
    return;
  }
  const scale = text.includes(".") ? text.split(".")[1]?.length ?? 0 : 0;
  cell.value = Number(text);
  cell.numFmt = scale > 0 ? `0.${"0".repeat(scale)}` : "0";
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 22;
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });
}

function fitColumns(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

function paintTitle(sheet: ExcelJS.Worksheet, lastColumn: number, title: string, stamp: string, scope: string) {
  sheet.mergeCells(1, 1, 1, lastColumn);
  sheet.mergeCells(2, 1, 2, lastColumn);
  sheet.mergeCells(3, 1, 3, lastColumn);
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { bold: true, size: 16, name: "Calibri", color: { argb: "FF111827" } };
  sheet.getCell(2, 1).value = `${FACILITY_NAME} · Exported ${stamp}`;
  sheet.getCell(2, 1).font = { size: 11, name: "Calibri", color: { argb: "FF374151" } };
  sheet.getCell(3, 1).value = scope;
  sheet.getCell(3, 1).font = { size: 11, name: "Calibri", color: { argb: "FF374151" } };
  for (let row = 1; row <= 3; row += 1) {
    sheet.getRow(row).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TITLE_FILL } };
    sheet.getRow(row).height = row === 1 ? 24 : 18;
  }
}

async function toFile(workbook: ExcelJS.Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    fileName,
    base64: Buffer.from(buffer).toString("base64"),
  };
}

export async function buildInventoryWorkbook(input: {
  exportedAtIso: string;
  scopeLabel: string;
  rows: InventoryExportRow[];
}) {
  const stamp = dubaiStamp(input.exportedAtIso);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = FACILITY_NAME;
  workbook.created = new Date(input.exportedAtIso);
  const sheet = workbook.addWorksheet("Inventory", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const headers = [
    "Serial Number",
    "Item Code",
    "Item Description",
    "Category",
    "Unit",
    "Opening Stock",
    "Total Stock Received",
    "Total Stock Issued",
    "Current Stock",
    "Material Status",
    "Requestable Status",
  ];
  paintTitle(sheet, headers.length, "Inventory Report", stamp.label, input.scopeLabel);
  const header = sheet.getRow(4);
  header.values = headers;
  styleHeader(header);
  input.rows.forEach((row, index) => {
    const excelRow = sheet.getRow(index + 5);
    excelRow.values = [
      index + 1,
      row.itemCode,
      row.description,
      row.category,
      row.unit,
      row.opening,
      row.received,
      row.issued,
      row.current,
      row.status,
      row.requestable,
    ];
    for (const column of [6, 7, 8, 9]) writeQuantity(excelRow.getCell(column), String(excelRow.getCell(column).value ?? ""));
    excelRow.font = { name: "Calibri", size: 11 };
    excelRow.alignment = { vertical: "middle" };
  });
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: headers.length } };
  fitColumns(sheet, [16, 16, 32, 18, 12, 16, 22, 20, 16, 18, 20]);
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, input.rows.length + 4), column: headers.length } };
  return toFile(workbook, `Inventory_Report_${stamp.day}.xlsx`);
}

export async function buildMaterialHistoryWorkbook(input: {
  exportedAtIso: string;
  scopeLabel: string;
  itemCode: string;
  description: string;
  category: string;
  unit: string;
  status: string;
  opening: string;
  current: string;
  received: string;
  issued: string;
  transactionCount: number;
  rows: HistoryExportRow[];
}) {
  const stamp = dubaiStamp(input.exportedAtIso);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = FACILITY_NAME;
  workbook.created = new Date(input.exportedAtIso);
  const sheet = workbook.addWorksheet("Material history", {
    views: [{ state: "frozen", ySplit: 12, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const headers = [
    "Date and time",
    "Receipt date",
    "Transaction type",
    "Quantity",
    "Previous balance",
    "Resulting balance",
    "Reference",
    "Supplier or source",
    "Team leader",
    "Supervisor",
    "Store keeper",
    "Recorded by",
    "Reason",
  ];
  paintTitle(
    sheet,
    headers.length,
    `Material History · ${input.itemCode}`,
    stamp.label,
    input.scopeLabel,
  );
  const details: [string, string][] = [
    ["Item code", input.itemCode],
    ["Material description", input.description],
    ["Category", input.category],
    ["Unit of measurement", input.unit],
    ["Status", input.status],
    ["Opening inventory balance", input.opening],
    ["Current stock balance", input.current],
    ["Total quantity received", input.received],
    ["Total quantity issued", input.issued],
    ["Inventory transactions", String(input.transactionCount)],
  ];
  details.forEach((pair, index) => {
    const row = sheet.getRow(index + 5);
    row.getCell(1).value = pair[0];
    row.getCell(1).font = { bold: true, name: "Calibri", size: 11 };
    row.getCell(2).value = pair[1];
    row.getCell(2).font = { name: "Calibri", size: 11 };
    if (index >= 5 && index <= 8) writeQuantity(row.getCell(2), pair[1]);
  });
  const header = sheet.getRow(16);
  header.values = headers;
  styleHeader(header);
  input.rows.forEach((row, index) => {
    const excelRow = sheet.getRow(index + 17);
    excelRow.values = [
      row.when,
      row.receiptDate,
      row.type,
      row.quantity,
      row.before,
      row.after,
      row.reference,
      row.supplier,
      row.teamLeader,
      row.supervisor,
      row.storeKeeper,
      row.performedBy,
      row.reason,
    ];
    for (const column of [4, 5, 6]) writeQuantity(excelRow.getCell(column), String(excelRow.getCell(column).value ?? ""));
    excelRow.font = { name: "Calibri", size: 11 };
    excelRow.alignment = { vertical: "middle" };
  });
  const lastRow = Math.max(16, input.rows.length + 16);
  sheet.autoFilter = { from: { row: 16, column: 1 }, to: { row: lastRow, column: headers.length } };
  sheet.views = [{ state: "frozen", ySplit: 16, showGridLines: false }];
  fitColumns(sheet, [22, 16, 20, 14, 18, 18, 18, 24, 22, 24, 24, 24, 42]);
  const safeCode = input.itemCode.replace(/[^A-Za-z0-9_-]+/g, "_");
  return toFile(workbook, `Material_History_${safeCode}_${stamp.day}.xlsx`);
}
