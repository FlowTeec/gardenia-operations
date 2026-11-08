export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { NewSalesRequestForm } from "@/components/gardenia/new-sales-request-form";

export const metadata: Metadata = { title: "New Material Request" };

export default async function NewSalesRequestPage() {
  const actor = await requireActor(["salesperson"]);
  const ws = await readWorkspace();

  const branch = ws.branches.find((b) => b.id === actor.branchId);
  const activeProducts = ws.products
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      categoryName: ws.productCategories.find((c) => c.id === p.categoryId)?.name ?? "Other",
      sellingPrice: p.sellingPrice,
    }));

  const nextNumber = `SR-${new Date().getFullYear()}-${String(ws.counters.salesRequest + 1).padStart(4, "0")}`;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <NewSalesRequestForm
        actorName={actor.name}
        branchName={branch?.name ?? "Unknown Branch"}
        products={activeProducts}
        requestNumber={nextNumber}
      />
    </div>
  );
}
