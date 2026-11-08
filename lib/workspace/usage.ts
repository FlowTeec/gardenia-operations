import { addQty, cmpQty, isPositiveQty, isZeroQty } from "./decimal";
import { ticketLabel } from "@/lib/format";
import type { ConfirmedIssue, MaterialUsage, UsageLevel, Workspace } from "./types";

/**
 * Actual consumption for one team leader and one material.
 *
 * The only source is a store-keeper issue confirmation (`issueReceipts`).
 * Requested, supervisor-approved, operation-manager-approved, and prepared
 * quantities are ignored. A ticket that was never confirmed is ignored.
 * Stock is not reserved on approval, so there is no committed quantity.
 *
 * Windows use the Asia/Dubai calendar. An issue counts in the 30/60/90-day
 * total when its Dubai date is today or at most that many days earlier.
 *
 * The usage level compares the supervisor-approved quantity with the 90-day
 * actual total. Above that total is a warning only. It does not change the
 * quantity or the approval.
 *
 * Average monthly usage is the 90-day actual total ÷ 3, rounded half up to
 * 6 decimal places. It is returned only when this team leader's oldest
 * confirmed issue of the material is at least 90 days ago. A shorter span
 * is insufficient history.
 */

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dubai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dubaiDayNumber(iso: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = dayFormat.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!year || !month || !day) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function divideQty(value: string, divisor: number): string | null {
  if (!Number.isInteger(divisor) || divisor <= 0) return null;
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(value);
  if (!match) return null;
  const scale = 6;
  const digits = `${match[1]}${(match[2] ?? "").padEnd(scale, "0")}`;
  const numerator = BigInt(digits);
  const denominator = BigInt(divisor);
  const rounded = (numerator + denominator / BigInt(2)) / denominator;
  const text = rounded.toString().padStart(scale + 1, "0");
  const whole = text.slice(0, -scale).replace(/^0+(?=\d)/, "");
  const fraction = text.slice(-scale).replace(/0+$/, "");
  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

function emptyUsage(): MaterialUsage {
  return {
    lastQuantity: null,
    lastIssuedAt: null,
    daysSince: null,
    recent: [],
    days30: "0",
    days60: "0",
    days90: "0",
    averageMonthly: null,
    level: "No Previous Issue",
  };
}

export function usageByLeaderMaterial(state: Workspace, asOf: string) {
  const groups = new Map<string, ConfirmedIssue[]>();
  const today = dubaiDayNumber(asOf);
  for (const request of state.requests) {
    const reference = ticketLabel(request.requestNo);
    for (const receipt of request.issueReceipts ?? []) {
      const items = new Map(request.items.map((item) => [item.id, item]));
      for (const line of receipt.lines) {
        if (!isPositiveQty(line.quantity)) continue;
        const item = items.get(line.itemId);
        if (!item) continue;
        const issuedDay = dubaiDayNumber(receipt.issuedAt);
        if (issuedDay === null || (today !== null && issuedDay > today)) continue;
        const key = `${request.teamLeaderId}\0${item.materialId}`;
        const list = groups.get(key) ?? [];
        list.push({
          issuedAt: receipt.issuedAt,
          quantity: line.quantity,
          reference,
        });
        groups.set(key, list);
      }
    }
  }
  for (const list of groups.values()) {
    list.sort((left, right) => right.issuedAt.localeCompare(left.issuedAt));
  }

  return {
    for(teamLeaderId: string, materialId: string, comparedQuantity: string): MaterialUsage {
      return summarize(groups.get(`${teamLeaderId}\0${materialId}`) ?? [], comparedQuantity, today);
    },
  };
}

function summarize(issues: ConfirmedIssue[], comparedQuantity: string, today: number | null): MaterialUsage {
  if (issues.length === 0 || today === null) return emptyUsage();
  let days30 = "0";
  let days60 = "0";
  let days90 = "0";
  let oldest = today;
  for (const issue of issues) {
    const day = dubaiDayNumber(issue.issuedAt);
    if (day === null) continue;
    const age = today - day;
    if (age < 0) continue;
    if (day < oldest) oldest = day;
    if (age <= 90) days90 = addQty(days90, issue.quantity) ?? days90;
    if (age <= 60) days60 = addQty(days60, issue.quantity) ?? days60;
    if (age <= 30) days30 = addQty(days30, issue.quantity) ?? days30;
  }
  const last = issues[0];
  const lastDay = last ? dubaiDayNumber(last.issuedAt) : null;
  const above = cmpQty(comparedQuantity, days90) > 0;
  let level: UsageLevel = "Normal Usage";
  if (above && isZeroQty(days90)) level = "Above Recent Usage";
  else if (above) level = "Above Historical Usage";
  return {
    lastQuantity: last?.quantity ?? null,
    lastIssuedAt: last?.issuedAt ?? null,
    daysSince: lastDay === null ? null : today - lastDay,
    recent: issues.slice(0, 3),
    days30,
    days60,
    days90,
    averageMonthly: today - oldest >= 90 ? divideQty(days90, 3) : null,
    level,
  };
}
