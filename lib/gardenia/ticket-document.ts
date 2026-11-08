import { formatAed } from "./money";
import type { IssueTicket } from "./types";

export function ticketPdfLines(ticket: IssueTicket): string[] {
  const lines = [
    "GARDENIA  -  Public Health Pest Control",
    "MATERIAL ISSUE TICKET",
    "",
    `Ticket: ${ticket.ticketNumber}`,
    `Request: ${ticket.requestNumber}`,
    `Status: ${ticket.status === "issued" ? "Fully issued" : "Partially issued"}`,
    `Issued: ${new Date(ticket.issuedAt).toLocaleString()}`,
    "",
    `Branch: ${ticket.branchName}`,
    `Client: ${ticket.customerName}`,
    `Salesperson: ${ticket.salespersonName}`,
    `Storekeeper: ${ticket.storekeeperName}`,
    "",
    "Product | SKU | Requested | Approved | Issued | Price | Total",
  ];
  for (const line of ticket.lines) {
    lines.push(
      `${line.productName} | ${line.sku} | ${line.requestedQty} | ${line.approvedQty} | ${line.issuedQty} ${line.unit} | ${formatAed(line.unitPrice)} | ${formatAed(line.lineTotal)}`
    );
  }
  lines.push("");
  lines.push(`Total issued value: ${formatAed(ticket.totalValue)}`);
  if (ticket.notes) {
    lines.push("");
    lines.push(`Remarks: ${ticket.notes}`);
  }
  lines.push("");
  lines.push("This ticket is a permanent record. Quantities and prices cannot be changed after issuance.");
  return lines;
}
