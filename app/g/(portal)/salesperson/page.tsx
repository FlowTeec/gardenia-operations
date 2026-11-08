export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { StatCard } from "@/components/gardenia/stat-card";
import { StatusBadge } from "@/components/gardenia/status-badge";
import { PageHeader } from "@/components/gardenia/page-header";
import { ShoppingCart, CheckSquare, XCircle, Package, Undo2 } from "lucide-react";
import { formatAed, lineValue } from "@/lib/gardenia/money";
import Link from "next/link";

export const metadata: Metadata = { title: "Salesperson Dashboard" };

export default async function SalespersonDashboard() {
  const actor = await requireActor(["salesperson"]);
  const ws = await readWorkspace();

  const myRequests = ws.salesRequests
    .filter((r) => r.salespersonId === actor.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pending = myRequests.filter((r) => r.status === "pending").length;
  const approved = myRequests.filter((r) => r.status === "approved").length;
  const issued = myRequests.filter((r) => r.status === "issued" || r.status === "partially_issued").length;
  const rejected = myRequests.filter((r) => r.status === "rejected").length;
  const returned = myRequests.filter((r) => r.status === "returned").length;

  const branch = ws.branches.find((b) => b.id === actor.branchId);

  function getProductSummary(lines: { productId: string; requestedQty: number }[]) {
    const items = lines.slice(0, 2).map((l) => {
      const product = ws.products.find((p) => p.id === l.productId);
      return `${product?.name ?? "Unknown"} ×${l.requestedQty}`;
    });
    if (lines.length > 2) items.push(`+${lines.length - 2} more`);
    return items.join(", ");
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title={`Good day, ${actor.name.split(" ")[0]}`}
        subtitle={branch?.name ?? "Salesperson Dashboard"}
        action={
          <Link
            href="/g/salesperson/new-request"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            New Material Request
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Pending" value={pending} icon={<ShoppingCart className="w-5 h-5 text-yellow-600" />} iconBg="bg-yellow-100" alert={pending > 0} />
        <StatCard title="Approved" value={approved} icon={<CheckSquare className="w-5 h-5 text-green-600" />} iconBg="bg-green-100" />
        <StatCard title="Issued" value={issued} icon={<Package className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-100" />
        <StatCard title="Returned" value={returned} icon={<Undo2 className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-100" alert={returned > 0} />
        <StatCard title="Rejected" value={rejected} icon={<XCircle className="w-5 h-5 text-red-600" />} iconBg="bg-red-100" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">My Material Requests</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {myRequests.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No requests yet</p>
              <p className="text-gray-400 text-sm mt-1">Create your first material request to get started</p>
              <Link href="/g/salesperson/new-request" className="mt-4 inline-flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700">
                <ShoppingCart className="w-4 h-4" /> New Request
              </Link>
            </div>
          ) : (
            myRequests.map((req) => {
              const value = req.lines.reduce((sum, line) => sum + lineValue(line.requestedQty, line.unitPrice ?? 0), 0);
              return (
              <Link key={req.id} href={`/g/requests/${req.id}`} className="block px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-gray-700">{req.requestNumber}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-1">{req.customerName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{getProductSummary(req.lines)}</p>
                    {req.approvalNotes && (
                      <p className="text-xs text-gray-500 mt-1 italic">{req.status === "rejected" ? "Rejected" : "Note"}: {req.approvalNotes}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{formatAed(value)}</p>
                    <p className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">{req.lines.length} item{req.lines.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
