export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { StatCard } from "@/components/gardenia/stat-card";
import { PageHeader } from "@/components/gardenia/page-header";
import {
  Users,
  GitBranch,
  ShieldCheck,
  UserCheck,
  UserX,
  Building2,
  Package,
  Tag,
} from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "System Administration" };

const roleLabels: Record<string, string> = {
  salesperson: "Salesperson",
  branch_manager: "Branch Manager",
  branch_storekeeper: "Branch Storekeeper",
  warehouse_manager: "Warehouse Manager",
  management: "Management",
  admin: "System Administrator",
};

export default async function AdminDashboard() {
  await requireActor(["admin"]);
  const ws = await readWorkspace();

  const totalUsers = ws.users.length;
  const activeUsers = ws.users.filter((u) => u.active).length;
  const inactiveUsers = totalUsers - activeUsers;
  const activeBranches = ws.branches.filter((b) => b.active).length;
  const inactiveBranches = ws.branches.filter((b) => !b.active).length;
  const activeProducts = ws.products.filter((p) => p.active).length;

  // Users per role
  const roleCounts = ws.users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  // Users per branch
  const branchUserCounts = ws.branches.map((branch) => {
    const assigned = ws.users.filter((u) => u.branchId === branch.id);
    return { branch, count: assigned.length, active: assigned.filter((u) => u.active).length };
  });

  // Unassigned users (no branch – warehouse manager, management, admin)
  const unassigned = ws.users.filter((u) => !u.branchId);

  // Recently created users (last 5)
  const recentUsers = [...ws.users]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="System Administration"
        subtitle="Manage users, branches, roles, and system access for Gardenia Pest Control"
        action={
          <div className="flex gap-2">
            <Link
              href="/g/admin/users"
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium text-gray-700 transition-colors"
            >
              Manage Users
            </Link>
            <Link
              href="/g/admin/branches"
              className="text-sm px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
            >
              Manage Branches
            </Link>
          </div>
        }
      />

      {/* System Structure KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Employees"
          value={totalUsers}
          icon={<Users className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-100"
        />
        <StatCard
          title="Active Accounts"
          value={activeUsers}
          icon={<UserCheck className="w-5 h-5 text-green-600" />}
          iconBg="bg-green-100"
        />
        <StatCard
          title="Inactive Accounts"
          value={inactiveUsers}
          icon={<UserX className="w-5 h-5 text-gray-500" />}
          iconBg="bg-gray-100"
          alert={inactiveUsers > 0}
        />
        <StatCard
          title="Active Branches"
          value={activeBranches}
          icon={<GitBranch className="w-5 h-5 text-purple-600" />}
          iconBg="bg-purple-100"
        />
        <StatCard
          title="Inactive Branches"
          value={inactiveBranches}
          icon={<Building2 className="w-5 h-5 text-gray-500" />}
          iconBg="bg-gray-100"
        />
        <StatCard
          title="Registered Roles"
          value={Object.keys(roleCounts).length}
          icon={<ShieldCheck className="w-5 h-5 text-indigo-600" />}
          iconBg="bg-indigo-100"
        />
        <StatCard
          title="Active Products"
          value={activeProducts}
          subtitle="in product catalog"
          icon={<Package className="w-5 h-5 text-teal-600" />}
          iconBg="bg-teal-100"
        />
        <StatCard
          title="Product Categories"
          value={ws.productCategories.filter((c) => c.active).length}
          icon={<Tag className="w-5 h-5 text-orange-600" />}
          iconBg="bg-orange-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Role Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            Role Distribution
          </h2>
          <div className="space-y-2">
            {Object.entries(roleCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([role, count]) => (
                <div key={role} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">{roleLabels[role] ?? role}</span>
                  <span className="text-sm font-semibold text-gray-900 bg-gray-100 rounded-full px-2.5 py-0.5">
                    {count}
                  </span>
                </div>
              ))}
          </div>
          <Link
            href="/g/admin/users"
            className="mt-4 block text-center text-xs text-green-600 hover:text-green-700 font-medium"
          >
            View all users →
          </Link>
        </div>

        {/* Branch Staffing */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-500" />
            Branch Staffing
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 pb-2">Branch</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-2">Total Staff</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-2">Active</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {branchUserCounts.map(({ branch, count, active }) => (
                  <tr key={branch.id}>
                    <td className="py-2.5 font-medium text-gray-900">{branch.name}</td>
                    <td className="py-2.5 text-right text-gray-600">{count}</td>
                    <td className="py-2.5 text-right text-gray-600">{active}</td>
                    <td className="py-2.5 text-right">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${branch.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {branch.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50/50">
                  <td className="py-2.5 font-medium text-gray-500 italic">Central Warehouse / HQ</td>
                  <td className="py-2.5 text-right text-gray-500">{unassigned.length}</td>
                  <td className="py-2.5 text-right text-gray-500">{unassigned.filter((u) => u.active).length}</td>
                  <td className="py-2.5 text-right">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">HQ</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <Link
            href="/g/admin/branches"
            className="mt-4 block text-center text-xs text-green-600 hover:text-green-700 font-medium"
          >
            Manage branches →
          </Link>
        </div>
      </div>

      {/* Recently Added Users */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            Recently Added Employees
          </h2>
          <Link href="/g/admin/users" className="text-xs text-green-600 hover:text-green-700 font-medium">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 pb-2">Employee</th>
                <th className="text-left text-xs font-medium text-gray-500 pb-2">ID</th>
                <th className="text-left text-xs font-medium text-gray-500 pb-2">Role</th>
                <th className="text-left text-xs font-medium text-gray-500 pb-2">Branch</th>
                <th className="text-right text-xs font-medium text-gray-500 pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentUsers.map((user) => {
                const branch = user.branchId ? ws.branches.find((b) => b.id === user.branchId) : null;
                return (
                  <tr key={user.id}>
                    <td className="py-2.5 font-medium text-gray-900">{user.name}</td>
                    <td className="py-2.5 text-gray-500 font-mono text-xs">{user.employeeId}</td>
                    <td className="py-2.5 text-gray-600">{roleLabels[user.role] ?? user.role}</td>
                    <td className="py-2.5 text-gray-500">{branch?.name ?? "—"}</td>
                    <td className="py-2.5 text-right">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${user.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {user.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
