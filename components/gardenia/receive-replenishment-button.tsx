"use client";

import { useState, useTransition } from "react";
import { CheckCircle } from "lucide-react";
import { receiveReplenishment } from "@/lib/gardenia/actions";

interface ReceiveLine {
  productId: string;
  productName: string;
  unit: string;
  dispatchedQty: number;
}

export function ReceiveReplenishmentButton({
  requestId,
  requestNumber,
  lines,
}: {
  requestId: string;
  requestNumber: string;
  lines: ReceiveLine[];
}) {
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>(
    Object.fromEntries(lines.map((l) => [l.productId, l.dispatchedQty]))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleReceive() {
    setError(null);
    const receivedLines = lines.map((l) => ({
      productId: l.productId,
      receivedQty: receivedQtys[l.productId] ?? l.dispatchedQty,
    }));

    startTransition(async () => {
      const result = await receiveReplenishment(requestId, receivedLines);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="bg-green-50 rounded-lg border border-green-200 p-4">
      <p className="text-sm font-semibold text-green-800 mb-3">Confirm Receipt – {requestNumber}</p>

      {error && (
        <div className="mb-3 bg-red-50 text-red-700 border border-red-200 rounded px-3 py-2 text-xs">
          {error}
        </div>
      )}

      <div className="space-y-2 mb-4">
        {lines.map((line) => (
          <div key={line.productId} className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{line.productName}</p>
              <p className="text-[10px] text-gray-400">Dispatched: {line.dispatchedQty} {line.unit}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <label className="text-xs text-gray-500">Received:</label>
              <input
                type="number"
                min={0}
                max={line.dispatchedQty}
                value={receivedQtys[line.productId] ?? line.dispatchedQty}
                onChange={(e) =>
                  setReceivedQtys((prev) => ({
                    ...prev,
                    [line.productId]: Math.max(0, Number(e.target.value)),
                  }))
                }
                className="w-16 text-right border border-green-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleReceive}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
      >
        <CheckCircle className="w-4 h-4" />
        {isPending ? "Confirming…" : "Confirm Receipt & Update Inventory"}
      </button>
    </div>
  );
}
