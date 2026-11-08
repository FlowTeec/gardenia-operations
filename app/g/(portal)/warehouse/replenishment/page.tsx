export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { WarehouseReplenishmentClient } from "@/components/gardenia/warehouse-replenishment-client";

export const metadata: Metadata = { title: "Replenishment Management" };

export default async function WarehouseReplenishmentPage() {
  await requireActor(["warehouse_manager"]);
  const ws = await readWorkspace();

  const requests = ws.replenishmentRequests
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const enriched = requests.map((req) => ({
    ...req,
    branchName: ws.branches.find((b) => b.id === req.branchId)?.name ?? req.branchId,
    storekeeperName: ws.users.find((u) => u.id === req.storekeeperIdRequesting)?.name ?? req.storekeeperIdRequesting,
    approvedByName: ws.users.find((u) => u.id === req.approvedBy)?.name ?? null,
    lines: req.lines.map((l) => {
      const product = ws.products.find((p) => p.id === l.productId);
      const warehouseBal = ws.inventoryBalances.find(
        (b) => b.productId === l.productId && b.locationId === "warehouse"
      );
      return {
        ...l,
        productName: product?.name ?? l.productId,
        unit: product?.unit ?? "",
        warehouseQty: warehouseBal?.quantity ?? 0,
      };
    }),
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <WarehouseReplenishmentClient requests={enriched} />
    </div>
  );
}
