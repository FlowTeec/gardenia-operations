import type { Metadata } from "next";

import { LeaderHome } from "@/components/team-leader/leader-home";

export const metadata: Metadata = { title: "Team leader" };

export default function TeamLeaderPage() {
  return <LeaderHome />;
}
