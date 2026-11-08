export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { NewReplenishmentForm } from "@/components/gardenia/new-replenishment-form";

export const metadata: Metadata = { title: "New Replenishment Request" };

export default async function NewReplenishmentPage() {
  const actor = await requireActor(["branch_storekeeper"]);
  const ws = await readWorkspace();

  const activeProducts = ws.products
    .filter((p) => p.active)
    .map((p) => {
      const branchBal = ws.inventoryBalances.find(
        (b) => b.productId === p.id && b.locationId === actor.branchId
      );
      const warehouseBal = ws.inventoryBalances.find(
        (b) => b.productId === p.id && b.locationId === "warehouse"
      );
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        categoryName: ws.productCategories.find((c) => c.id === p.categoryId)?.name ?? "Other",
        branchQty: branchBal?.quantity ?? 0,
        warehouseQty: warehouseBal?.quantity ?? 0,
        minLevel: p.minStockLevel,
        isLow: (branchBal?.quantity ?? 0) <= p.minStockLevel,
      };
    });

  const nextNumber = `RR-${new Date().getFullYear()}-${String(ws.counters.replenishment + 1).padStart(4, "0")}`;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <NewReplenishmentForm
        actorName={actor.name}
        branchName={ws.branches.find((b) => b.id === actor.branchId)?.name ?? ""}
        products={activeProducts}
        requestNumber={nextNumber}
      />
    </div>
  );
}
