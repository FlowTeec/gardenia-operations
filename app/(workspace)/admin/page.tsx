import type { Metadata } from "next";

import { AdminHome } from "@/components/admin/admin-home";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminPage() {
  return <AdminHome />;
}