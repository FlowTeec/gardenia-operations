import type { Metadata } from "next";

import { RequestReview } from "@/components/supervisor/request-review";

export const metadata: Metadata = { title: "Request review" };
export const instant = false;

export default async function SupervisorRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RequestReview id={id} />;
}
