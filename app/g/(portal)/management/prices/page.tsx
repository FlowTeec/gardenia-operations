export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { PageHeader } from "@/components/gardenia/page-header";
import { PriceListClient } from "@/components/gardenia/price-list-client";

export const metadata: Metadata = { title: "Selling Prices" };

export default async function ManagementPricesPage() {
  await requireActor(["management"]);
  const ws = await readWorkspace();
  const products = ws.products.map((product) => ({
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
        title="Selling prices"
        subtitle="Price changes apply to new requests only. Confirmed requests and issue tickets keep the price they were submitted with."
      />
      <PriceListClient products={products} canEdit />
    </div>
  );
}
