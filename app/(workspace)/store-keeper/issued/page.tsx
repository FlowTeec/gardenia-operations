import type { Metadata } from "next";

import { IssuedHistory } from "@/components/store/issued-history";

export const metadata: Metadata = { title: "Issued history" };

export default function IssuedHistoryPage() {
  return <IssuedHistory />;
}
