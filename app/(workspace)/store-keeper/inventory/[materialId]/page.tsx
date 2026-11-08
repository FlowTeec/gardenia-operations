import type { Metadata } from "next";

import { MaterialHistory } from "@/components/store/material-history";

export const metadata: Metadata = { title: "Material history" };
export const instant = false;

export default async function MaterialHistoryPage({
  params,
}: {
  params: Promise<{ materialId: string }>;
}) {
  const { materialId } = await params;
  return <MaterialHistory materialId={materialId} />;
}
