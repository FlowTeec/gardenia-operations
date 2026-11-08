export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { PageHeader } from "@/components/gardenia/page-header";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "Branch Inventory" };

export default async function ManagerInventoryPage() {
  const actor = await requireActor(["branch_manager"]);
  const ws = await readWorkspace();

  const branch = ws.branches.find((b) => b.id === actor.branchId);
  const targetBranchId = actor.branchId ?? ws.branches[0]?.id;

  const inventoryRows = ws.products
    .filter((p) => p.active)
    .map((p) => {
      const bal = ws.inventoryBalances.find(
        (b) => b.productId === p.id && b.locationId === targetBranchId
      );
      const category = ws.productCategories.find((c) => c.id === p.categoryId);
      return {
        product: p,
        quantity: bal?.quantity ?? 0,
        categoryName: category?.name ?? "Uncategorized",
        isLow: (bal?.quantity ?? 0) <= p.minStockLevel,
      };
    })
    .sort((a, b) => {
      if (a.isLow !== b.isLow) return a.isLow ? -1 : 1;
      return a.product.name.localeCompare(b.product.name);
    });

  const totalQty = inventoryRows.reduce((s, r) => s + r.quantity, 0);
  const lowCount = inventoryRows.filter((r) => r.isLow).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Branch Inventory" subtitle={branch?.name ?? ""} />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Total Units</p>
          <p className="text-2xl font-bold text-gray-900">{totalQty.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Products</p>
          <p className="text-2xl font-bold text-gray-900">{inventoryRows.length}</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${lowCount > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-gray-200 shadow-sm"}`}>
          <p className="text-xs text-gray-500">Low Stock</p>
          <p className={`text-2xl font-bold ${lowCount > 0 ? "text-orange-700" : "text-gray-900"}`}>{lowCount}</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Unit</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty on Hand</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Min Level</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inventoryRows.map(({ product, quantity, categoryName, isLow }) => (
                <tr key={product.id} className={`hover:bg-gray-50 ${isLow ? "bg-orange-50/30" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isLow && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
                      <div>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{product.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{categoryName}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{product.unit}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-lg font-bold ${isLow ? "text-orange-600" : quantity === 0 ? "text-red-600" : "text-gray-900"}`}>{quantity}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden lg:table-cell">{product.minStockLevel}</td>
                  <td className="px-4 py-3 text-center">
                    {quantity === 0 ? (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">Out of Stock</span>
                    ) : isLow ? (
                      <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">Low Stock</span>
                    ) : (
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">In Stock</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
