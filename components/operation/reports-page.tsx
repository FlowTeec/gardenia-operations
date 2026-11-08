"use client";

import { useState } from "react";

import { downloadWorkbook } from "@/components/store/download-workbook";
import { Button } from "@/components/ui/button";
import { useServerData } from "@/components/use-server-data";
import { formatDubai } from "@/lib/format";
import { exportInventoryAction, getOperationReports } from "@/lib/workspace/actions";

export function OperationReports() {
  const page = useServerData(getOperationReports);
  const report = page.data?.ok ? page.data.report : null;
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function exportReport() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await exportInventoryAction(null);
      if (!result.ok) {
        setError(result.error ?? "The report could not be exported.");
        return;
      }
      downloadWorkbook(result.fileName, result.base64);
      setMessage(`Inventory report downloaded. ${result.scopeLabel}`);
    } catch {
      setError("The report could not be exported.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Figures come from confirmed issues and recorded decisions. Requested and approved
          quantities are not treated as consumption.
        </p>
      </div>
      {page.status === "loading" && !report ? <p className="text-sm text-muted-foreground">Loading reports…</p> : null}
      {page.status === "error" ? <p role="alert" className="text-sm text-destructive">{page.error}</p> : null}
      {page.data && !page.data.ok ? <p role="alert" className="text-sm text-destructive">{page.data.error}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

      <section id="inventory-report" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Inventory report</h2>
        <p className="text-sm text-muted-foreground">The same Excel inventory report the store keeper can download.</p>
        <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => void exportReport()}>
          Export to Excel
        </Button>
      </section>

      <ReportTable
        id="consumption"
        title="Actual material consumption"
        empty="No confirmed issues yet."
        headers={["Item code", "Description", "Issued"]}
        rows={(report?.consumption ?? []).map((row) => [row.itemCode, row.productName, `${row.issued} ${row.unit}`])}
      />
      <ReportTable
        id="leaders"
        title="Team leader consumption"
        empty="No confirmed issues yet."
        headers={["Team leader", "Item code", "Description", "Issued"]}
        rows={(report?.leaders ?? []).map((row) => [row.teamLeaderName ?? "—", row.itemCode, row.productName, `${row.issued} ${row.unit}`])}
      />
      <ReportTable
        id="ppe"
        title="PPE issue history"
        empty="No PPE issues have been confirmed."
        headers={["Employee ID", "Item", "Quantity", "Reference", "Issued"]}
        rows={(report?.ppe ?? []).map((row) => [
          row.employeeId,
          `${row.itemCode} ${row.productName}`,
          `${row.quantity} ${row.unit}`,
          row.reference,
          formatDubai(row.issuedAt),
        ])}
      />
      <ReportTable
        id="requests"
        title="Request statistics"
        empty="No requests yet."
        headers={["Status", "Requests"]}
        rows={(report?.requestCounts ?? []).map((row) => [row.label, String(row.count)])}
      />
      <ReportTable
        id="zones"
        title="Zone performance"
        empty="No zones are configured."
        headers={["Zone", "Today", "Waiting approval", "In progress", "Rejected", "Issued"]}
        rows={(report?.zones ?? []).map((row) => [
          row.name,
          row.status,
          String(row.pending),
          String(row.inProgress),
          String(row.rejected),
          String(row.issued),
        ])}
      />
      <section id="rejections" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Rejection statistics</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border px-3 py-3">
            <dt className="text-xs text-muted-foreground">Supervisor material rejections</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{report?.supervisorRejections ?? "—"}</dd>
          </div>
          <div className="rounded-lg border px-3 py-3">
            <dt className="text-xs text-muted-foreground">Operation manager material rejections</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{report?.operationRejections ?? "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function ReportTable({
  id,
  title,
  empty,
  headers,
  rows,
}: {
  id: string;
  title: string;
  empty: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section id={id} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                {headers.map((header) => (
                  <th key={header} className="px-2 py-2 font-medium">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${id}-${index}`} className="border-b">
                  {row.map((cell, cellIndex) => (
                    <td key={`${headerKey(headers, cellIndex)}-${index}`} className="px-2 py-2">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function headerKey(headers: string[], index: number) {
  return headers[index] ?? String(index);
}
