"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, CheckCircle, AlertTriangle, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { issueSalesRequest } from "@/lib/gardenia/actions";
import { formatAed } from "@/lib/gardenia/money";

interface IssueLine {
  productId: string;
  productName: string;
  productSku: string;
  unit: string;
  requestedQty: number;
  unitPrice: number;
  approvedQty: number | null;
  issuedQty: number | null;
  availableQty: number;
}

interface IssueRequest {
  id: string;
  requestNumber: string;
  customerName: string;
  salespersonName: string;
  approvedByName: string | null;
  notes: string | null;
  approvalNotes: string | null;
  lines: IssueLine[];
  approvedAt: string | null;
}

export function IssueQueueClient({ requests }: { requests: IssueRequest[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(
    requests.length === 1 ? requests[0].id : null
  );
  const [issueQtys, setIssueQtys] = useState<Record<string, Record<string, number>>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function getIssueQty(requestId: string, productId: string, approvedQty: number | null) {
    return issueQtys[requestId]?.[productId] ?? (approvedQty ?? 0);
  }

  function setIssueQtyValue(requestId: string, productId: string, value: number) {
    setIssueQtys((prev) => ({
      ...prev,
      [requestId]: { ...prev[requestId], [productId]: value },
    }));
  }

  async function handleIssue(request: IssueRequest) {
    const lines = request.lines.map((l) => ({
      productId: l.productId,
      issuedQty: getIssueQty(request.id, l.productId, l.approvedQty),
    }));

    // Validate
    for (const l of request.lines) {
      const issueQty = getIssueQty(request.id, l.productId, l.approvedQty);
      if (issueQty > l.availableQty) {
        setMsg({ text: `Cannot issue ${issueQty} ${l.unit} of "${l.productName}" – only ${l.availableQty} available.`, ok: false });
        return;
      }
      if (issueQty < 0) {
        setMsg({ text: "Issue quantity cannot be negative.", ok: false });
        return;
      }
    }

    const shortage = request.lines.some((line) => getIssueQty(request.id, line.productId, line.approvedQty) < (line.approvedQty ?? 0));
    if (shortage && !(notesMap[request.id] ?? "").trim()) {
      setMsg({ text: "Add a note explaining the shortage or partial issuance.", ok: false });
      return;
    }

    startTransition(async () => {
      const result = await issueSalesRequest(request.id, lines, notesMap[request.id] ?? "");
      if (result && "error" in result && result.error) {
        setMsg({ text: result.error, ok: false });
      } else if (result && "ticketId" in result && result.ticketId) {
        router.push(`/g/tickets/${result.ticketId}`);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/g/storekeeper" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Issue Queue</h1>
          <p className="text-sm text-gray-500">
            {requests.length} approved request{requests.length !== 1 ? "s" : ""} ready for dispatch
          </p>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 border rounded-lg px-4 py-3 text-sm ${
          msg.ok ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {msg.text}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <Package className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 text-lg">Issue queue is empty</h3>
          <p className="text-gray-500 mt-1">No approved requests are waiting for dispatch.</p>
          <Link href="/g/storekeeper" className="mt-4 inline-block text-sm text-green-600 hover:text-green-700 font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedId((v) => (v === req.id ? null : req.id))}
                className="w-full px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-gray-800">{req.requestNumber}</span>
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full border border-green-200">
                      Approved
                    </span>
                  </div>
                  <p className="text-base font-semibold text-gray-900 mt-0.5">{req.customerName}</p>
                  <p className="text-sm text-gray-500">
                    Salesperson: {req.salespersonName} · {req.lines.length} item(s)
                    {req.approvedByName && ` · Approved by ${req.approvedByName}`}
                  </p>
                </div>
                {expandedId === req.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                )}
              </button>

              {expandedId === req.id && (
                <div className="border-t border-gray-100">
                  <div className="px-5 py-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Issue Quantities</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-xs font-medium text-gray-500 pb-2">Product</th>
                            <th className="text-right text-xs font-medium text-gray-500 pb-2">Requested</th>
                            <th className="text-right text-xs font-medium text-gray-500 pb-2">Approved</th>
                            <th className="text-right text-xs font-medium text-gray-500 pb-2">Available</th>
                            <th className="text-right text-xs font-medium text-gray-500 pb-2">Issue Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {req.lines.map((line) => {
                            const issueQty = getIssueQty(req.id, line.productId, line.approvedQty);
                            const isOver = issueQty > line.availableQty;
                            return (
                              <tr key={line.productId}>
                                <td className="py-2.5">
                                  <div className="font-medium text-gray-900">{line.productName}</div>
                                  <div className="text-xs text-gray-400">{line.productSku} · {line.unit} · {formatAed(line.unitPrice)}</div>
                                </td>
                                <td className="py-2.5 text-right text-gray-600">{line.requestedQty}</td>
                                <td className="py-2.5 text-right text-gray-600">{line.approvedQty ?? 0}</td>
                                <td className="py-2.5 text-right">
                                  <span className={line.availableQty < (line.approvedQty ?? 0) ? "text-orange-600 font-semibold" : "text-gray-600"}>
                                    {line.availableQty}
                                  </span>
                                </td>
                                <td className="py-2.5 text-right">
                                  <input
                                    type="number"
                                    min={0}
                                    max={line.availableQty}
                                    value={issueQty}
                                    onChange={(e) =>
                                      setIssueQtyValue(req.id, line.productId, Math.max(0, Number(e.target.value)))
                                    }
                                    className={`w-20 text-right border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 ${
                                      isOver
                                        ? "border-red-300 focus:ring-red-500 bg-red-50"
                                        : "border-gray-300 focus:ring-green-500"
                                    }`}
                                  />
                                  {isOver && (
                                    <div className="flex items-center justify-end gap-1 mt-0.5">
                                      <AlertTriangle className="w-3 h-3 text-red-500" />
                                      <span className="text-[10px] text-red-500">Exceeds stock</span>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {req.approvalNotes && (
                    <div className="px-5 pb-3">
                      <p className="text-xs text-gray-500 italic">Manager note: {req.approvalNotes}</p>
                    </div>
                  )}

                  <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Issue notes</label>
                      <textarea
                        value={notesMap[req.id] ?? ""}
                        onChange={(e) => setNotesMap((prev) => ({ ...prev, [req.id]: e.target.value }))}
                        rows={2}
                        placeholder="Required when the issued quantity is less than the approved quantity."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <button
                      onClick={() => handleIssue(req)}
                      disabled={isPending}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isPending ? "Processing…" : "Confirm Issue & Deduct Inventory"}
                    </button>
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
