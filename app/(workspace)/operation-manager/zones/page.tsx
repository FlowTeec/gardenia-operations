import type { Metadata } from "next";

import { OperationZones } from "@/components/operation/zones-page";

export const metadata: Metadata = { title: "Zones" };

export default function OperationZonesPage() {
  return <OperationZones />;
}
