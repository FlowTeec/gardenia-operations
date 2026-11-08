import type { Metadata } from "next";

import { AdminHome } from "@/components/admin/admin-home";

export const metadata: Metadata = { title: "Employee Management" };

export default function EmployeesPage() {
  return <AdminHome />;
}
