import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OperationDashboard } from "@/components/operation/dashboard";

export const metadata: Metadata = { title: "Operation manager" };
export const instant = false;

const legacyTabs: Record<string, string> = {
  pending: "/operation-manager/requests",
  approved: "/operation-manager/requests?tab=approved",
  rejected: "/operation-manager/requests?tab=rejected",
  history: "/operation-manager/requests?tab=history",
  issued: "/operation-manager/requests?tab=history",
  zones: "/operation-manager/zones",
  stock: "/operation-manager/inventory?tab=stock",
};

export default async function OperationManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  if (tab && legacyTabs[tab]) redirect(legacyTabs[tab]);
  return <OperationDashboard />;
}
