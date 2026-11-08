type BadgeVariant = "pending" | "approved" | "rejected" | "returned" | "issued" | "partially_issued" |
  "dispatched" | "received" | "partially_received" | "partially_approved" | "active" | "inactive";

const styles: Record<BadgeVariant, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  returned: "bg-amber-100 text-amber-800 border-amber-200",
  issued: "bg-blue-100 text-blue-800 border-blue-200",
  partially_issued: "bg-purple-100 text-purple-800 border-purple-200",
  dispatched: "bg-indigo-100 text-indigo-800 border-indigo-200",
  received: "bg-teal-100 text-teal-800 border-teal-200",
  partially_received: "bg-cyan-100 text-cyan-800 border-cyan-200",
  partially_approved: "bg-orange-100 text-orange-800 border-orange-200",
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
};

const labels: Record<BadgeVariant, string> = {
  pending: "Pending approval",
  approved: "Waiting for issuance",
  rejected: "Rejected",
  returned: "Returned for changes",
  issued: "Fully issued",
  partially_issued: "Partially issued",
  dispatched: "Dispatched",
  received: "Received",
  partially_received: "Partially Received",
  partially_approved: "Partially Approved",
  active: "Active",
  inactive: "Inactive",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = (status as BadgeVariant) in styles ? (status as BadgeVariant) : "pending";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[variant]}`}>
      {labels[variant] ?? status}
    </span>
  );
}
