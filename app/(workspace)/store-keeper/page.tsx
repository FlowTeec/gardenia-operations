import type { Metadata } from "next";

import { StoreDashboard } from "@/components/store/store-dashboard";

export const metadata: Metadata = { title: "Store keeper" };

export default function StoreKeeperPage() {
  return <StoreDashboard />;
}
