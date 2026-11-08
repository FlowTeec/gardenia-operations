"use client";

import { useState, useTransition } from "react";
import { Plus, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { createProduct, toggleProductStatus, updateProductPrice } from "@/lib/gardenia/actions";
import { formatAed } from "@/lib/gardenia/money";
import type { ProductCategory } from "@/lib/gardenia/types";

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  unit: string;
  description: string;
  minStockLevel: number;
  sellingPrice: number;
  active: boolean;
  warehouseQty: number;
}

export function ProductManagementClient({
  products,
  categories,
}: {
  products: ProductRow[];
  categories: ProductCategory[];
}) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.categoryName.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate(fd: FormData) {
    setFormError(null);
    const result = await createProduct(fd);
    if (result?.error) { setFormError(result.error); return; }
    setShowForm(false);
    setMsg("Product created successfully.");
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleToggle(id: string, active: boolean) {
    startTransition(async () => {
      await toggleProductStatus(id, active);
    });
  }

  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Products Management</h1>
          <p className="text-sm text-gray-500">{products.length} products · {products.filter((p) => p.active).length} active</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {msg && (
        <div className="mb-4 bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-2.5 text-sm">
          {msg}
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU, or category…"
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Unit</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Selling price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Warehouse Stock</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Min Level</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{p.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{p.categoryName}</td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{p.unit}</td>
                  <td className="px-4 py-3 text-right">
                    <form
                      className="inline-flex items-center gap-1"
                      action={async (fd) => {
                        const price = Number(fd.get("sellingPrice"));
                        const result = await updateProductPrice(p.id, price);
                        setMsg(result?.error ?? `${p.name} is now ${formatAed(price)}.`);
                      }}
                    >
                      <input name="sellingPrice" type="number" min="0" step="0.01" defaultValue={p.sellingPrice} className="w-24 text-right border rounded-lg px-2 py-1 text-sm" />
                      <button className="text-xs font-medium text-green-700">Save</button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${p.warehouseQty <= p.minStockLevel ? "text-red-600" : "text-gray-900"}`}>
                      {p.warehouseQty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden lg:table-cell">{p.minStockLevel}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={p.active ? "active" : "inactive"} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(p.id, !p.active)}
                      disabled={isPending}
                      className="text-gray-400 hover:text-green-600 transition-colors"
                    >
                      {p.active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No products found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Add New Product</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form action={handleCreate} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-sm">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input name="sku" required placeholder="GRD-0099" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input name="unit" required placeholder="Litre, kg, Unit…" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input name="name" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select name="categoryId" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Select category…</option>
                  {categories.filter((c) => c.active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling price (AED)</label>
                <input name="sellingPrice" type="number" min="0" step="0.01" required defaultValue="0" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Stock Level</label>
                <input name="minStockLevel" type="number" min="0" defaultValue="10" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">Create Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
