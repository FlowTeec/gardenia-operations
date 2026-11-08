import type { Metadata } from "next";

import { OperationReports } from "@/components/operation/reports-page";

export const metadata: Metadata = { title: "Reports" };

export default function OperationReportsPage() {
  return <OperationReports />;
}
