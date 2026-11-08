export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { PageHeader } from "@/components/gardenia/page-header";
import { PriceListClient } from "@/components/gardenia/price-list-client";

export const metadata: Metadata = { title: "Price List" };

export default async function SalespersonCatalogPage() {
  await requireActor(["salesperson"]);
  const ws = await readWorkspace();
  const products = ws.products
    .filter((product) => product.active)
    .map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      categoryName: ws.productCategories.find((category) => category.id === product.categoryId)?.name ?? "Other",
      sellingPrice: product.sellingPrice,
      active: product.active,
    }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Product price list"
        subtitle="Current selling prices for active pest-control materials. A request keeps the price from the moment it is submitted."
      />
      <PriceListClient products={products} canEdit={false} />
    </div>
  );
}
