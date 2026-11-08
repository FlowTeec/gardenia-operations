import type { Metadata } from "next";

import { Approvals, type SupervisorTab } from "@/components/supervisor/approvals";

export const metadata: Metadata = { title: "Supervisor" };
export const instant = false;

const tabs: SupervisorTab[] = ["pending", "approved", "issued", "rejected"];

export default async function SupervisorPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = tabs.find((item) => item === tab) ?? "pending";
  return <Approvals initialTab={initialTab} />;
}
