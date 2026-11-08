"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PpeIntervalSection } from "@/components/operation/ppe-intervals";
import { SignalBadge } from "@/components/operation/signal-badge";
import { StatusBadge } from "@/components/status-badge";
import { useServerData } from "@/components/use-server-data";
import { formatDubai } from "@/lib/format";
import { getOperationHome } from "@/lib/workspace/actions";
import type { OperationCard, StockAlert, ZoneAvailability } from "@/lib/workspace/types";

export function OperationDashboard() {
  const page = useServerData(getOperationHome);
  const reload = page.reload;

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") reload();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  const data = page.data;
  const attention = (data?.queue ?? []).slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Operation Manager</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Approve materials after the supervisor, watch zones and stock, and open a request
          that needs a decision. Inventory on this role is for review. The store keeper
          receives stock, adjusts balances, and confirms the issue.
        </p>
      </div>

      {data ? (
        <p className="text-sm text-muted-foreground">Signed in as {data.actor.displayName}.</p>
      ) : null}

      {page.status === "loading" && !data ? (
        <p className="text-sm text-muted-foreground">Loading operations…</p>
      ) : null}
      {page.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">{page.error}</p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <Summary label="Pending approval" value={data?.pendingMaterials ?? "—"} hint="Materials waiting now" href="/operation-manager/requests" />
        <Summary label="Pending supervisor approvals" value={data?.pendingSupervisor ?? "—"} hint="Still with the supervisor" />
        <Summary label="Approved today" value={data?.approvedToday ?? "—"} hint="Operation manager decisions" href="/operation-manager/requests?tab=approved" />
        <Summary label="Rejected today" value={data?.rejectedToday ?? "—"} hint="Operation manager decisions" href="/operation-manager/requests?tab=rejected" />
        <Summary label="Requests in progress" value={data?.inProgress ?? "—"} hint="Not issued or rejected" href="/operation-manager/requests?tab=progress" />
        <Summary label="Open zones" value={data ? zoneList(data.openZoneCodes) : "—"} hint={data?.today ?? "Today"} href="/operation-manager/zones" />
        <Summary label="Closed zones" value={data ? zoneList(data.closedZoneCodes) : "—"} hint="New requests blocked" href="/operation-manager/zones" />
        <Summary label="Low stock" value={data?.lowStock ?? "—"} hint="Current balances" href="/operation-manager/inventory?tab=stock" />
      </dl>

      <section className="flex flex-col gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Today&apos;s Request Zones</h2>
          <Link href="/operation-manager/zones" className="text-xs font-medium underline-offset-4 hover:underline">
            Zone control
          </Link>
        </div>
        <ul className="flex flex-wrap gap-2">
          {(data?.zones ?? []).map((zone) => (
            <li key={zone.code}>
              <ZoneChip code={zone.code} status={zone.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Requests needing attention</h2>
          <Link href="/operation-manager/requests" className="text-sm font-medium underline-offset-4 hover:underline">
            Open pending approval
          </Link>
        </div>
        {attention.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            No materials are waiting for an operation manager decision.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attention.map((group) => (
              <li key={group.requestId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{group.requestNo}</p>
                  <p className="text-muted-foreground">{group.zoneName} · {group.lines.length} {group.lines.length === 1 ? "material" : "materials"}</p>
                </div>
                <Link
                  href={`/operation-manager/requests/${group.requestId}`}
                  className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium"
                >
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PpeIntervalSection />
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <dt className="text-xs leading-5 text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  if (!href) {
    return <div className="summary-card px-3 py-3">{body}</div>;
  }
  return (
    <Link href={href} className="summary-card px-3 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {body}
    </Link>
  );
}

function zoneList(codes: string[]) {
  return codes.length > 0 ? codes.join(", ") : "None";
}

function ZoneChip({ code, status }: { code: string; status: ZoneAvailability }) {
  const open = status === "OPEN";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
        open ? "zone-open border-transparent" : "zone-closed"
      }`}
    >
      {code}
      <span className="text-xs font-semibold tracking-wide">{status}</span>
    </span>
  );
}

export function RequestTable({
  rows,
  empty,
  showTicket,
}: {
  rows: OperationCard[];
  empty: string;
  showTicket: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium">Request ID</th>
              <th className="px-2 py-2 font-medium">Team leader</th>
              <th className="px-2 py-2 font-medium">Supervisor</th>
              <th className="px-2 py-2 font-medium">Zone</th>
              <th className="px-2 py-2 font-medium">Request date</th>
              <th className="px-2 py-2 font-medium">Materials</th>
              <th className="px-2 py-2 font-medium">Supervisor approval</th>
              <th className="px-2 py-2 font-medium">Operation manager approval</th>
              <th className="px-2 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((request) => (
              <tr key={request.id} className="border-b align-top">
                <td className="px-2 py-3 font-medium">{request.requestNo}</td>
                <td className="px-2 py-3 text-base font-semibold">{request.teamLeaderName}</td>
                <td className="px-2 py-3 font-medium">{request.supervisorName}</td>
                <td className="px-2 py-3">{request.zoneName}</td>
                <td className="px-2 py-3">{formatDubai(request.requestedAt)}</td>
                <td className="px-2 py-3 tabular-nums">{request.materialCount}</td>
                <td className="px-2 py-3">{request.supervisorStatus}</td>
                <td className="px-2 py-3">
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={request.status} />
                    <span>{request.operationStatus}</span>
                  </div>
                </td>
                <td className="px-2 py-3">
                  <RowLinks request={request} showTicket={showTicket} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((request) => (
          <article key={request.id} className="flex flex-col gap-3 rounded-lg border p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{request.requestNo}</p>
                <p className="text-base font-semibold">{request.teamLeaderName}</p>
                <p className="font-medium">{request.supervisorName}</p>
                <p className="text-muted-foreground">{request.zoneName}</p>
              </div>
              <StatusBadge status={request.status} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Field label="Request date" value={formatDubai(request.requestedAt)} />
              <Field label="Materials" value={String(request.materialCount)} />
              <Field label="Supervisor approval" value={request.supervisorStatus} />
              <Field label="Operation manager approval" value={request.operationStatus} />
            </dl>
            <RowLinks request={request} showTicket={showTicket} />
          </article>
        ))}
      </div>
    </>
  );
}

function RowLinks({ request, showTicket }: { request: OperationCard; showTicket: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/operation-manager/requests/${request.id}`}
        className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium"
      >
        Review
      </Link>
      {showTicket && request.ticketState !== "none" ? (
        <>
          <Link
            href={`/operation-manager/tickets/${request.id}`}
            className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium"
          >
            View Ticket
          </Link>
          <Link
            href={`/operation-manager/tickets/${request.id}?print=1`}
            className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium"
          >
            Print Ticket
          </Link>
        </>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function AlertList({ alerts }: { alerts: StockAlert[] }) {
  if (alerts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        No low-stock or inactive materials need attention.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        These figures are the current inventory balances. Approval does not reserve stock.
      </p>
      <ul className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <li key={alert.itemCode} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-3 text-sm">
            <div>
              <p className="font-medium">{alert.itemCode}</p>
              <p className="text-base font-semibold">{alert.productName}</p>
              <p className="text-muted-foreground">
                Current stock: {alert.currentStock} {alert.unit}
              </p>
            </div>
            <SignalBadge signal={alert.signal} />
          </li>
        ))}
      </ul>
    </div>
  );
}
