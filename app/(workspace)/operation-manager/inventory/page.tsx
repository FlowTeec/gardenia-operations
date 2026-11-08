import type { Metadata } from "next";

import { OperationInventory, type InventoryTab } from "@/components/operation/inventory-home";

export const metadata: Metadata = { title: "Inventory" };

export default async function OperationInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab: InventoryTab = tab === "stock" ? "stock" : "materials";
  return <OperationInventory initialTab={initialTab} />;
}
