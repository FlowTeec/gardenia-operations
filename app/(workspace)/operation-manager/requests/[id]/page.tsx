import type { Metadata } from "next";

import { OperationReview } from "@/components/operation/request-review";

export const metadata: Metadata = { title: "Operation review" };
export const instant = false;

export default async function OperationRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OperationReview id={id} />;
}
