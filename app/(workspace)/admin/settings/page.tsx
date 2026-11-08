import type { Metadata } from "next";

import { AdminHome } from "@/components/admin/admin-home";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return <AdminHome />;
}
