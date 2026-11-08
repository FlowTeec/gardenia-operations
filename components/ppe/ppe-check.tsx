"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { daysSinceLabel } from "@/components/operation/usage-details";
import { formatDubaiDay } from "@/lib/format";
import { getPpeIssueHistoryAction } from "@/lib/workspace/actions";
import type { PpeCycleStatus, PpeEmployeeCheck, PpeHistoryRow } from "@/lib/workspace/types";

const TONE: Record<PpeCycleStatus, string> = {
  Eligible: "status-approved",
  "Within 3-Month Cycle": "status-pending",
  "No Previous Issue": "status-issued",
  "No PPE History": "status-issued",
};

export function PpeCycleBadge({ status }: { status: PpeCycleStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TONE[status]}`}>
      {status}
    </span>
  );
}

export function PpeCheckSummary({ checks }: { checks: PpeEmployeeCheck[] | undefined }) {
  if (!checks || checks.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-xs">
      {checks.map((check) => (
        <li key={`${check.materialId}-${check.employeeId}`}>
          <span className="font-medium">{check.employeeId}</span>
          {" · "}
          {check.status}
          {check.lastIssuedAt ? ` · ${formatDubaiDay(check.lastIssuedAt)} · ${check.lastQuantity} ${check.unit}` : ""}
          {check.daysSince !== null ? ` · ${daysSinceLabel(check.daysSince)} since last issue` : ""}
        </li>
      ))}
    </ul>
  );
}

export function PpeCheckList({
  checks,
  productName,
  approvedLabel,
  approvedQuantity,
}: {
  checks: PpeEmployeeCheck[];
  productName?: string;
  approvedLabel?: string;
  approvedQuantity?: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rows, setRows] = useState<PpeHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (checks.length === 0) return null;
  const unit = checks[0]?.unit ?? "";
  const intervalDays = checks[0]?.intervalDays ?? 90;
  const open = checks.find((check) => `${check.materialId}:${check.employeeId}` === openKey) ?? null;

  async function loadHistory(check: PpeEmployeeCheck) {
    const key = `${check.materialId}:${check.employeeId}`;
    setOpenKey(key);
    setRows([]);
    setError(null);
    setLoading(true);
    try {
      const result = await getPpeIssueHistoryAction(check.employeeId, check.materialId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRows(result.rows);
    } catch {
      setError("The PPE history could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground">Previous PPE issue</p>
        <p className="text-xs text-muted-foreground">Replacement cycle: {intervalDays} days</p>
        {approvedLabel && approvedQuantity ? (
          <p className="text-xs text-muted-foreground">
            {approvedLabel}: {approvedQuantity} {unit}
          </p>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-2 py-1 font-medium">Employee ID</th>
              <th className="px-2 py-1 font-medium">PPE</th>
              <th className="px-2 py-1 font-medium">Requested</th>
              <th className="px-2 py-1 font-medium">Last issue</th>
              <th className="px-2 py-1 font-medium">Previous qty</th>
              <th className="px-2 py-1 font-medium">Days since</th>
              <th className="px-2 py-1 font-medium">90-day status</th>
              <th className="px-2 py-1 font-medium">History</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={`${check.materialId}-${check.employeeId}`} className="border-b align-top">
                <td className="px-2 py-2 font-medium">{check.employeeId}</td>
                <td className="px-2 py-2">{productName ?? "PPE"}</td>
                <td className="px-2 py-2 tabular-nums">{check.quantity} {check.unit}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {check.lastIssuedAt ? formatDubaiDay(check.lastIssuedAt) : check.status}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {check.lastQuantity ? `${check.lastQuantity} ${check.unit}` : "—"}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {check.daysSince === null ? "—" : check.daysSince}
                </td>
                <td className="px-2 py-2">
                  <PpeCycleBadge status={check.status} />
                  {check.status === "Within 3-Month Cycle" && check.daysSince !== null ? (
                    <p className="mt-1 max-w-56 text-xs text-muted-foreground">
                      Previous issue: {daysSinceLabel(check.daysSince)} ago. Expected replacement: after {check.intervalDays} days. This does not block approval or issue.
                    </p>
                  ) : null}
                  {check.status === "No PPE History" ? (
                    <p className="mt-1 max-w-56 text-xs text-muted-foreground">
                      Earlier issues of this PPE are not tied to an employee ID, so a last issue cannot be shown.
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    className="text-xs font-medium underline"
                    onClick={() => void loadHistory(check)}
                  >
                    View history
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ppe-history-title"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background p-4 shadow-lg"
          >
            <h2 id="ppe-history-title" className="text-lg font-semibold">Employee PPE history</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Employee ID {open.employeeId}
              {productName ? ` · ${productName}` : ""}
            </p>
            {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading history…</p> : null}
            {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
            {!loading && !error && rows.length === 0 ? (
              <p className="mt-3 text-sm">No previous actual issue for this employee and this PPE.</p>
            ) : null}
            {rows.length > 0 ? (
              <table className="mt-3 w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-1 font-medium">Date</th>
                    <th className="py-1 font-medium">PPE</th>
                    <th className="py-1 font-medium">Quantity</th>
                    <th className="py-1 font-medium">Issue ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.reference}-${row.issuedAt}-${row.quantity}`} className="border-t">
                      <td className="py-1 pr-2 whitespace-nowrap">{formatDubaiDay(row.issuedAt)}</td>
                      <td className="py-1 pr-2">{row.productName}</td>
                      <td className="py-1 pr-2 tabular-nums">{row.quantity} {row.unit}</td>
                      <td className="py-1">{row.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <div className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpenKey(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
