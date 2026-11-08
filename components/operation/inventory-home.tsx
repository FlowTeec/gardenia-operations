"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AlertList } from "@/components/operation/dashboard";
import { InventoryManager } from "@/components/store/inventory-manager";
import { useServerData } from "@/components/use-server-data";
import { getOperationHome } from "@/lib/workspace/actions";

export type InventoryTab = "materials" | "stock";

export function OperationInventory({ initialTab = "materials" }: { initialTab?: InventoryTab }) {
  const page = useServerData(getOperationHome);
  const router = useRouter();
  const [tab, setTab] = useState<InventoryTab>(initialTab);
  const [source, setSource] = useState(initialTab);
  if (source !== initialTab) {
    setSource(initialTab);
    setTab(initialTab);
  }

  function select(next: InventoryTab) {
    setTab(next);
    router.replace(next === "materials" ? "/operation-manager/inventory" : "/operation-manager/inventory?tab=stock", { scroll: false });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Inventory views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "materials"}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${tab === "materials" ? "bg-foreground text-background" : "bg-background"}`}
          onClick={() => select("materials")}
        >
          Material list
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "stock"}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${tab === "stock" ? "bg-foreground text-background" : "bg-background"}`}
          onClick={() => select("stock")}
        >
          Stock overview
          <span className="ml-2 tabular-nums">{page.data?.alerts.length ?? 0}</span>
        </button>
      </div>
      {tab === "materials" ? <InventoryManager access="operations" /> : null}
      {tab === "stock" ? (
        <div className="flex flex-col gap-3">
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Available stock is the current balance. Nothing is committed or reserved when a
            request is approved. Open a material from the list to read its transaction history.
          </p>
          {page.status === "loading" && !page.data ? <p className="text-sm text-muted-foreground">Loading stock…</p> : null}
          <AlertList alerts={page.data?.alerts ?? []} />
        </div>
      ) : null}
    </div>
  );
}
