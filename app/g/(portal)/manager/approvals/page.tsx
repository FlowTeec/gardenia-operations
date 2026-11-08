export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { ApprovalCenterClient } from "@/components/gardenia/approval-center-client";

export const metadata: Metadata = { title: "Approval Center" };

export default async function ApprovalCenterPage() {
  const actor = await requireActor(["branch_manager"]);
  const ws = await readWorkspace();

  const pendingRequests = ws.salesRequests
    .filter((r) => r.branchId === actor.branchId && r.status === "pending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const enriched = pendingRequests.map((req) => ({
    ...req,
    salespersonName: ws.users.find((u) => u.id === req.salespersonId)?.name ?? req.salespersonId,
    branchName: ws.branches.find((b) => b.id === req.branchId)?.name ?? req.branchId,
    lines: req.lines.map((l) => ({
      ...l,
      productName: ws.products.find((p) => p.id === l.productId)?.name ?? l.productId,
      productSku: ws.products.find((p) => p.id === l.productId)?.sku ?? "",
      unit: ws.products.find((p) => p.id === l.productId)?.unit ?? "",
    })),
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ApprovalCenterClient requests={enriched} />
    </div>
  );
}
