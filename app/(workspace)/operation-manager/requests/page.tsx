import type { Metadata } from "next";

import { OperationRequests, type RequestTab } from "@/components/operation/requests-home";

export const metadata: Metadata = { title: "Requests" };

const tabs: RequestTab[] = ["pending", "approved", "rejected", "progress", "history"];

export default async function OperationRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = tabs.find((item) => item === tab) ?? "pending";
  return <OperationRequests initialTab={initialTab} />;
}
