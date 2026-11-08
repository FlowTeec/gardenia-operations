"use client";

import { useState, useTransition } from "react";
import { CheckCircle, XCircle, TruckIcon, ChevronDown, ChevronUp } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { approveReplenishmentRequest, dispatchReplenishment } from "@/lib/gardenia/actions";

interface Line {
  productId: string;
  productName: string;
  unit: string;
  requestedQty: number;
  approvedQty: number | null;
  dispatchedQty: number | null;
  receivedQty: number | null;
  warehouseQty: number;
}

interface Request {
  id: string;
  requestNumber: string;
  branchName: string;
  storekeeperName: string;
  approvedByName: string | null;
  status: string;
  lines: Line[];
  notes: string | null;
  approvalNotes: string | null;
  createdAt: string;
}

export function WarehouseReplenishmentClient({ requests }: { requests: Request[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(
    requests.filter((r) => r.status === "pending").length === 1
      ? requests.find((r) => r.status === "pending")?.id ?? null
      : null
  );
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [approvedQtys, setApprovedQtys] = useState<Record<string, Record<string, number>>>({});
  const [dispatchQtys, setDispatchQtys] = useState<Record<string, Record<string, number>>>({});
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filterStatus, setFilterStatus] = useState<string>("pending");

  function getApprovedQty(reqId: string, productId: string, requested: number) {
    return approvedQtys[reqId]?.[productId] ?? requested;
  }

  function getDispatchQty(reqId: string, productId: string, approved: number | null) {
    return dispatchQtys[reqId]?.[productId] ?? (approved ?? 0);
  }

  async function handleApproval(requestId: string, action: "approve" | "reject", lines: Line[]) {
    const notes = notesMap[requestId] ?? "";
    if (action === "reject" && !notes.trim()) {
      setMsg({ text: "Please provide a rejection reason.", ok: false });
      return;
    }

    const approvedLineData = lines.map((l) => ({
      productId: l.productId,
      approvedQty: getApprovedQty(requestId, l.productId, l.requestedQty),
    }));

    startTransition(async () => {
      const result = await approveReplenishmentRequest(requestId, action, notes, approvedLineData);
      if (result?.error) {
        setMsg({ text: result.error, ok: false });
      } else {
        setMsg({ text: action === "approve" ? "Request approved." : "Request rejected.", ok: true });
        setTimeout(() => setMsg(null), 3000);
      }
    });
  }

  async function handleDispatch(requestId: string, lines: Line[]) {
    const dispatchLineData = lines.map((l) => ({
      productId: l.productId,
      dispatchedQty: getDispatchQty(requestId, l.productId, l.approvedQty),
    }));

    for (const l of lines) {
      const dispatchQty = getDispatchQty(requestId, l.productId, l.approvedQty);
      if (dispatchQty > l.warehouseQty) {
        setMsg({ text: `Cannot dispatch ${dispatchQty} of "${l.productName}" – only ${l.warehouseQty} in warehouse.`, ok: false });
        return;
      }
    }

    startTransition(async () => {
      const result = await dispatchReplenishment(requestId, dispatchLineData);
      if (result?.error) {
        setMsg({ text: result.error, ok: false });
      } else {
        setMsg({ text: "Shipment dispatched and warehouse inventory updated.", ok: true });
        setTimeout(() => setMsg(null), 3000);
      }
    });
  }

  const filtered = requests.filter((r) =>
    filterStatus === "all" ? true : r.status === filterStatus
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved" || r.status === "partially_approved").length;

  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Replenishment Management</h1>
          <p className="text-sm text-gray-500">{requests.length} total requests</p>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 border rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { value: "pending", label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
          { value: "approved", label: `Approved${approvedCount > 0 ? ` (${approvedCount})` : ""}` },
          { value: "dispatched", label: "Dispatched" },
          { value: "received", label: "Received" },
          { value: "all", label: "All" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterStatus(tab.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterStatus === tab.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <TruckIcon className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <p className="text-gray-500">No requests in this category.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedId((v) => (v === req.id ? null : req.id))}
                className="w-full px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50"
              >
                <div className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-gray-800">{req.requestNumber}</span>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{req.branchName}</p>
                  <p className="text-xs text-gray-500">
                    {req.storekeeperName} · {req.lines.length} items · {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {expandedId === req.id ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />}
              </button>

              {expandedId === req.id && (
                <div className="border-t border-gray-100">
                  <div className="px-5 py-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-xs font-medium text-gray-500 pb-2">Product</th>
                            <th className="text-right text-xs font-medium text-gray-500 pb-2">Requested</th>
                            <th className="text-right text-xs font-medium text-gray-500 pb-2">Warehouse</th>
                            {req.status === "pending" && <th className="text-right text-xs font-medium text-gray-500 pb-2">Approve Qty</th>}
                            {(req.status === "approved" || req.status === "partially_approved") && <th className="text-right text-xs font-medium text-gray-500 pb-2">Dispatch Qty</th>}
                            {(req.status === "dispatched" || req.status === "received" || req.status === "partially_received") && (
                              <>
                                <th className="text-right text-xs font-medium text-gray-500 pb-2">Approved</th>
                                <th className="text-right text-xs font-medium text-gray-500 pb-2">Dispatched</th>
                                {(req.status === "received" || req.status === "partially_received") && <th className="text-right text-xs font-medium text-gray-500 pb-2">Received</th>}
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {req.lines.map((line) => (
                            <tr key={line.productId}>
                              <td className="py-2.5">
                                <div className="font-medium text-gray-900">{line.productName}</div>
                                <div className="text-xs text-gray-400">{line.unit}</div>
                              </td>
                              <td className="py-2.5 text-right text-gray-600">{line.requestedQty}</td>
                              <td className="py-2.5 text-right">
                                <span className={line.warehouseQty < line.requestedQty ? "text-orange-600 font-semibold" : "text-gray-600"}>
                                  {line.warehouseQty}
                                </span>
                              </td>
                              {req.status === "pending" && (
                                <td className="py-2.5 text-right">
                                  <input
                                    type="number"
                                    min={0}
                                    max={Math.min(line.requestedQty, line.warehouseQty)}
                                    value={getApprovedQty(req.id, line.productId, line.requestedQty)}
                                    onChange={(e) =>
                                      setApprovedQtys((prev) => ({
                                        ...prev,
                                        [req.id]: { ...prev[req.id], [line.productId]: Number(e.target.value) },
                                      }))
                                    }
                                    className="w-20 text-right border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                  />
                                </td>
                              )}
                              {(req.status === "approved" || req.status === "partially_approved") && (
                                <td className="py-2.5 text-right">
                                  <input
                                    type="number"
                                    min={0}
                                    max={Math.min(line.approvedQty ?? 0, line.warehouseQty)}
                                    value={getDispatchQty(req.id, line.productId, line.approvedQty)}
                                    onChange={(e) =>
                                      setDispatchQtys((prev) => ({
                                        ...prev,
                                        [req.id]: { ...prev[req.id], [line.productId]: Number(e.target.value) },
                                      }))
                                    }
                                    className="w-20 text-right border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                  />
                                </td>
                              )}
                              {(req.status === "dispatched" || req.status === "received" || req.status === "partially_received") && (
                                <>
                                  <td className="py-2.5 text-right text-gray-600">{line.approvedQty ?? "—"}</td>
                                  <td className="py-2.5 text-right text-indigo-600 font-medium">{line.dispatchedQty ?? "—"}</td>
                                  {(req.status === "received" || req.status === "partially_received") && (
                                    <td className="py-2.5 text-right text-green-700 font-medium">{line.receivedQty ?? "—"}</td>
                                  )}
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {req.status === "pending" && (
                    <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Notes / Rejection Reason</label>
                        <textarea
                          value={notesMap[req.id] ?? ""}
                          onChange={(e) => setNotesMap((prev) => ({ ...prev, [req.id]: e.target.value }))}
                          rows={2}
                          placeholder="Optional for approval, required for rejection…"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApproval(req.id, "reject", req.lines)}
                          disabled={isPending}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold border border-red-200 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                        <button
                          onClick={() => handleApproval(req.id, "approve", req.lines)}
                          disabled={isPending}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                      </div>
                    </div>
                  )}

                  {(req.status === "approved" || req.status === "partially_approved") && (
                    <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                      <button
                        onClick={() => handleDispatch(req.id, req.lines)}
                        disabled={isPending}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50"
                      >
                        <TruckIcon className="w-4 h-4" />
                        {isPending ? "Processing…" : "Dispatch & Deduct Warehouse Stock"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
