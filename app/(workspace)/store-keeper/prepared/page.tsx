import type { Metadata } from "next";

import { IssueBoard } from "@/components/store/issue-board";

export const metadata: Metadata = { title: "Prepared requests" };

export default function PreparedRequestsPage() {
  return (
    <IssueBoard
      title="Prepared requests"
      description="These requests have been marked prepared. Stock has not been deducted yet. Confirm the issue from the request to reduce stock."
      statuses={["PREPARED"]}
    />
  );
}
