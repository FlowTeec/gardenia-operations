export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { IssueQueueClient } from "@/components/gardenia/issue-queue-client";

export const metadata: Metadata = { title: "Issue Queue" };

export default async function IssueQueuePage() {
  const actor = await requireActor(["branch_storekeeper"]);
  const ws = await readWorkspace();

  const approvedRequests = ws.salesRequests
    .filter((r) => r.branchId === actor.branchId && r.status === "approved")
    .sort((a, b) => new Date(b.approvedAt ?? b.createdAt).getTime() - new Date(a.approvedAt ?? a.createdAt).getTime());

  const enriched = approvedRequests.map((req) => ({
    ...req,
    salespersonName: ws.users.find((u) => u.id === req.salespersonId)?.name ?? req.salespersonId,
    approvedByName: ws.users.find((u) => u.id === req.approvedBy)?.name ?? null,
    lines: req.lines.map((l) => {
      const product = ws.products.find((p) => p.id === l.productId);
      const balance = ws.inventoryBalances.find(
        (b) => b.productId === l.productId && b.locationId === actor.branchId
      );
      return {
        ...l,
        productName: product?.name ?? l.productId,
        productSku: product?.sku ?? "",
        unit: product?.unit ?? "",
        availableQty: balance?.quantity ?? 0,
      };
    }),
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <IssueQueueClient requests={enriched} />
    </div>
  );
}
