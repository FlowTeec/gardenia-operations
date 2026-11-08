import type { RequestStatus } from "@/lib/workspace/types";

/** Calendar day in Asia/Dubai as YYYY-MM-DD. An invalid timestamp returns an empty string. */
export function dubaiDateString(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

export function formatDubaiDay(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDubai(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${formatted} GST`;
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: "Pending supervisor",
  PENDING_OPERATION_MANAGER: "Pending operation manager",
  PARTIALLY_APPROVED: "Partially approved",
  FULLY_APPROVED: "Fully approved",
  APPROVED: "Fully approved",
  OPERATION_MANAGER_APPROVED: "Operation manager approved",
  REJECTED: "Rejected",
  PREPARED: "Prepared",
  ISSUED: "Issued",
};

export const DECISION_LABEL = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;

export function requestLabel(requestNo: number | string) {
  const digits = String(requestNo).replace(/^MR-/, "");
  return `MR-${digits}`;
}

export function ticketLabel(requestNo: number | string) {
  const digits = String(requestNo).replace(/\D/g, "");
  return `MIT-${digits.padStart(4, "0")}`;
}
