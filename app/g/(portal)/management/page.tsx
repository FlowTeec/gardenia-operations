export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { StatCard } from "@/components/gardenia/stat-card";
import { StatusBadge } from "@/components/gardenia/status-badge";
import { PageHeader } from "@/components/gardenia/page-header";
import { BarChart3, Package, GitBranch, ShoppingCart, TruckIcon, Users } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Management Dashboard" };

export default async function ManagementDashboard() {
  await requireActor(["management"]);
  const ws = await readWorkspace();

  const totalSales = ws.salesRequests.length;
  const issuedSales = ws.salesRequests.filter((r) => r.status === "issued" || r.status === "partially_issued").length;
  const pendingSales = ws.salesRequests.filter((r) => r.status === "pending").length;
  const totalReplenishments = ws.replenishmentRequests.length;

  const warehouseTotal = ws.inventoryBalances
    .filter((b) => b.locationId === "warehouse")
    .reduce((s, b) => s + b.quantity, 0);

  const branchStats = ws.branches.map((branch) => {
    const inventory = ws.inventoryBalances
      .filter((b) => b.locationId === branch.id)
      .reduce((s, b) => s + b.quantity, 0);
    const branchSales = ws.salesRequests.filter((r) => r.branchId === branch.id);
    const issued = branchSales.filter((r) => r.status === "issued" || r.status === "partially_issued").length;
    const pending = branchSales.filter((r) => r.status === "pending").length;
    const users = ws.users.filter((u) => u.branchId === branch.id && u.active);

    // Total items issued by this branch
    const totalIssuedQty = ws.salesRequests
      .filter((r) => r.branchId === branch.id && (r.status === "issued" || r.status === "partially_issued"))
      .flatMap((r) => r.lines)
      .reduce((s, l) => s + (l.issuedQty ?? 0), 0);

    return { branch, inventory, sales: branchSales.length, issued, pending, users: users.length, totalIssuedQty };
  });

  // Top salespersons
  const salespersonActivity = ws.users
    .filter((u) => u.role === "salesperson" && u.active)
    .map((u) => {
      const myRequests = ws.salesRequests.filter((r) => r.salespersonId === u.id);
      const issuedCount = myRequests.filter((r) => r.status === "issued" || r.status === "partially_issued").length;
      const branch = ws.branches.find((b) => b.id === u.branchId);
      return { user: u, total: myRequests.length, issued: issuedCount, branchName: branch?.name ?? "" };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Recent completed transactions
  const recentTransactions = [...ws.salesRequests]
    .filter((r) => r.status === "issued" || r.status === "partially_issued")
    .sort((a, b) => new Date(b.issuedAt ?? b.updatedAt).getTime() - new Date(a.issuedAt ?? a.updatedAt).getTime())
    .slice(0, 6);

  function getUserName(id: string | null) {
    if (!id) return "—";
    return ws.users.find((u) => u.id === id)?.name ?? id;
  }

  function getBranchName(id: string) {
    return ws.branches.find((b) => b.id === id)?.name ?? id;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Management Overview"
        subtitle="Gardenia Smart Operations – Read-only executive view"
        action={
          <Link href="/g/reports" className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <BarChart3 className="w-4 h-4" /> Reports
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Sales Requests" value={totalSales} icon={<ShoppingCart className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-100" />
        <StatCard title="Issues Completed" value={issuedSales} icon={<Package className="w-5 h-5 text-green-600" />} iconBg="bg-green-100" />
        <StatCard title="Pending Sales" value={pendingSales} icon={<ShoppingCart className="w-5 h-5 text-yellow-600" />} iconBg="bg-yellow-100" alert={pendingSales > 0} />
        <StatCard title="Replenishments" value={totalReplenishments} icon={<TruckIcon className="w-5 h-5 text-purple-600" />} iconBg="bg-purple-100" />
        <StatCard title="Warehouse Stock" value={warehouseTotal.toLocaleString()} subtitle="units" icon={<Package className="w-5 h-5 text-indigo-600" />} iconBg="bg-indigo-100" />
        <StatCard title="Active Branches" value={ws.branches.filter((b) => b.active).length} icon={<GitBranch className="w-5 h-5 text-green-600" />} iconBg="bg-green-100" />
        <StatCard title="Active Users" value={ws.users.filter((u) => u.active).length} icon={<Users className="w-5 h-5 text-gray-600" />} iconBg="bg-gray-100" />
        <StatCard title="Products" value={ws.products.filter((p) => p.active).length} icon={<Package className="w-5 h-5 text-orange-600" />} iconBg="bg-orange-100" />
      </div>

      {/* Branch Performance Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Branch Performance Overview</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 pb-3">Branch</th>
                <th className="text-right text-xs font-medium text-gray-500 pb-3">Inventory</th>
                <th className="text-right text-xs font-medium text-gray-500 pb-3">Total Requests</th>
                <th className="text-right text-xs font-medium text-gray-500 pb-3">Issues Done</th>
                <th className="text-right text-xs font-medium text-gray-500 pb-3">Units Issued</th>
                <th className="text-right text-xs font-medium text-gray-500 pb-3">Pending</th>
                <th className="text-right text-xs font-medium text-gray-500 pb-3">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {branchStats.map(({ branch, inventory, sales, issued, pending, users, totalIssuedQty }) => (
                <tr key={branch.id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900">{branch.name}</td>
                  <td className="py-3 text-right text-gray-700 font-mono">{inventory.toLocaleString()}</td>
                  <td className="py-3 text-right text-gray-600">{sales}</td>
                  <td className="py-3 text-right text-green-700 font-medium">{issued}</td>
                  <td className="py-3 text-right text-blue-700 font-medium">{totalIssuedQty.toLocaleString()}</td>
                  <td className="py-3 text-right">
                    {pending > 0 ? (
                      <span className="text-orange-600 font-medium">{pending}</span>
                    ) : (
                      <span className="text-gray-300">0</span>
                    )}
                  </td>
                  <td className="py-3 text-right text-gray-500">{users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salesperson Activity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Salesperson Activity</h2>
          <div className="space-y-2">
            {salespersonActivity.map(({ user, total, issued, branchName }) => (
              <div key={user.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 flex-shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-400">{branchName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">{total}</p>
                  <p className="text-xs text-green-600">{issued} issued</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Completed Transactions */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Completed Issues</h2>
            <Link href="/g/reports/history" className="text-xs text-green-600 hover:text-green-700 font-medium">View all →</Link>
          </div>
          <div className="space-y-2">
            {recentTransactions.map((req) => (
              <div key={req.id} className="py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-600">{req.requestNumber}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-xs text-gray-700 mt-0.5">{req.customerName}</p>
                    <p className="text-[10px] text-gray-400">
                      {getBranchName(req.branchId)} · {getUserName(req.salespersonId)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {req.issuedAt ? new Date(req.issuedAt).toLocaleDateString() : "—"}
                  </p>
                </div>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No completed issues yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
