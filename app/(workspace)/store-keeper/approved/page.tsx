import type { Metadata } from "next";

import { IssueBoard } from "@/components/store/issue-board";

export const metadata: Metadata = { title: "Approved requests" };

export default function ApprovedRequestsPage() {
  return (
    <IssueBoard
      title="Approved requests"
      description="Five zones, in order. A request appears here after the operation manager approves it. Issue only the final approved quantity. Requests still with the supervisor or operation manager are not included."
      statuses={["FULLY_APPROVED", "PARTIALLY_APPROVED", "APPROVED", "OPERATION_MANAGER_APPROVED", "PREPARED"]}
    />
  );
}
