import { DECISION_LABEL, STATUS_LABEL } from "@/lib/format";
import type { ItemDecision, RequestStatus } from "@/lib/workspace/types";

const tone: Record<ItemDecision | RequestStatus, string> = {
  PENDING: "status-pending",
  PENDING_OPERATION_MANAGER: "status-pending-strong",
  PARTIALLY_APPROVED: "status-partial",
  FULLY_APPROVED: "status-approved",
  APPROVED: "status-approved",
  OPERATION_MANAGER_APPROVED: "status-approved",
  REJECTED: "status-rejected",
  PREPARED: "status-prepared",
  ISSUED: "status-issued",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function DecisionBadge({ decision }: { decision: ItemDecision }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone[decision]}`}>
      {DECISION_LABEL[decision]}
    </span>
  );
}
