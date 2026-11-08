import type { Metadata } from "next";

import { Approvals } from "@/components/supervisor/approvals";

export const metadata: Metadata = { title: "Material issue tickets" };

export default function SupervisorTicketsPage() {
  return <Approvals initialTab="issued" />;
}
