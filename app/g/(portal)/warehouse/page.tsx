export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { StatCard } from "@/components/gardenia/stat-card";
import { StatusBadge } from "@/components/gardenia/status-badge";
import { PageHeader } from "@/components/gardenia/page-header";
import { Warehouse, TruckIcon, Package, AlertTriangle, CheckSquare } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Warehouse Dashboard" };

export default async function WarehouseDashboard() {
  const actor = await requireActor(["warehouse_manager"]);
  const ws = await readWorkspace();

  const pendingReplenishments = ws.replenishmentRequests.filter((r) => r.status === "pending").length;
  const approvedReplenishments = ws.replenishmentRequests.filter(
    (r) => r.status === "approved" || r.status === "partially_approved"
  ).length;
  const dispatchedReplenishments = ws.replenishmentRequests.filter((r) => r.status === "dispatched").length;

  const totalWarehouseQty = ws.inventoryBalances
    .filter((b) => b.locationId === "warehouse")
    .reduce((s, b) => s + b.quantity, 0);

  const lowStockItems = ws.products
    .filter((p) => p.active)
    .map((p) => ({
      product: p,
      qty: ws.inventoryBalances.find((b) => b.productId === p.id && b.locationId === "warehouse")?.quantity ?? 0,
    }))
    .filter(({ product, qty }) => qty <= product.minStockLevel);

  const recentReplenishments = [...ws.replenishmentRequests]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  function getBranchName(branchId: string) {
    return ws.branches.find((b) => b.id === branchId)?.name ?? branchId;
  }

  function getUserName(userId: string | null) {
    if (!userId) return "—";
    return ws.users.find((u) => u.id === userId)?.name ?? userId;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Warehouse Dashboard"
        subtitle="Central Warehouse – Stock Overview"
        action={
          <Link
            href="/g/warehouse/replenishment"
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              pendingReplenishments > 0
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <TruckIcon className="w-4 h-4" />
            Replenishment Requests
            {pendingReplenishments > 0 && (
              <span className="bg-white text-orange-500 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pendingReplenishments}
              </span>
            )}
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Warehouse Stock" value={totalWarehouseQty.toLocaleString()} icon={<Warehouse className="w-5 h-5 text-indigo-600" />} iconBg="bg-indigo-100" />
        <StatCard title="Pending Requests" value={pendingReplenishments} icon={<TruckIcon className="w-5 h-5 text-yellow-600" />} iconBg="bg-yellow-100" alert={pendingReplenishments > 0} />
        <StatCard title="Approved / Ready" value={approvedReplenishments} icon={<CheckSquare className="w-5 h-5 text-green-600" />} iconBg="bg-green-100" alert={approvedReplenishments > 0} />
        <StatCard title="In Transit" value={dispatchedReplenishments} icon={<TruckIcon className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-100" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Replenishments */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Replenishment Requests</h2>
            <Link href="/g/warehouse/replenishment" className="text-xs text-green-600 hover:text-green-700 font-medium">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {recentReplenishments.map((req) => (
              <div key={req.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-gray-700">{req.requestNumber}</span>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{getBranchName(req.branchId)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{new Date(req.updatedAt).toLocaleDateString()}</p>
                  <p className="text-xs text-gray-400">{req.lines.length} items</p>
                </div>
              </div>
            ))}
            {recentReplenishments.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No requests yet</p>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h2 className="font-semibold text-gray-900">Warehouse Low Stock</h2>
          </div>
          {lowStockItems.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">All items above minimum level</p>
          ) : (
            <div className="space-y-2">
              {lowStockItems.slice(0, 8).map(({ product, qty }) => (
                <div key={product.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-gray-900">{product.name}</p>
                    <p className="text-[10px] text-gray-400">Min: {product.minStockLevel}</p>
                  </div>
                  <span className="text-sm font-bold text-red-600">{qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
