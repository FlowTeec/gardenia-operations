"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { updateProductPrice } from "@/lib/gardenia/actions";
import { formatAed } from "@/lib/gardenia/money";

export interface PriceRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  categoryName: string;
  sellingPrice: number;
  active: boolean;
}

export function PriceListClient({ products, canEdit }: { products: PriceRow[]; canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = products.filter((product) => {
    const query = search.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      product.categoryName.toLowerCase().includes(query)
    );
  });

  function save(product: PriceRow) {
    const raw = drafts[product.id] ?? String(product.sellingPrice);
    const price = Number(raw);
    startTransition(async () => {
      const result = await updateProductPrice(product.id, price);
      setMessage(result?.error ?? `Updated ${product.name} to ${formatAed(price)}. Existing requests keep their original prices.`);
    });
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by product, SKU, or category"
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      {message && (
        <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${message.startsWith("Updated") ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
          {message}
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Unit</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Selling price</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((product) => (
                <tr key={product.id} className={product.active ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{product.name}</div>
                    <div className="text-xs font-mono text-gray-400">{product.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{product.categoryName}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{product.unit}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit ? (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={product.sellingPrice}
                        onChange={(event) => setDrafts((prev) => ({ ...prev, [product.id]: event.target.value }))}
                        className="w-28 text-right border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    ) : (
                      <span className="font-semibold text-gray-900">{formatAed(product.sellingPrice)}</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => save(product)}
                        className="text-sm font-medium text-green-700 hover:text-green-800 disabled:opacity-50"
                      >
                        Save
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-gray-400">No products match that search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
