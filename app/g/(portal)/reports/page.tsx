export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { ReportsClient } from "@/components/gardenia/reports-client";

export const metadata: Metadata = { title: "Reports & Analytics" };

export default async function ReportsPage() {
  const actor = await requireActor(["management", "warehouse_manager", "branch_manager"]);
  const ws = await readWorkspace();

  const reportData = {
    salesRequests: ws.salesRequests.map((r) => ({
      ...r,
      branchName: ws.branches.find((b) => b.id === r.branchId)?.name ?? r.branchId,
      salespersonName: ws.users.find((u) => u.id === r.salespersonId)?.name ?? r.salespersonId,
      approvedByName: ws.users.find((u) => u.id === r.approvedBy)?.name ?? null,
      issuedByName: ws.users.find((u) => u.id === r.issuedBy)?.name ?? null,
      lines: r.lines.map((l) => ({
        ...l,
        productName: ws.products.find((p) => p.id === l.productId)?.name ?? l.productId,
        unit: ws.products.find((p) => p.id === l.productId)?.unit ?? "",
      })),
    })),
    branches: ws.branches,
    products: ws.products,
    users: ws.users
      .filter((u) => u.role === "salesperson")
      .map((u) => ({ id: u.id, name: u.name })),
    actorBranchId: actor.branchId,
    actorRole: actor.role,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ReportsClient data={reportData} />
    </div>
  );
}
