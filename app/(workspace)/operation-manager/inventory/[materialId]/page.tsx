import type { Metadata } from "next";

import { MaterialHistory } from "@/components/store/material-history";

export const metadata: Metadata = { title: "Material history" };

export default async function OperationMaterialPage({
  params,
}: {
  params: Promise<{ materialId: string }>;
}) {
  const { materialId } = await params;
  return <MaterialHistory materialId={materialId} access="operations" />;
}
