export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { ProductManagementClient } from "@/components/gardenia/product-management-client";

export const metadata: Metadata = { title: "Products Management" };

export default async function ProductsManagementPage() {
  await requireActor(["admin"]);
  const ws = await readWorkspace();

  const products = ws.products.map((p) => ({
    ...p,
    categoryName: ws.productCategories.find((c) => c.id === p.categoryId)?.name ?? "Uncategorized",
    warehouseQty: ws.inventoryBalances.find((b) => b.productId === p.id && b.locationId === "warehouse")?.quantity ?? 0,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ProductManagementClient products={products} categories={ws.productCategories} />
    </div>
  );
}
