"use client";

import { useState } from "react";
import { StatusBadge } from "./status-badge";
import { History, Download } from "lucide-react";

interface Product { id: string; name: string; unit: string; }

interface SalesRequest {
  id: string;
  requestNumber: string;
  type: "sales";
  branchName: string;
  salespersonName: string;
  approvedByName: string | null;
  issuedByName: string | null;
  customerName: string;
  status: string;
  lines: { productId: string; requestedQty: number; approvedQty: number | null; issuedQty: number | null }[];
  createdAt: string;
  issuedAt: string | null;
  approvedAt: string | null;
}

interface ReplenishmentRequest {
  id: string;
  requestNumber: string;
  type: "replenishment";
  branchName: string;
  storekeeperName: string;
  approvedByName: string | null;
  status: string;
  lines: { productId: string; requestedQty: number; approvedQty: number | null; dispatchedQty: number | null; receivedQty: number | null }[];
  createdAt: string;
  receivedAt: string | null;
}

export function TransactionHistoryClient({
  sales,
  replenishments,
  products,
}: {
  sales: SalesRequest[];
  replenishments: ReplenishmentRequest[];
  products: Product[];
}) {
  const [tab, setTab] = useState<"sales" | "replenishment">("sales");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  function getProductName(id: string) {
    return products.find((p) => p.id === id)?.name ?? id;
  }

  function getProductUnit(id: string) {
    return products.find((p) => p.id === id)?.unit ?? "";
  }

  const filteredSales = sales.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!r.requestNumber.toLowerCase().includes(s) &&
          !r.customerName.toLowerCase().includes(s) &&
          !r.salespersonName.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const filteredReplenishments = replenishments.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!r.requestNumber.toLowerCase().includes(s) && !r.branchName.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  function exportSalesCSV() {
    const rows = [["Request #", "Branch", "Salesperson", "Client/Organisation", "Status", "Product", "Requested", "Approved", "Issued", "Approved By", "Issued By", "Created", "Issued At"]];
    for (const req of filteredSales) {
      for (const l of req.lines) {
        rows.push([
          req.requestNumber, req.branchName, req.salespersonName, req.customerName, req.status,
          getProductName(l.productId), String(l.requestedQty), String(l.approvedQty ?? ""),
          String(l.issuedQty ?? ""), req.approvedByName ?? "", req.issuedByName ?? "",
          new Date(req.createdAt).toLocaleDateString(),
          req.issuedAt ? new Date(req.issuedAt).toLocaleDateString() : "",
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gardenia-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Transaction History</h1>
          <p className="text-sm text-gray-500">Complete audit trail of all operations</p>
        </div>
        {tab === "sales" && (
          <button onClick={exportSalesCSV} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => { setTab("sales"); setStatusFilter("all"); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "sales" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
        >
          Sales Requests ({sales.length})
        </button>
        <button
          onClick={() => { setTab("replenishment"); setStatusFilter("all"); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "replenishment" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
        >
          Replenishments ({replenishments.length})
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Statuses</option>
          {tab === "sales" ? (
            <>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="issued">Issued</option>
              <option value="partially_issued">Partially Issued</option>
            </>
          ) : (
            <>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="dispatched">Dispatched</option>
              <option value="received">Received</option>
            </>
          )}
        </select>
      </div>

      {tab === "sales" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Request #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Branch</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Salesperson</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Client / Organisation</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Products</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{req.requestNumber}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{req.branchName}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{req.salespersonName}</td>
                    <td className="px-4 py-3 text-gray-900">{req.customerName}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{req.lines.length}</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">{new Date(req.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {filteredSales.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No transactions found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "replenishment" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Request #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Branch</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Storekeeper</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Items</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReplenishments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{req.requestNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{req.branchName}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{req.storekeeperName}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3 text-right text-gray-500">{req.lines.length}</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">{new Date(req.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {filteredReplenishments.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No transactions found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
