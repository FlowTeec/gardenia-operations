import type { Metadata } from "next";

import { RequestDetail } from "@/components/store/request-detail";

export const metadata: Metadata = { title: "Request" };
export const instant = false;

export default async function StoreRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RequestDetail id={id} />;
}
