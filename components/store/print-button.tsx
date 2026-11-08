"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    window.print();
  }, []);
  return null;
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      Print
    </button>
  );
}
