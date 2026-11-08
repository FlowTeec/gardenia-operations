"use client";

import { useState, useTransition } from "react";
import { Search, Plus, Minus, Trash2, ShoppingCart, ArrowLeft } from "lucide-react";
import { createSalesRequest, resubmitSalesRequest } from "@/lib/gardenia/actions";
import { formatAed, lineValue } from "@/lib/gardenia/money";
import Link from "next/link";

interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  categoryName: string;
  sellingPrice: number;
}

interface SelectedLine {
  product: Product;
  quantity: number;
}

export function NewSalesRequestForm({
  actorName,
  branchName,
  products,
  requestNumber,
  requestId,
  initialCustomer = "",
  initialNotes = "",
  initialLines = [],
}: {
  actorName: string;
  branchName: string;
  products: Product[];
  requestNumber: string;
  requestId?: string;
  initialCustomer?: string;
  initialNotes?: string;
  initialLines?: { productId: string; quantity: number }[];
}) {
  const [search, setSearch] = useState("");
  const [selectedLines, setSelectedLines] = useState<SelectedLine[]>(() =>
    initialLines
      .map((line) => {
        const product = products.find((item) => item.id === line.productId);
        return product ? { product, quantity: line.quantity } : null;
      })
      .filter((line): line is SelectedLine => line !== null)
  );
  const [customerName, setCustomerName] = useState(initialCustomer);
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.categoryName;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const filteredGroups = Object.entries(grouped).reduce<Record<string, Product[]>>((acc, [cat, prods]) => {
    const filtered = prods.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
    );
    if (filtered.length > 0) acc[cat] = filtered;
    return acc;
  }, {});

  function isSelected(productId: string) {
    return selectedLines.some((l) => l.product.id === productId);
  }

  function toggleProduct(product: Product) {
    if (isSelected(product.id)) {
      setSelectedLines((prev) => prev.filter((l) => l.product.id !== product.id));
    } else {
      setSelectedLines((prev) => [...prev, { product, quantity: 1 }]);
    }
  }

  function updateQty(productId: string, delta: number) {
    setSelectedLines((prev) =>
      prev.map((l) =>
        l.product.id === productId
          ? { ...l, quantity: Math.max(1, l.quantity + delta) }
          : l
      )
    );
  }

  function setQty(productId: string, value: number) {
    if (value < 1) return;
    setSelectedLines((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, quantity: value } : l))
    );
  }

  async function handleSubmit() {
    if (!customerName.trim()) { setError("Customer name is required."); return; }
    if (selectedLines.length === 0) { setError("Please select at least one product."); return; }

    setError(null);
    const fd = new FormData();
    fd.append("customerName", customerName.trim());
    fd.append("notes", notes);
    fd.append(
      "lines",
      JSON.stringify(
        selectedLines.map((l) => ({
          productId: l.product.id,
          requestedQty: l.quantity,
          approvedQty: null,
          issuedQty: null,
        }))
      )
    );

    const estimated = selectedLines.reduce((sum, line) => sum + lineValue(line.quantity, line.product.sellingPrice), 0);
    fd.append("estimatedTotal", String(estimated));

    startTransition(async () => {
      const result = requestId ? await resubmitSalesRequest(requestId, fd) : await createSalesRequest(fd);
      if (result?.error) setError(result.error);
    });
  }

  const estimatedTotal = selectedLines.reduce(
    (sum, line) => sum + lineValue(line.quantity, line.product.sellingPrice),
    0
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/g/salesperson" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{requestId ? "Update Material Request" : "New Material Request"}</h1>
          <p className="text-sm text-gray-500">{requestNumber}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Auto-filled info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-4">Request Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500">Salesperson</label>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{actorName}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Branch</label>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{branchName}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Date</label>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Request #</label>
            <p className="text-sm font-mono font-medium text-gray-900 mt-0.5">{requestNumber}</p>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Client / Organisation Name <span className="text-red-500">*</span>
          </label>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Abu Dhabi Municipality – Parks Dept."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any additional information…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Product Selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Select Products</h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-3">
            {Object.entries(filteredGroups).map(([category, prods]) => (
              <div key={category}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">{category}</p>
                <div className="space-y-1">
                  {prods.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => toggleProduct(product)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                        isSelected(product.id)
                          ? "bg-green-50 border border-green-300"
                          : "bg-gray-50 hover:bg-gray-100 border border-transparent"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected(product.id) ? "border-green-500 bg-green-500" : "border-gray-300"
                      }`}>
                        {isSelected(product.id) && (
                          <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2">
                            <path d="M1 4L3.5 6.5L9 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                        <p className="text-[10px] text-gray-400">{product.sku} · {product.unit} · {formatAed(product.sellingPrice)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(filteredGroups).length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">No products match your search</p>
            )}
          </div>
        </div>

        {/* Selected Items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">
            Selected Items
            {selectedLines.length > 0 && (
              <span className="ml-2 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {selectedLines.length}
              </span>
            )}
          </h2>
          {selectedLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <ShoppingCart className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No items selected</p>
              <p className="text-xs">Click products on the left to add them</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {selectedLines.map((line) => (
                <div key={line.product.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{line.product.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {formatAed(line.product.sellingPrice)} / {line.product.unit} · {formatAed(lineValue(line.quantity, line.product.sellingPrice))}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQty(line.product.id, -1)}
                      className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => setQty(line.product.id, Number(e.target.value))}
                      className="w-12 text-center text-sm border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <button
                      onClick={() => updateQty(line.product.id, 1)}
                      className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => toggleProduct(line.product)}
                      className="w-6 h-6 rounded text-red-400 hover:bg-red-50 flex items-center justify-center ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500">Estimated request value</p>
          <p className="text-lg font-bold text-gray-900">{formatAed(estimatedTotal)}</p>
          <p className="text-[11px] text-gray-400">Prices are saved with this request and stay fixed if the catalog changes later.</p>
        </div>
      </div>

      {/* Submit */}
      <div className="mt-5 flex gap-3">
        <Link
          href="/g/salesperson"
          className="flex-1 text-center py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <ShoppingCart className="w-4 h-4" />
          {isPending ? "Submitting…" : requestId ? "Resubmit for Approval" : "Submit Request"}
        </button>
      </div>
    </div>
  );
}
