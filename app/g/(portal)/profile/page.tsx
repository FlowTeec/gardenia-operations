export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { PageHeader } from "@/components/gardenia/page-header";
import { User, Mail, Hash, Building2, Shield } from "lucide-react";

export const metadata: Metadata = { title: "My Profile" };

const roleLabels: Record<string, string> = {
  admin: "System Administrator",
  salesperson: "Salesperson",
  branch_manager: "Branch Manager",
  branch_storekeeper: "Branch Storekeeper",
  warehouse_manager: "Warehouse Manager",
  management: "Management",
};

export default async function ProfilePage() {
  const actor = await requireActor();
  const ws = await readWorkspace();
  const branch = actor.branchId ? ws.branches.find((b) => b.id === actor.branchId) : null;

  const myActivity = ws.salesRequests.filter(
    (r) => r.salespersonId === actor.id || r.issuedBy === actor.id || r.approvedBy === actor.id
  ).length;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="My Profile" />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#1a2e1a] to-[#2d4a2d] px-6 py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-400 flex items-center justify-center mx-auto mb-3 text-2xl font-bold text-white">
            {actor.name.charAt(0)}
          </div>
          <h2 className="text-xl font-bold text-white">{actor.name}</h2>
          <p className="text-green-300 text-sm mt-1">{roleLabels[actor.role] ?? actor.role}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <div className="bg-gray-100 p-2 rounded-lg"><Hash className="w-4 h-4 text-gray-500" /></div>
            <div>
              <p className="text-xs text-gray-500">Employee ID</p>
              <p className="font-medium text-gray-900">{actor.employeeId}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <div className="bg-gray-100 p-2 rounded-lg"><Mail className="w-4 h-4 text-gray-500" /></div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{actor.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <div className="bg-gray-100 p-2 rounded-lg"><Shield className="w-4 h-4 text-gray-500" /></div>
            <div>
              <p className="text-xs text-gray-500">Role</p>
              <p className="font-medium text-gray-900">{roleLabels[actor.role] ?? actor.role}</p>
            </div>
          </div>

          {branch && (
            <div className="flex items-center gap-3 py-3 border-b border-gray-100">
              <div className="bg-gray-100 p-2 rounded-lg"><Building2 className="w-4 h-4 text-gray-500" /></div>
              <div>
                <p className="text-xs text-gray-500">Assigned Branch</p>
                <p className="font-medium text-gray-900">{branch.name}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 py-3">
            <div className="bg-gray-100 p-2 rounded-lg"><User className="w-4 h-4 text-gray-500" /></div>
            <div>
              <p className="text-xs text-gray-500">Account Status</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Activity Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{myActivity}</p>
            <p className="text-xs text-gray-500 mt-0.5">Transactions Involved</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {new Date(actor.createdAt).toLocaleDateString()}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Account Created</p>
          </div>
        </div>
      </div>
    </div>
  );
}
