"use client";

import { useState, useTransition } from "react";
import { Search, Plus, Minus, Trash2, TruckIcon, ArrowLeft, AlertTriangle } from "lucide-react";
import { createReplenishmentRequest } from "@/lib/gardenia/actions";
import Link from "next/link";

interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  categoryName: string;
  branchQty: number;
  warehouseQty: number;
  minLevel: number;
  isLow: boolean;
}

interface SelectedLine { product: Product; quantity: number; }

export function NewReplenishmentForm({
  actorName, branchName, products, requestNumber,
}: {
  actorName: string;
  branchName: string;
  products: Product[];
  requestNumber: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedLines, setSelectedLines] = useState<SelectedLine[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (!showLowOnly || p.isLow);
  });

  const grouped = filtered.reduce<Record<string, Product[]>>((acc, p) => {
    if (!acc[p.categoryName]) acc[p.categoryName] = [];
    acc[p.categoryName].push(p);
    return acc;
  }, {});

  function isSelected(id: string) { return selectedLines.some((l) => l.product.id === id); }

  function toggle(product: Product) {
    if (isSelected(product.id)) {
      setSelectedLines((prev) => prev.filter((l) => l.product.id !== product.id));
    } else {
      const suggestedQty = Math.max(1, product.minLevel - product.branchQty + product.minLevel);
      setSelectedLines((prev) => [...prev, { product, quantity: suggestedQty }]);
    }
  }

  function updateQty(id: string, delta: number) {
    setSelectedLines((prev) =>
      prev.map((l) => l.product.id === id ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)
    );
  }

  async function handleSubmit() {
    if (selectedLines.length === 0) { setError("Please select at least one product."); return; }
    setError(null);
    const fd = new FormData();
    fd.append("notes", notes);
    fd.append("lines", JSON.stringify(selectedLines.map((l) => ({ productId: l.product.id, requestedQty: l.quantity }))));

    startTransition(async () => {
      const result = await createReplenishmentRequest(fd);
      if (result?.error) setError(result.error);
    });
  }

  const lowCount = products.filter((p) => p.isLow).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/g/storekeeper/replenishment" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Replenishment Request</h1>
          <p className="text-sm text-gray-500">{requestNumber}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-4">Request Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium text-gray-500">Requested By</label><p className="text-sm font-medium text-gray-900 mt-0.5">{actorName}</p></div>
          <div><label className="text-xs font-medium text-gray-500">Branch</label><p className="text-sm font-medium text-gray-900 mt-0.5">{branchName}</p></div>
          <div><label className="text-xs font-medium text-gray-500">Date</label><p className="text-sm font-medium text-gray-900 mt-0.5">{new Date().toLocaleDateString()}</p></div>
          <div><label className="text-xs font-medium text-gray-500">Request #</label><p className="text-sm font-mono font-medium text-gray-900 mt-0.5">{requestNumber}</p></div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Reason for replenishment…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Select Products to Request</h2>
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            {lowCount > 0 && (
              <button
                onClick={() => setShowLowOnly((v) => !v)}
                className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${showLowOnly ? "bg-orange-100 text-orange-700 border-orange-300" : "bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100"}`}
              >
                <AlertTriangle className="w-3 h-3" /> Low ({lowCount})
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto space-y-3">
            {Object.entries(grouped).map(([cat, prods]) => (
              <div key={cat}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">{cat}</p>
                <div className="space-y-1">
                  {prods.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => toggle(product)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${isSelected(product.id) ? "bg-green-50 border border-green-300" : "bg-gray-50 hover:bg-gray-100 border border-transparent"}`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected(product.id) ? "border-green-500 bg-green-500" : "border-gray-300"}`}>
                        {isSelected(product.id) && <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2"><path d="M1 4L3.5 6.5L9 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {product.isLow && <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0" />}
                          <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                        </div>
                        <p className="text-[10px] text-gray-400">Branch: {product.branchQty} · WH: {product.warehouseQty} {product.unit}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Requested Items {selectedLines.length > 0 && <span className="ml-1 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">{selectedLines.length}</span>}</h2>
          {selectedLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <TruckIcon className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No items selected</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {selectedLines.map((line) => (
                <div key={line.product.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{line.product.name}</p>
                    <p className="text-[10px] text-gray-400">{line.product.unit} · Branch: {line.product.branchQty}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(line.product.id, -1)} className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                    <span className="w-10 text-center text-sm font-medium">{line.quantity}</span>
                    <button onClick={() => updateQty(line.product.id, 1)} className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                    <button onClick={() => toggle(line.product)} className="w-6 h-6 rounded text-red-400 hover:bg-red-50 flex items-center justify-center ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <Link href="/g/storekeeper/replenishment" className="flex-1 text-center py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</Link>
        <button onClick={handleSubmit} disabled={isPending} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
          <TruckIcon className="w-4 h-4" />
          {isPending ? "Submitting…" : "Submit Replenishment Request"}
        </button>
      </div>
    </div>
  );
}
