import type { Metadata } from "next";

import { AdminHome } from "@/components/admin/admin-home";

export const metadata: Metadata = { title: "Supervisor and team assignment" };

export default function AssignmentsPage() {
  return <AdminHome />;
}
