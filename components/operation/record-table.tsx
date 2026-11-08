"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { formatDubai } from "@/lib/format";
import { filterOperationRecords } from "@/lib/workspace/views";
import type { OperationRecordLine } from "@/lib/workspace/types";

const fieldClass = "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

export function RecordTable({
  mode,
  rows,
}: {
  mode: "approved" | "rejected" | "history";
  rows: OperationRecordLine[];
}) {
  const [date, setDate] = useState("");
  const [zone, setZone] = useState("all");
  const [teamLeaderId, setTeamLeaderId] = useState("all");
  const [supervisorId, setSupervisorId] = useState("all");
  const [material, setMaterial] = useState("");
  const [status, setStatus] = useState("all");
  const [requestId, setRequestId] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const leaders = unique(rows.map((row) => ({ id: row.teamLeaderId, name: row.teamLeaderName })));
  const supervisors = unique(rows.map((row) => ({ id: row.supervisorId, name: row.supervisorName })));
  const zones = [...new Set(rows.map((row) => row.zoneCode))];
  const statuses = [...new Set(rows.map((row) => row.status))];

  const visible = useMemo(
    () =>
      filterOperationRecords(rows, {
        date: mode === "history" ? date : "",
        zone,
        teamLeaderId,
        supervisorId,
        material: mode === "history" ? material : "",
        status: mode === "rejected" ? "" : status,
        requestId: mode === "history" ? requestId : "",
      }),
    [rows, mode, date, zone, teamLeaderId, supervisorId, material, status, requestId],
  );

  const empty =
    mode === "approved"
      ? "No operation manager approvals yet."
      : mode === "rejected"
        ? "No operation manager rejections yet."
        : "No requests match these filters.";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {mode === "history" ? (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Date
            <input className={fieldClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        ) : null}
        <SelectFilter label="Zone" value={zone} onChange={setZone} options={zones.map((code) => ({ id: code, name: `Zone ${code}` }))} />
        <SelectFilter label="Team leader" value={teamLeaderId} onChange={setTeamLeaderId} options={leaders} />
        <SelectFilter label="Supervisor" value={supervisorId} onChange={setSupervisorId} options={supervisors} />
        {mode !== "rejected" ? (
          <SelectFilter
            label="Status"
            value={status}
            onChange={setStatus}
            options={statuses.map((item) => ({ id: item, name: item.replaceAll("_", " ") }))}
          />
        ) : null}
        {mode === "history" ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Material
              <input
                className={fieldClass}
                value={material}
                placeholder="Code or description"
                onChange={(event) => setMaterial(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Request ID
              <input
                className={fieldClass}
                value={requestId}
                placeholder="MR-"
                onChange={(event) => setRequestId(event.target.value)}
              />
            </label>
          </>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {visible.length} {visible.length === 1 ? "material" : "materials"}
      </p>
      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Request ID</th>
                  <th className="px-2 py-2 font-medium">Zone</th>
                  <th className="px-2 py-2 font-medium">Team leader</th>
                  <th className="px-2 py-2 font-medium">Supervisor</th>
                  <th className="px-2 py-2 font-medium">Material</th>
                  {mode === "rejected" ? (
                    <>
                      <th className="px-2 py-2 text-right font-medium">Requested</th>
                      <th className="px-2 py-2 text-right font-medium">Supervisor approved</th>
                      <th className="px-2 py-2 text-right font-medium">Rejected</th>
                    </>
                  ) : (
                    <th className="px-2 py-2 text-right font-medium">
                      {mode === "approved" ? "Approved quantity" : "Quantities"}
                    </th>
                  )}
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.key} className="border-b align-top">
                    <td className="px-2 py-3 font-medium">{row.requestNo}</td>
                    <td className="px-2 py-3">{row.zoneName}</td>
                    <td className="px-2 py-3 font-semibold">{row.teamLeaderName}</td>
                    <td className="px-2 py-3">{row.supervisorName}</td>
                    <td className="px-2 py-3">
                      <p className="font-medium">{row.productName}</p>
                      <p className="text-xs text-muted-foreground">{row.itemCode}</p>
                    </td>
                    {mode === "rejected" ? (
                      <>
                        <td className="px-2 py-3 text-right tabular-nums">{row.quantityRequested} {row.unit}</td>
                        <td className="px-2 py-3 text-right tabular-nums">{row.supervisorApproved} {row.unit}</td>
                        <td className="px-2 py-3 text-right tabular-nums">{row.rejectedQuantity} {row.unit}</td>
                      </>
                    ) : (
                      <td className="px-2 py-3 text-right tabular-nums">
                        {mode === "approved" ? (
                          <>{row.omApprovedQuantity} {row.unit}</>
                        ) : (
                          <span>
                            Req {row.quantityRequested} · Sup {row.supervisorApproved} · OM {row.omApprovedQuantity} {row.unit}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-2 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-2 py-3">
                      <button type="button" className="text-sm font-medium underline" onClick={() => setOpenKey(row.key)}>
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 lg:hidden">
            {visible.map((row) => (
              <article key={row.key} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{row.requestNo} · {row.zoneName}</p>
                    <p className="text-base font-semibold">{row.productName}</p>
                    <p>{row.teamLeaderName}</p>
                    <p className="text-muted-foreground">{row.supervisorName}</p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                <p className="tabular-nums">
                  {mode === "rejected"
                    ? `Requested ${row.quantityRequested} · Supervisor ${row.supervisorApproved} · Rejected ${row.rejectedQuantity} ${row.unit}`
                    : mode === "approved"
                      ? `Approved ${row.omApprovedQuantity} ${row.unit}`
                      : `Requested ${row.quantityRequested} ${row.unit}`}
                </p>
                <button type="button" className="self-start text-sm font-medium underline" onClick={() => setOpenKey(row.key)}>
                  Details
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {openKey ? (
        <LineDrawer row={rows.find((row) => row.key === openKey) ?? null} mode={mode} onClose={() => setOpenKey(null)} />
      ) : null}
    </div>
  );
}

function LineDrawer({
  row,
  mode,
  onClose,
}: {
  row: OperationRecordLine | null;
  mode: "approved" | "rejected" | "history";
  onClose: () => void;
}) {
  if (!row) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${row.requestNo} ${row.productName}`}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{row.requestNo} · {row.zoneName}</p>
            <h3 className="text-lg font-semibold">{row.productName}</h3>
            <p className="text-sm text-muted-foreground">{row.itemCode}</p>
          </div>
          <button type="button" className="rounded-lg border px-2.5 py-1.5 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Field label="Request date" value={formatDubai(row.requestedAt)} />
          <Field label="Team leader" value={row.teamLeaderName} />
          <Field label="Supervisor" value={row.supervisorName} />
          <Field label="Zone" value={row.zoneName} />
          <Field label="Requested" value={`${row.quantityRequested} ${row.unit}`} />
          <Field label="Supervisor approved" value={`${row.supervisorApproved} ${row.unit}`} />
          {mode !== "rejected" ? (
            <Field label="Approved quantity" value={`${row.omApprovedQuantity} ${row.unit}`} />
          ) : null}
          <Field label="Approval date" value={formatDubai(row.decidedAt)} />
          <Field label="Status" value={row.statusLabel} />
          {mode === "rejected" ? (
            <>
              <Field label="Rejected quantity" value={`${row.rejectedQuantity} ${row.unit}`} />
              <Field label="Rejection reason" value={row.omRejectionReason ?? "—"} />
              <Field label="Rejected by" value={row.decidedByName ?? "—"} />
              <Field label="Rejection date" value={formatDubai(row.decidedAt)} />
            </>
          ) : null}
          <Field label="Actual issued quantity" value={`${row.quantityIssued} ${row.unit}`} />
          <Field label="Material issue ticket" value={row.ticketNo ?? "—"} />
          <Field label="Issue date" value={formatDubai(row.issuedAt)} />
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/operation-manager/requests/${row.requestId}`} className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium">
            Review
          </Link>
          {row.ticketNo ? (
            <>
              <Link href={`/operation-manager/tickets/${row.requestId}`} className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium">
                View Ticket
              </Link>
              <Link href={`/operation-manager/tickets/${row.requestId}?print=1`} className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium">
                Print Ticket
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
    </label>
  );
}

function unique(rows: { id: string; name: string }[]) {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (row.id && !seen.has(row.id)) seen.set(row.id, row.name);
  }
  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
