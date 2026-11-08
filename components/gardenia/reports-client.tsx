"use client";

import { useState, useMemo } from "react";
import { BarChart3, Download, Filter, Search } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { formatAed, lineValue } from "@/lib/gardenia/money";
import type { GardeniaRole } from "@/lib/gardenia/types";

interface Branch { id: string; name: string; }
interface Product { id: string; name: string; }
interface User { id: string; name: string; }

interface SalesLine {
  productId: string;
  productName: string;
  unit: string;
  requestedQty: number;
  approvedQty: number | null;
  issuedQty: number | null;
  unitPrice: number;
}

interface SalesRequest {
  id: string;
  requestNumber: string;
  branchId: string;
  branchName: string;
  salespersonId: string;
  salespersonName: string;
  approvedByName: string | null;
  issuedByName: string | null;
  customerName: string;
  status: string;
  lines: SalesLine[];
  createdAt: string;
  issuedAt: string | null;
}

interface ReportData {
  salesRequests: SalesRequest[];
  branches: Branch[];
  products: Product[];
  users: User[];
  actorBranchId: string | null;
  actorRole: GardeniaRole;
}

export function ReportsClient({ data }: { data: ReportData }) {
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState(data.actorBranchId ?? "all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSalesperson, setFilterSalesperson] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return data.salesRequests.filter((r) => {
      if (filterBranch !== "all" && r.branchId !== filterBranch) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterSalesperson !== "all" && r.salespersonId !== filterSalesperson) return false;
      if (dateFrom && new Date(r.createdAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(r.createdAt) > new Date(dateTo + "T23:59:59")) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!r.requestNumber.toLowerCase().includes(s) &&
            !r.customerName.toLowerCase().includes(s) &&
            !r.salespersonName.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [data, filterBranch, filterStatus, filterSalesperson, dateFrom, dateTo, search]);

  const totalRequestedQty = filtered.flatMap((r) => r.lines).reduce((s, l) => s + l.requestedQty, 0);
  const totalIssuedQty = filtered.flatMap((r) => r.lines).reduce((s, l) => s + (l.issuedQty ?? 0), 0);
  const requestValue = filtered
    .filter((r) => r.status !== "rejected")
    .flatMap((r) => r.lines)
    .reduce((s, l) => s + lineValue(l.requestedQty, l.unitPrice ?? 0), 0);
  const issuedValue = filtered.flatMap((r) => r.lines).reduce((s, l) => s + lineValue(l.issuedQty ?? 0, l.unitPrice ?? 0), 0);
  const completedCount = filtered.filter((r) => r.status === "issued").length;
  const partialCount = filtered.filter((r) => r.status === "partially_issued").length;
  const pendingCount = filtered.filter((r) => r.status === "pending" || r.status === "returned").length;
  const rejectedCount = filtered.filter((r) => r.status === "rejected").length;
  const waitingCount = filtered.filter((r) => r.status === "approved").length;

  const bySalesperson = new Map<string, { name: string; value: number; issued: number }>();
  const byBranch = new Map<string, { name: string; value: number; issued: number }>();
  const byProduct = new Map<string, { name: string; requested: number; issued: number; value: number }>();
  for (const req of filtered) {
    const sales = bySalesperson.get(req.salespersonId) ?? { name: req.salespersonName, value: 0, issued: 0 };
    const branch = byBranch.get(req.branchId) ?? { name: req.branchName, value: 0, issued: 0 };
    for (const line of req.lines) {
      const requested = lineValue(line.requestedQty, line.unitPrice ?? 0);
      const issued = lineValue(line.issuedQty ?? 0, line.unitPrice ?? 0);
      if (req.status !== "rejected") {
        sales.value += requested;
        branch.value += requested;
      }
      sales.issued += issued;
      branch.issued += issued;
      const product = byProduct.get(line.productId) ?? { name: line.productName, requested: 0, issued: 0, value: 0 };
      product.requested += line.requestedQty;
      product.issued += line.issuedQty ?? 0;
      product.value += issued;
      byProduct.set(line.productId, product);
    }
    bySalesperson.set(req.salespersonId, sales);
    byBranch.set(req.branchId, branch);
  }
  const topProducts = [...byProduct.values()].sort((a, b) => b.requested - a.requested).slice(0, 6);

  function exportCSV() {
    const rows = [
      ["Request #", "Branch", "Salesperson", "Client/Organisation", "Status", "Product", "Requested", "Approved", "Issued", "Unit price", "Issued value", "Date", "Issue Date"],
    ];
    for (const req of filtered) {
      for (const line of req.lines) {
        rows.push([
          req.requestNumber,
          req.branchName,
          req.salespersonName,
          req.customerName,
          req.status,
          line.productName,
          String(line.requestedQty),
          String(line.approvedQty ?? ""),
          String(line.issuedQty ?? ""),
          String(line.unitPrice ?? 0),
          String(lineValue(line.issuedQty ?? 0, line.unitPrice ?? 0)),
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
    a.download = `gardenia-sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500">{filtered.length} requests matching current filters</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">Requests</p>
          <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-green-700">{completedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">Units Requested</p>
          <p className="text-2xl font-bold text-gray-900">{totalRequestedQty.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">Units Issued</p>
          <p className="text-2xl font-bold text-blue-700">{totalIssuedQty.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">Request value</p>
          <p className="text-xl font-bold text-gray-900">{formatAed(requestValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">Issued value</p>
          <p className="text-xl font-bold text-green-700">{formatAed(issuedValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">Pending / waiting / partial / rejected</p>
          <p className="text-sm font-semibold text-gray-800 mt-1">{pendingCount} · {waitingCount} · {partialCount} · {rejectedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">Fully issued</p>
          <p className="text-2xl font-bold text-blue-700">{completedCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <Breakdown title="Value by salesperson" rows={[...bySalesperson.values()].sort((a, b) => b.issued - a.issued).slice(0, 6).map((row) => ({ label: row.name, detail: formatAed(row.issued) }))} />
        <Breakdown title="Value by branch" rows={[...byBranch.values()].sort((a, b) => b.issued - a.issued).map((row) => ({ label: row.name, detail: formatAed(row.issued) }))} />
        <Breakdown title="Most requested products" rows={topProducts.map((row) => ({ label: row.name, detail: `${row.issued} issued` }))} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {data.actorRole !== "branch_manager" && (
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Branches</option>
              {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending approval</option>
            <option value="approved">Waiting for issuance</option>
            <option value="issued">Fully issued</option>
            <option value="partially_issued">Partially issued</option>
            <option value="rejected">Rejected</option>
            <option value="returned">Returned for changes</option>
          </select>
          <select
            value={filterSalesperson}
            onChange={(e) => setFilterSalesperson(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Salespersons</option>
            {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="To date"
          />
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Request</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Branch</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Salesperson</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Client / Organisation</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Items</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-gray-700">{req.requestNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{req.branchName}</td>
                  <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{req.salespersonName}</td>
                  <td className="px-4 py-3 text-gray-900">{req.customerName}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={req.status} /></td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{req.lines.length}</td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">{new Date(req.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">No results found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; detail: string }[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing in this range.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-gray-700">{row.label}</span>
              <span className="font-medium text-gray-900 text-right">{row.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
