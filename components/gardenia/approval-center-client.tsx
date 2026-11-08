"use client";

import { useState, useTransition } from "react";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, ArrowLeft, Undo2 } from "lucide-react";
import Link from "next/link";
import { approveSalesRequest } from "@/lib/gardenia/actions";
import { formatAed, lineValue } from "@/lib/gardenia/money";

interface EnrichedLine {
  productId: string;
  productName: string;
  productSku: string;
  unit: string;
  requestedQty: number;
  unitPrice: number;
  approvedQty: number | null;
  issuedQty: number | null;
}

interface EnrichedRequest {
  id: string;
  requestNumber: string;
  salespersonName: string;
  customerName: string;
  branchName: string;
  notes: string | null;
  lines: EnrichedLine[];
  createdAt: string;
}

export function ApprovalCenterClient({ requests }: { requests: EnrichedRequest[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(
    requests.length === 1 ? requests[0].id : null
  );
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleAction(requestId: string, action: "approve" | "reject" | "return") {
    const notes = notesMap[requestId] ?? "";
    if ((action === "reject" || action === "return") && !notes.trim()) {
      setMsg(action === "reject" ? "A rejection reason is required." : "Explain what should be changed before returning the request.");
      return;
    }

    startTransition(async () => {
      const result = await approveSalesRequest(requestId, action, notes);
      if (result?.error) {
        setMsg(`Error: ${result.error}`);
      } else {
        setMsg(
          action === "approve"
            ? "Request approved. The storekeeper can now issue it."
            : action === "reject"
              ? "Request rejected."
              : "Request returned to the salesperson."
        );
        setTimeout(() => setMsg(null), 3000);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/g/manager" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Approval Center</h1>
          <p className="text-sm text-gray-500">
            {requests.length} pending request{requests.length !== 1 ? "s" : ""} awaiting review
          </p>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 border rounded-lg px-4 py-3 text-sm ${
          msg.startsWith("Error") ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"
        }`}>
          {msg}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 text-lg">All caught up!</h3>
          <p className="text-gray-500 mt-1">No pending requests require your approval.</p>
          <Link href="/g/manager" className="mt-4 inline-block text-sm text-green-600 hover:text-green-700 font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Request Header */}
              <button
                onClick={() => setExpandedId((v) => (v === req.id ? null : req.id))}
                className="w-full px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-gray-800">{req.requestNumber}</span>
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded-full border border-yellow-200">
                      Pending
                    </span>
                  </div>
                  <p className="text-base font-semibold text-gray-900 mt-1">{req.customerName}</p>
                  <p className="text-sm text-gray-500">
                    By {req.salespersonName} · {req.branchName} · {req.lines.length} item(s) · {new Date(req.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm font-semibold text-gray-800 mt-1">
                    {formatAed(req.lines.reduce((sum, line) => sum + lineValue(line.requestedQty, line.unitPrice), 0))}
                  </p>
                  {req.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{req.notes}</p>}
                </div>
                {expandedId === req.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                )}
              </button>

              {/* Expanded Content */}
              {expandedId === req.id && (
                <div className="border-t border-gray-100">
                  {/* Product Lines */}
                  <div className="px-5 py-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Requested Items</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-xs font-medium text-gray-500 pb-2">Product</th>
                            <th className="text-left text-xs font-medium text-gray-500 pb-2 hidden sm:table-cell">SKU</th>
                            <th className="text-right text-xs font-medium text-gray-500 pb-2">Qty</th>
                            <th className="text-right text-xs font-medium text-gray-500 pb-2">Price</th>
                            <th className="text-right text-xs font-medium text-gray-500 pb-2">Line total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {req.lines.map((line) => (
                            <tr key={line.productId}>
                              <td className="py-2 font-medium text-gray-900">
                                {line.productName}
                                <div className="text-[10px] text-gray-400 font-mono">{line.productSku} · {line.unit}</div>
                              </td>
                              <td className="py-2 text-gray-500 font-mono text-xs hidden sm:table-cell">{line.productSku}</td>
                              <td className="py-2 text-right font-bold text-gray-900">{line.requestedQty}</td>
                              <td className="py-2 text-right text-gray-600">{formatAed(line.unitPrice)}</td>
                              <td className="py-2 text-right font-semibold text-gray-900">{formatAed(lineValue(line.requestedQty, line.unitPrice))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Notes and Actions */}
                  <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Notes / Rejection Reason
                      </label>
                      <textarea
                        value={notesMap[req.id] ?? ""}
                        onChange={(e) =>
                          setNotesMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        rows={2}
                        placeholder="Optional for approval. Required to reject or return the request."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => handleAction(req.id, "reject")}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold border border-red-200 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={() => handleAction(req.id, "return")}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-semibold border border-amber-200 transition-colors disabled:opacity-50"
                      >
                        <Undo2 className="w-4 h-4" /> Return
                      </button>
                      <button
                        onClick={() => handleAction(req.id, "approve")}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" /> Approve
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
