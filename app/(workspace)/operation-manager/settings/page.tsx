import type { Metadata } from "next";

import { OperationSettings } from "@/components/operation/settings-page";

export const metadata: Metadata = { title: "Settings" };

export default function OperationSettingsPage() {
  return <OperationSettings />;
}