export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { PageHeader } from "@/components/gardenia/page-header";
import { GitBranch, Package } from "lucide-react";

export const metadata: Metadata = { title: "Branches Management" };

export default async function BranchesManagementPage() {
  await requireActor(["admin"]);
  const ws = await readWorkspace();

  const branchData = ws.branches.map((branch) => {
    const users = ws.users.filter((u) => u.branchId === branch.id);
    return {
      branch,
      users,
      activeUsers: users.filter((u) => u.active).length,
      managers: users.filter((u) => u.role === "branch_manager"),
      storekeepers: users.filter((u) => u.role === "branch_storekeeper"),
      salespersons: users.filter((u) => u.role === "salesperson"),
    };
  });

  const warehouseManagers = ws.users.filter((u) => u.role === "warehouse_manager");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Branches & Warehouse" subtitle="Organizational structure, staffing, and access assignment" />

      {/* Central Warehouse Card */}
      <div className="bg-gradient-to-r from-[#1a2e1a] to-[#2d4a2d] rounded-xl p-5 mb-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-400/20 p-2.5 rounded-lg">
            <Package className="w-5 h-5 text-green-300" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Central Warehouse</h2>
            <p className="text-green-300 text-sm">Main distribution hub</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-green-300 text-xs">Warehouse managers</p>
            <p className="text-2xl font-bold">{warehouseManagers.length}</p>
            <p className="text-green-400 text-xs">{warehouseManagers.map((u) => u.name).join(", ") || "None assigned"}</p>
          </div>
          <div>
            <p className="text-green-300 text-xs">Catalog products</p>
            <p className="text-2xl font-bold">{ws.products.filter((p) => p.active).length}</p>
            <p className="text-green-400 text-xs">active in the product catalog</p>
          </div>
        </div>
      </div>

      {/* Branch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {branchData.map(({ branch, users, activeUsers, managers, storekeepers, salespersons }) => (
          <div key={branch.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-green-100 p-2 rounded-lg">
                  <GitBranch className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{branch.name}</h3>
                  <p className="text-xs text-gray-400">Code: {branch.code}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${branch.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {branch.active ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Assigned staff</p>
                <p className="text-lg font-bold text-gray-900">{users.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Active accounts</p>
                <p className="text-lg font-bold text-gray-900">{activeUsers}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              {managers.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium text-[10px]">MGR</span>
                  {managers.map((u) => u.name).join(", ")}
                </div>
              )}
              {storekeepers.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium text-[10px]">STK</span>
                  {storekeepers.map((u) => u.name).join(", ")}
                </div>
              )}
              {salespersons.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium text-[10px]">SLS</span>
                  {salespersons.map((u) => u.name).join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
