export const instant = false;
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { NewSalesRequestForm } from "@/components/gardenia/new-sales-request-form";

export const metadata: Metadata = { title: "Update Material Request" };

export default async function EditSalesRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(["salesperson"]);
  const ws = await readWorkspace();
  const request = ws.salesRequests.find((item) => item.id === id);
  if (!request || request.salespersonId !== actor.id || request.status !== "returned") notFound();

  const branch = ws.branches.find((item) => item.id === actor.branchId);
  const products = ws.products
    .filter((product) => product.active)
    .map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      categoryName: ws.productCategories.find((category) => category.id === product.categoryId)?.name ?? "Other",
      sellingPrice: product.sellingPrice,
    }));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <NewSalesRequestForm
        actorName={actor.name}
        branchName={branch?.name ?? "Unknown Branch"}
        products={products}
        requestNumber={request.requestNumber}
        requestId={request.id}
        initialCustomer={request.customerName}
        initialNotes={request.notes ?? ""}
        initialLines={request.lines.map((line) => ({ productId: line.productId, quantity: line.requestedQty }))}
      />
    </div>
  );
}
