export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { PageHeader } from "@/components/gardenia/page-header";
import { StatusBadge } from "@/components/gardenia/status-badge";
import { UserManagementClient } from "@/components/gardenia/user-management-client";

export const metadata: Metadata = { title: "User Management" };

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  salesperson: "Salesperson",
  branch_manager: "Branch Manager",
  branch_storekeeper: "Branch Storekeeper",
  warehouse_manager: "Warehouse Manager",
  management: "Management",
};

export default async function UserManagementPage() {
  await requireActor(["admin"]);
  const ws = await readWorkspace();

  const users = ws.users.map(({ passwordHash: _drop, ...u }) => ({
    ...u,
    branchName: u.branchId ? ws.branches.find((b) => b.id === u.branchId)?.name ?? u.branchId : null,
    roleLabel: roleLabels[u.role] ?? u.role,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <UserManagementClient
        users={users}
        branches={ws.branches}
      />
    </div>
  );
}
