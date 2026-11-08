"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useServerData } from "@/components/use-server-data";
import { DECISION_LABEL, formatDubai } from "@/lib/format";
import {
  approveRequestAction,
  bulkApproveRequestsAction,
  getSupervisorHome,
  rejectRequestAction,
} from "@/lib/workspace/actions";
import type { RequestCard } from "@/lib/workspace/types";

export type SupervisorTab = "pending" | "approved" | "issued" | "rejected";

const TAB_LABEL: Record<SupervisorTab, string> = {
  pending: "Pending Approval",
  approved: "Approved Requests",
  issued: "Issued Requests",
  rejected: "Rejected Requests",
};

export function Approvals({ initialTab = "pending" }: { initialTab?: SupervisorTab }) {
  const page = useServerData(getSupervisorHome);
  const router = useRouter();
  const [tab, setTab] = useState<SupervisorTab>(initialTab);
  const [tabSource, setTabSource] = useState(initialTab);
  const reload = page.reload;
  if (tabSource !== initialTab) {
    setTabSource(initialTab);
    setTab(initialTab);
  }
  const [selected, setSelected] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState<RequestCard | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const bulkKey = useRef<string | null>(null);
  const rows = page.data?.pending ?? [];
  const eligible = rows.filter((request) => request.bulkEligible);
  const selectedRows = eligible.filter((request) => selected.includes(request.id));
  const allSelected = eligible.length > 0 && selectedRows.length === eligible.length;
  const counts: Record<SupervisorTab, number> = {
    pending: page.data?.pending.length ?? 0,
    approved: page.data?.approved.length ?? 0,
    issued: page.data?.issued.length ?? 0,
    rejected: page.data?.rejected.length ?? 0,
  };

  useEffect(() => {
    if (initialTab === "approved" || initialTab === "issued") reload();
  }, [initialTab, reload]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") reload();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  function selectTab(next: SupervisorTab) {
    setTab(next);
    setSelected([]);
    if (next === "approved" || next === "issued") page.reload();
    const href = next === "pending" ? "/supervisor" : `/supervisor?tab=${next}`;
    router.replace(href, { scroll: false });
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleAll() {
    setSelected(allSelected ? [] : eligible.map((request) => request.id));
  }

  async function run(
    action: () => Promise<{ ok: boolean; error?: string; replayed?: boolean }>,
    success: string,
  ) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "The decision was refused.");
        return false;
      }
      setMessage(result.replayed ? "That decision was already recorded. Stock was not changed." : success);
      page.reload();
      return true;
    } catch {
      setError("The decision could not be saved.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Requests from team leaders assigned to you. Approve a whole request, or open it
          and decide each material. A finished approval goes to the operation manager.
          The store does not receive it until that approval is complete. Approval does not change stock.
        </p>
      </div>
      {page.data ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Signed in as {page.data.actor.displayName}.</p>
          <p className="text-sm text-muted-foreground">
            {page.data.actor.zoneName
              ? `Assigned to ${page.data.actor.zoneName}.`
              : "This supervisor is not assigned to a zone."}
            {page.data.leaders.length > 0
              ? ` Team leaders: ${page.data.leaders.map((leader) => leader.displayName).join(", ")}.`
              : " No team leaders are assigned."}
          </p>
        </div>
      ) : null}
      {page.status === "loading" && !page.data ? (
        <p className="text-sm text-muted-foreground">Loading approvals…</p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Request sections">
        {(Object.keys(TAB_LABEL) as SupervisorTab[]).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            id={`tab-${item}`}
            aria-selected={tab === item}
            aria-controls={`panel-${item}`}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium ${
              tab === item ? "bg-foreground text-background" : "bg-background"
            }`}
            onClick={() => selectTab(item)}
          >
            {TAB_LABEL[item]}
            <span className="ml-2 tabular-nums">{counts[item]}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4">
        {tab === "pending" ? (
          <PendingQueue
            rows={rows}
            eligibleCount={eligible.length}
            selected={selected}
            selectedRows={selectedRows}
            allSelected={allSelected}
            pending={pending}
            ready={page.data !== null}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onApprove={(request) =>
              void run(
                () => approveRequestAction(request.id),
                `${request.requestNo} fully approved and sent to the operation manager. Stock was not changed.`,
              ).then((saved) => {
                if (saved) setSelected((current) => current.filter((id) => id !== request.id));
              })
            }
            onReject={(request) => {
              setRejectReason("");
              setRejecting(request);
            }}
            onBulk={() => setConfirming(true)}
          />
        ) : null}
        {tab === "approved" && page.data ? (
          <TrackerList
            rows={page.data.approved}
            empty="No approved requests are waiting for the store."
            showTicketActions={false}
          />
        ) : null}
        {tab === "issued" && page.data ? (
          <div className="flex flex-col gap-3">
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              These requests have an actual issue recorded by the store keeper. Approved
              quantity stays as you decided it. Issued quantity is what left the store.
              Opening or printing a ticket does not change stock.
            </p>
            <TrackerList
              rows={page.data.issued}
              empty="No issued requests for your team leaders yet."
              showTicketActions
            />
          </div>
        ) : null}
        {tab === "rejected" && page.data ? (
          <TrackerList
            rows={page.data.rejected}
            empty="No rejected requests for your team leaders."
            showTicketActions={false}
          />
        ) : null}
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-title"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background p-4 shadow-lg"
          >
            <h2 id="bulk-title" className="text-lg font-semibold">Approve {selectedRows.length} requests</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Each selected request will be fully approved for the quantities the team leader
              asked for. Stock will not change. A request that needs a material-by-material
              decision is not in this list.
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {selectedRows.map((request) => (
                <li key={request.id} className="rounded-lg border px-3 py-2">
                  <span className="font-medium">{request.requestNo}</span>
                  <span className="mt-1 block text-base font-semibold">{request.teamLeaderName}</span>
                  <span className="text-muted-foreground">
                    {request.zoneName} · {request.materialCount} materials · {formatDubai(request.requestedAt)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="lg"
                disabled={pending}
                onClick={() => {
                  if (!bulkKey.current) bulkKey.current = crypto.randomUUID();
                  const ids = selectedRows.map((request) => request.id);
                  const key = bulkKey.current;
                  void run(
                    () => bulkApproveRequestsAction(ids, key),
                    `${ids.length} requests fully approved and sent to the operation manager. Stock was not changed.`,
                  ).then((saved) => {
                    if (!saved) return;
                    bulkKey.current = null;
                    setSelected([]);
                    setConfirming(false);
                  });
                }}
              >
                Confirm bulk approve
              </Button>
              <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {rejecting ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
            className="w-full max-w-lg rounded-lg bg-background p-4 shadow-lg"
          >
            <h2 id="reject-title" className="text-lg font-semibold">Reject {rejecting.requestNo}</h2>
            <p className="mt-1 text-base font-semibold">{rejecting.teamLeaderName}</p>
            <p className="text-sm text-muted-foreground">
              {rejecting.zoneName}. Every material on this pending request will be rejected. Stock will not change.
            </p>
            <label className="mt-3 flex flex-col gap-2 text-sm">
              <span>Rejection reason</span>
              <textarea
                value={rejectReason}
                className="min-h-24 rounded-lg border border-input bg-background px-2.5 py-2"
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                size="lg"
                disabled={pending || rejectReason.trim().length === 0}
                onClick={() => {
                  const request = rejecting;
                  void run(
                    () => rejectRequestAction(request.id, rejectReason),
                    `${request.requestNo} rejected.`,
                  ).then((saved) => {
                    if (!saved) return;
                    setRejecting(null);
                    setRejectReason("");
                    setSelected((current) => current.filter((id) => id !== request.id));
                  });
                }}
              >
                Reject request
              </Button>
              <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => setRejecting(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PendingQueue({
  rows,
  eligibleCount,
  selected,
  selectedRows,
  allSelected,
  pending,
  ready,
  onToggle,
  onToggleAll,
  onApprove,
  onReject,
  onBulk,
}: {
  rows: RequestCard[];
  eligibleCount: number;
  selected: string[];
  selectedRows: RequestCard[];
  allSelected: boolean;
  pending: boolean;
  ready: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onApprove: (request: RequestCard) => void;
  onReject: (request: RequestCard) => void;
  onBulk: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4"
            checked={allSelected}
            disabled={eligibleCount === 0 || pending}
            onChange={onToggleAll}
          />
          Select all requests that can be approved in full
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">{selectedRows.length} selected</p>
          <Button type="button" size="lg" disabled={pending || selectedRows.length === 0} onClick={onBulk}>
            Bulk approve
          </Button>
        </div>
      </div>
      {ready && rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
          No requests are waiting from team leaders assigned to you.
        </p>
      ) : null}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium">Select</th>
              <th className="px-2 py-2 font-medium">Request</th>
              <th className="px-2 py-2 font-medium">Team leader</th>
              <th className="px-2 py-2 font-medium">Zone</th>
              <th className="px-2 py-2 font-medium">Request date</th>
              <th className="px-2 py-2 font-medium">Materials</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Approval</th>
              <th className="px-2 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((request) => (
              <tr key={request.id} className="border-b align-top">
                <td className="px-2 py-3">
                  {request.bulkEligible ? (
                    <input
                      type="checkbox"
                      className="size-4"
                      aria-label={`Select ${request.requestNo}`}
                      checked={selected.includes(request.id)}
                      disabled={pending}
                      onChange={() => onToggle(request.id)}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Review</span>
                  )}
                </td>
                <td className="px-2 py-3 font-medium">{request.requestNo}</td>
                <td className="px-2 py-3 text-base font-semibold">{request.teamLeaderName}</td>
                <td className="px-2 py-3">{request.zoneName}</td>
                <td className="px-2 py-3">{formatDubai(request.requestedAt)}</td>
                <td className="px-2 py-3">{request.materialCount}</td>
                <td className="px-2 py-3"><StatusBadge status={request.status} /></td>
                <td className="px-2 py-3">{request.approvalSummary}</td>
                <td className="px-2 py-3">
                  <RowActions request={request} pending={pending} onApprove={() => onApprove(request)} onReject={() => onReject(request)} />
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
                <p className="text-muted-foreground">{request.zoneName}</p>
              </div>
              {request.bulkEligible ? (
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    className="size-4"
                    aria-label={`Select ${request.requestNo}`}
                    checked={selected.includes(request.id)}
                    disabled={pending}
                    onChange={() => onToggle(request.id)}
                  />
                  Select
                </label>
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Request date</dt>
                <dd>{formatDubai(request.requestedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Materials</dt>
                <dd>{request.materialCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-1"><StatusBadge status={request.status} /></dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Approval</dt>
                <dd>{request.approvalSummary}</dd>
              </div>
            </dl>
            <RowActions request={request} pending={pending} onApprove={() => onApprove(request)} onReject={() => onReject(request)} />
          </article>
        ))}
      </div>
    </>
  );
}

function TrackerList({
  rows,
  empty,
  showTicketActions,
}: {
  rows: RequestCard[];
  empty: string;
  showTicketActions: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((request) => (
        <article key={request.id} className="flex flex-col gap-3 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">{request.requestNo}</p>
              <p className="text-base font-semibold">{request.teamLeaderName}</p>
              <p className="text-muted-foreground">{request.zoneName}</p>
            </div>
            <StatusBadge status={request.status} />
          </div>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Request date" value={formatDubai(request.requestedAt)} />
            <Field label="Approval date" value={request.approvedAt ? formatDubai(request.approvedAt) : "Not recorded"} />
            <Field label="Issue date" value={request.issuedAt ? formatDubai(request.issuedAt) : "Not issued"} />
            <Field label="Materials" value={String(request.materialCount)} />
            <Field label="Total approved quantities" value={request.totalApproved} />
            <Field label="Total actually issued quantities" value={request.totalIssued} />
            <Field label="Material issue ticket" value={ticketStatus(request)} />
          </dl>
          <ul className="text-muted-foreground">
            {request.items.map((item, index) => (
              <li key={`${request.id}-${index}`}>
                {item.name}: {DECISION_LABEL[item.decision]} · approved {item.approvedQuantity} {item.unit} · issued {item.issuedQuantity} {item.unit}
              </li>
            ))}
          </ul>
          {request.rejectionReason ? (
            <p className="text-muted-foreground">Reason: {request.rejectionReason}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/supervisor/requests/${request.id}`}
              className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium"
            >
              View details
            </Link>
            {showTicketActions && request.ticketState !== "none" ? (
              <>
                <Link
                  href={`/supervisor/tickets/${request.id}`}
                  className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium"
                >
                  View Ticket
                </Link>
                <Link
                  href={`/supervisor/tickets/${request.id}?print=1`}
                  className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium"
                >
                  Print Ticket
                </Link>
              </>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function ticketStatus(request: RequestCard) {
  if (request.ticketState === "final") {
    return request.ticketNo ? `Finalized · ${request.ticketNo}` : "Finalized";
  }
  if (request.ticketState === "in-progress") return "In progress";
  return "Not available until the store confirms the issue";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function RowActions({
  request,
  pending,
  onApprove,
  onReject,
}: {
  request: RequestCard;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/supervisor/requests/${request.id}`}
        className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium"
      >
        View details
      </Link>
      {request.bulkEligible ? (
        <>
          <Button type="button" size="lg" disabled={pending} onClick={onApprove}>
            Approve
          </Button>
          <Button type="button" variant="outline" size="lg" disabled={pending} onClick={onReject}>
            Reject
          </Button>
        </>
      ) : (
        <span className="self-center text-xs text-muted-foreground">Open the request to decide each material.</span>
      )}
    </div>
  );
}
