export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { StatCard } from "@/components/gardenia/stat-card";
import { StatusBadge } from "@/components/gardenia/status-badge";
import { PageHeader } from "@/components/gardenia/page-header";
import { Package, ClipboardList, TruckIcon, AlertTriangle } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Storekeeper Dashboard" };

export default async function StorekeeperDashboard() {
  const actor = await requireActor(["branch_storekeeper"]);
  const ws = await readWorkspace();

  const branch = ws.branches.find((b) => b.id === actor.branchId);

  const approvedRequests = ws.salesRequests.filter(
    (r) => r.branchId === actor.branchId && r.status === "approved"
  ).length;

  const pendingReplenishments = ws.replenishmentRequests.filter(
    (r) => r.branchId === actor.branchId && r.status === "pending"
  ).length;

  const dispatchedReplenishments = ws.replenishmentRequests.filter(
    (r) => r.branchId === actor.branchId && r.status === "dispatched"
  ).length;

  // Low stock items for this branch
  const lowStockItems = ws.products
    .filter((p) => p.active)
    .map((p) => {
      const bal = ws.inventoryBalances.find(
        (b) => b.productId === p.id && b.locationId === actor.branchId
      );
      return { product: p, qty: bal?.quantity ?? 0 };
    })
    .filter(({ product, qty }) => qty <= product.minStockLevel);

  const totalInventory = ws.inventoryBalances
    .filter((b) => b.locationId === actor.branchId)
    .reduce((s, b) => s + b.quantity, 0);

  const recentRequests = ws.salesRequests
    .filter((r) => r.branchId === actor.branchId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Storekeeper Dashboard"
        subtitle={branch?.name ?? ""}
        action={
          <div className="flex gap-2">
            {approvedRequests > 0 && (
              <Link
                href="/g/storekeeper/issues"
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                Issue Queue ({approvedRequests})
              </Link>
            )}
            <Link
              href="/g/storekeeper/replenishment"
              className="flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <TruckIcon className="w-4 h-4" />
              Replenishment
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Ready to Issue" value={approvedRequests} icon={<ClipboardList className="w-5 h-5 text-orange-600" />} iconBg="bg-orange-100" alert={approvedRequests > 0} />
        <StatCard title="Branch Inventory" value={totalInventory.toLocaleString()} icon={<Package className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-100" />
        <StatCard title="Pending Replenishment" value={pendingReplenishments} icon={<TruckIcon className="w-5 h-5 text-purple-600" />} iconBg="bg-purple-100" />
        <StatCard title="Incoming Shipments" value={dispatchedReplenishments} icon={<TruckIcon className="w-5 h-5 text-green-600" />} iconBg="bg-green-100" alert={dispatchedReplenishments > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Requests */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Branch Requests</h2>
            <Link href="/g/storekeeper/issues" className="text-xs text-green-600 hover:text-green-700 font-medium">
              Issue queue →
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentRequests.map((req) => (
              <div key={req.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-600">{req.requestNumber}</span>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{req.customerName}</p>
                  <p className="text-xs text-gray-400">{req.lines.length} item(s)</p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(req.updatedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {recentRequests.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No requests yet</div>
            )}
          </div>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h2 className="font-semibold text-gray-900">Low Stock</h2>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">All items above minimum level</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {lowStockItems.slice(0, 8).map(({ product, qty }) => (
                <div key={product.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-400">Min: {product.minStockLevel} {product.unit}</p>
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
