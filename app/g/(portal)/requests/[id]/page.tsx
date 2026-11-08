export const instant = false;
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/gardenia/auth";
import { canViewSalesRequest } from "@/lib/gardenia/access";
import { readWorkspace } from "@/lib/gardenia/store";
import { StatusBadge } from "@/components/gardenia/status-badge";
import { formatAed, lineValue } from "@/lib/gardenia/money";

export const metadata: Metadata = { title: "Request Details" };

export default async function SalesRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(["salesperson", "branch_manager", "branch_storekeeper", "management"]);
  const ws = await readWorkspace();
  const request = ws.salesRequests.find((item) => item.id === id);
  if (!request || !canViewSalesRequest(actor, request)) notFound();

  const branch = ws.branches.find((item) => item.id === request.branchId);
  const salesperson = ws.users.find((item) => item.id === request.salespersonId);
  const ticket = ws.issueTickets.find((item) => item.id === request.issueTicketId);
  const requestedTotal = request.lines.reduce((sum, line) => sum + lineValue(line.requestedQty, line.unitPrice), 0);
  const issuedTotal = request.lines.reduce((sum, line) => sum + lineValue(line.issuedQty ?? 0, line.unitPrice), 0);
  const canEdit = actor.role === "salesperson" && actor.id === request.salespersonId && request.status === "returned";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{request.requestNumber}</h1>
            <StatusBadge status={request.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">Submitted {new Date(request.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link href={`/g/salesperson/requests/${request.id}/edit`} className="px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600">
              Edit and resubmit
            </Link>
          )}
          {ticket && (
            <Link href={`/g/tickets/${ticket.id}`} className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
              Open issue ticket
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Info label="Client" value={request.customerName} />
        <Info label="Branch" value={branch?.name ?? request.branchId} />
        <Info label="Salesperson" value={salesperson?.name ?? request.salespersonId} />
        <Info label="Estimated value" value={formatAed(requestedTotal)} />
      </div>

      {(request.notes || request.approvalNotes || request.issueNotes) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5 space-y-2 text-sm">
          {request.notes && <p><span className="text-gray-500">Request note: </span>{request.notes}</p>}
          {request.approvalNotes && <p><span className="text-gray-500">Manager: </span>{request.approvalNotes}</p>}
          {request.issueNotes && <p><span className="text-gray-500">Issuance remarks: </span>{request.issueNotes}</p>}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Requested</th>
                <th className="px-4 py-3 text-right">Approved</th>
                <th className="px-4 py-3 text-right">Issued</th>
                <th className="px-4 py-3 text-right">Unit price</th>
                <th className="px-4 py-3 text-right">Requested value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {request.lines.map((line) => {
                const product = ws.products.find((item) => item.id === line.productId);
                return (
                  <tr key={line.productId}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{product?.name ?? line.productId}</div>
                      <div className="text-xs font-mono text-gray-400">{product?.sku} · {product?.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{line.requestedQty}</td>
                    <td className="px-4 py-3 text-right">{line.approvedQty ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{line.issuedQty ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{formatAed(line.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAed(lineValue(line.requestedQty, line.unitPrice))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-6 text-sm">
          <span className="text-gray-500">Issued value <strong className="text-gray-900">{formatAed(issuedTotal)}</strong></span>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
