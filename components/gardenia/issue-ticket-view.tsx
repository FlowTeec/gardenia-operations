"use client";

import { Printer } from "lucide-react";
import { formatAed } from "@/lib/gardenia/money";
import type { IssueTicket } from "@/lib/gardenia/types";

export function IssueTicketView({ ticket }: { ticket: IssueTicket }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-green-700">Issue ticket</p>
          <h1 className="text-2xl font-bold text-gray-900">{ticket.ticketNumber}</h1>
        </div>
        <div className="flex gap-2">
          <a
            href={`/g/tickets/${ticket.id}/pdf`}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Download PDF
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 print:shadow-none print:border-0 print:p-0">
        <header className="border-b border-gray-200 pb-4 mb-4">
          <p className="text-sm font-semibold text-green-700">Gardenia · Public Health Pest Control</p>
          <h2 className="text-xl font-bold text-gray-900 mt-1">Material Issue Ticket</h2>
          <p className="text-sm text-gray-500 mt-1">Permanent record of materials issued against {ticket.requestNumber}</p>
        </header>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm mb-6">
          <div><dt className="text-gray-500">Ticket number</dt><dd className="font-semibold text-gray-900">{ticket.ticketNumber}</dd></div>
          <div><dt className="text-gray-500">Request number</dt><dd className="font-semibold text-gray-900">{ticket.requestNumber}</dd></div>
          <div><dt className="text-gray-500">Branch</dt><dd className="font-medium text-gray-900">{ticket.branchName}</dd></div>
          <div><dt className="text-gray-500">Client / organisation</dt><dd className="font-medium text-gray-900">{ticket.customerName}</dd></div>
          <div><dt className="text-gray-500">Salesperson</dt><dd className="font-medium text-gray-900">{ticket.salespersonName}</dd></div>
          <div><dt className="text-gray-500">Storekeeper</dt><dd className="font-medium text-gray-900">{ticket.storekeeperName}</dd></div>
          <div><dt className="text-gray-500">Issue date and time</dt><dd className="font-medium text-gray-900">{new Date(ticket.issuedAt).toLocaleString()}</dd></div>
          <div><dt className="text-gray-500">Status</dt><dd className="font-medium text-gray-900">{ticket.status === "issued" ? "Fully issued" : "Partially issued"}</dd></div>
        </dl>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3 text-right">Requested</th>
                <th className="py-2 pr-3 text-right">Approved</th>
                <th className="py-2 pr-3 text-right">Issued</th>
                <th className="py-2 pr-3 text-right">Unit price</th>
                <th className="py-2 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {ticket.lines.map((line) => (
                <tr key={line.productId} className="border-b border-gray-100">
                  <td className="py-2 pr-3 font-medium text-gray-900">{line.productName}<div className="text-[11px] text-gray-400">{line.unit}</div></td>
                  <td className="py-2 pr-3 font-mono text-xs text-gray-500">{line.sku}</td>
                  <td className="py-2 pr-3 text-right">{line.requestedQty}</td>
                  <td className="py-2 pr-3 text-right">{line.approvedQty}</td>
                  <td className="py-2 pr-3 text-right font-semibold">{line.issuedQty}</td>
                  <td className="py-2 pr-3 text-right">{formatAed(line.unitPrice)}</td>
                  <td className="py-2 text-right font-semibold">{formatAed(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="text-right">
            <p className="text-xs text-gray-500">Total value of issued materials</p>
            <p className="text-2xl font-bold text-gray-900">{formatAed(ticket.totalValue)}</p>
          </div>
        </div>

        {ticket.notes && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Shortages or remarks</p>
            <p className="mt-1">{ticket.notes}</p>
          </div>
        )}
      </article>
    </div>
  );
}
