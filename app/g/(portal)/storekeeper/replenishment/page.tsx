export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { StatusBadge } from "@/components/gardenia/status-badge";
import { PageHeader } from "@/components/gardenia/page-header";
import { ReceiveReplenishmentButton } from "@/components/gardenia/receive-replenishment-button";
import { TruckIcon, Plus } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Replenishment Requests" };

export default async function StorekeeperReplenishmentPage() {
  const actor = await requireActor(["branch_storekeeper"]);
  const ws = await readWorkspace();

  const requests = ws.replenishmentRequests
    .filter((r) => r.branchId === actor.branchId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const enriched = requests.map((req) => ({
    ...req,
    lines: req.lines.map((l) => {
      const product = ws.products.find((p) => p.id === l.productId);
      const branchBal = ws.inventoryBalances.find(
        (b) => b.productId === l.productId && b.locationId === actor.branchId
      );
      return {
        ...l,
        productName: product?.name ?? l.productId,
        unit: product?.unit ?? "",
        currentBranchQty: branchBal?.quantity ?? 0,
      };
    }),
    approvedByName: ws.users.find((u) => u.id === req.approvedBy)?.name ?? null,
    dispatchedByName: ws.users.find((u) => u.id === req.dispatchedBy)?.name ?? null,
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Replenishment Requests"
        subtitle="Request stock from the central warehouse"
        action={
          <Link
            href="/g/storekeeper/replenishment/new"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Request
          </Link>
        }
      />

      {enriched.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <TruckIcon className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 text-lg">No replenishment requests</h3>
          <p className="text-gray-500 mt-1">Submit a request to receive stock from the central warehouse.</p>
          <Link href="/g/storekeeper/replenishment/new" className="mt-4 inline-flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700">
            <Plus className="w-4 h-4" /> New Request
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {enriched.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-gray-800">{req.requestNumber}</span>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {req.lines.length} item(s) · {new Date(req.createdAt).toLocaleDateString()}
                    {req.approvedByName && ` · Approved by ${req.approvedByName}`}
                    {req.dispatchedByName && ` · Dispatched by ${req.dispatchedByName}`}
                  </p>
                  {req.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{req.notes}</p>}
                </div>
              </div>

              <div className="px-5 pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 pb-1.5">Product</th>
                        <th className="text-right text-xs font-medium text-gray-500 pb-1.5">Requested</th>
                        <th className="text-right text-xs font-medium text-gray-500 pb-1.5">Approved</th>
                        <th className="text-right text-xs font-medium text-gray-500 pb-1.5">Dispatched</th>
                        {req.status === "dispatched" && (
                          <th className="text-right text-xs font-medium text-gray-500 pb-1.5">Receive Qty</th>
                        )}
                        {(req.status === "received" || req.status === "partially_received") && (
                          <th className="text-right text-xs font-medium text-gray-500 pb-1.5">Received</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {req.lines.map((line) => (
                        <tr key={line.productId}>
                          <td className="py-2 font-medium text-gray-900">{line.productName}
                            <span className="text-xs text-gray-400 ml-1">({line.unit})</span>
                          </td>
                          <td className="py-2 text-right text-gray-600">{line.requestedQty}</td>
                          <td className="py-2 text-right text-gray-600">{line.approvedQty ?? "—"}</td>
                          <td className="py-2 text-right text-gray-600">{line.dispatchedQty ?? "—"}</td>
                          {(req.status === "received" || req.status === "partially_received") && (
                            <td className="py-2 text-right font-medium text-green-700">{line.receivedQty ?? "—"}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {req.status === "dispatched" && (
                  <div className="mt-4">
                    <ReceiveReplenishmentButton
                      requestId={req.id}
                      requestNumber={req.requestNumber}
                      lines={req.lines.map((l) => ({
                        productId: l.productId,
                        productName: l.productName,
                        unit: l.unit,
                        dispatchedQty: l.dispatchedQty ?? 0,
                      }))}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
