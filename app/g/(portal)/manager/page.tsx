export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { StatCard } from "@/components/gardenia/stat-card";
import { StatusBadge } from "@/components/gardenia/status-badge";
import { PageHeader } from "@/components/gardenia/page-header";
import { CheckSquare, Clock, XCircle, Package } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Branch Manager Dashboard" };

export default async function BranchManagerDashboard() {
  const actor = await requireActor(["branch_manager"]);
  const ws = await readWorkspace();

  const branchRequests = ws.salesRequests
    .filter((r) => r.branchId === actor.branchId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pending = branchRequests.filter((r) => r.status === "pending").length;
  const approved = branchRequests.filter((r) => r.status === "approved").length;
  const issued = branchRequests.filter((r) => r.status === "issued" || r.status === "partially_issued").length;
  const rejected = branchRequests.filter((r) => r.status === "rejected").length;

  const branch = ws.branches.find((b) => b.id === actor.branchId);

  function getUserName(userId: string | null) {
    if (!userId) return "—";
    return ws.users.find((u) => u.id === userId)?.name ?? userId;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Branch Manager Dashboard"
        subtitle={branch?.name ?? ""}
        action={
          <Link
            href="/g/manager/approvals"
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              pending > 0
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Approval Center
            {pending > 0 && (
              <span className="bg-white text-orange-500 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pending}
              </span>
            )}
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Pending Approval" value={pending} icon={<Clock className="w-5 h-5 text-yellow-600" />} iconBg="bg-yellow-100" alert={pending > 0} />
        <StatCard title="Approved" value={approved} icon={<CheckSquare className="w-5 h-5 text-green-600" />} iconBg="bg-green-100" />
        <StatCard title="Issued" value={issued} icon={<Package className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-100" />
        <StatCard title="Rejected" value={rejected} icon={<XCircle className="w-5 h-5 text-red-600" />} iconBg="bg-red-100" />
      </div>

      {/* Recent Requests */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Branch Material Requests</h2>
          <Link href="/g/manager/approvals" className="text-xs text-green-600 hover:text-green-700 font-medium">
            View pending →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {branchRequests.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400">No material requests yet.</div>
          ) : (
            branchRequests.slice(0, 10).map((req) => (
              <div key={req.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-gray-700">{req.requestNumber}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{req.customerName}</p>
                    <p className="text-xs text-gray-500">Salesperson: {getUserName(req.salespersonId)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{req.lines.length} item(s)</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleDateString()}</p>
                    {req.status === "pending" && (
                      <Link
                        href="/g/manager/approvals"
                        className="mt-1 inline-block text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium hover:bg-orange-200"
                      >
                        Review →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
