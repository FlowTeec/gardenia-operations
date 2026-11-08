export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { TransactionHistoryClient } from "@/components/gardenia/transaction-history-client";

export const metadata: Metadata = { title: "Transaction History" };

export default async function TransactionHistoryPage() {
  const actor = await requireActor(["management", "warehouse_manager", "branch_manager", "branch_storekeeper"]);
  const ws = await readWorkspace();

  // Filter by branch if branch role
  const salesRequests = ws.salesRequests
    .filter((r) => {
      if (actor.branchId) return r.branchId === actor.branchId;
      return true;
    })
    .map((r) => ({
      ...r,
      type: "sales" as const,
      branchName: ws.branches.find((b) => b.id === r.branchId)?.name ?? r.branchId,
      salespersonName: ws.users.find((u) => u.id === r.salespersonId)?.name ?? r.salespersonId,
      approvedByName: ws.users.find((u) => u.id === r.approvedBy)?.name ?? null,
      issuedByName: ws.users.find((u) => u.id === r.issuedBy)?.name ?? null,
    }));

  const replenishmentRequests = ws.replenishmentRequests
    .filter((r) => {
      if (actor.branchId) return r.branchId === actor.branchId;
      return true;
    })
    .map((r) => ({
      ...r,
      type: "replenishment" as const,
      branchName: ws.branches.find((b) => b.id === r.branchId)?.name ?? r.branchId,
      storekeeperName: ws.users.find((u) => u.id === r.storekeeperIdRequesting)?.name ?? r.storekeeperIdRequesting,
      approvedByName: ws.users.find((u) => u.id === r.approvedBy)?.name ?? null,
    }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <TransactionHistoryClient sales={salesRequests} replenishments={replenishmentRequests} products={ws.products} />
    </div>
  );
}
