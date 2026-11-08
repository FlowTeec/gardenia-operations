"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { PpeLines } from "@/components/ppe-lines";
import { DecisionBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerData } from "@/components/use-server-data";
import { formatDubai } from "@/lib/format";
import { decideRequestItemsAction, getSupervisorReview, openArea } from "@/lib/workspace/actions";
import type { ItemDecision } from "@/lib/workspace/types";

type Draft = {
  choice: ItemDecision;
  quantity: string;
  reason: string;
};

export function RequestReview({ id }: { id: string }) {
  const page = useServerData(() => loadReview(id), id);
  const review = page.data?.ok ? page.data.review : null;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const keyRef = useRef<string | null>(null);

  if (review && loadedFor !== `${review.id}:${review.approvalSummary}:${review.status}`) {
    setLoadedFor(`${review.id}:${review.approvalSummary}:${review.status}`);
    setDrafts(
      Object.fromEntries(
        review.items.map((item) => [
          item.id,
          {
            choice: item.decision,
            quantity: item.decision === "APPROVED" ? item.approvedQuantity : item.quantityRequested,
            reason: item.rejectionReason ?? "",
          },
        ]),
      ),
    );
  }

  function update(itemId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [itemId]: { ...current[itemId], ...patch },
    }));
  }

  function openReject(itemId: string) {
    const draft = drafts[itemId];
    setError(null);
    setRejectReason(draft?.reason ?? "");
    setRejectingId(itemId);
  }

  function confirmReject() {
    if (!rejectingId) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError("A rejection needs a reason.");
      return;
    }
    update(rejectingId, { choice: "REJECTED", reason });
    setRejectingId(null);
    setRejectReason("");
    setError(null);
  }

  async function save() {
    if (!review) return;
    const decisions = review.items.flatMap((item) => {
      const draft = drafts[item.id];
      if (!draft || draft.choice === "PENDING") return [];
      return [{
        itemId: item.id,
        decision: draft.choice,
        approvedQuantity: draft.choice === "APPROVED" ? draft.quantity : "0",
        rejectionReason: draft.choice === "REJECTED" ? draft.reason.trim() : "",
      }];
    });
    const missingReason = review.items.find((item) => {
      const draft = drafts[item.id];
      return draft?.choice === "REJECTED" && draft.reason.trim().length === 0;
    });
    if (missingReason) {
      setError(`${missingReason.productName}: A rejection needs a reason.`);
      return;
    }
    if (decisions.length === 0) {
      setError("Choose approve or reject for at least one material.");
      return;
    }
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await decideRequestItemsAction(review.id, decisions, keyRef.current);
      if (!result.ok) {
        setError(result.error ?? "The decision was refused.");
        return;
      }
      setMessage(
        result.replayed
          ? "Those decisions were already recorded. Stock was not changed."
          : "Decisions saved. Stock was not changed.",
      );
      keyRef.current = null;
      page.reload();
    } catch {
      setError("The decision could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href="/supervisor" className="text-sm underline-offset-4 hover:underline">
        Back to approvals
      </Link>
      {page.status === "loading" && !review ? (
        <p className="text-sm text-muted-foreground">Loading request…</p>
      ) : null}
      {page.data && !page.data.ok ? (
        <p role="alert" className="text-sm text-destructive">{page.data.error}</p>
      ) : null}
      {page.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">{page.error}</p>
      ) : null}
      {review ? (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{review.requestNo}</h1>
              <StatusBadge status={review.status} />
            </div>
            <p className="text-base font-semibold">{review.teamLeaderName}</p>
            <p className="text-sm text-muted-foreground">
              {review.zoneName} · Requested {formatDubai(review.requestedAt)}
            </p>
            {review.canOpenTicket ? (
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href={`/supervisor/tickets/${review.id}`} className="font-medium underline">
                  View Ticket
                </Link>
                <Link href={`/supervisor/tickets/${review.id}?print=1`} className="font-medium underline">
                  Print Ticket
                </Link>
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground">{review.approvalSummary}</p>
            {review.rejectionReason ? (
              <p className="text-sm text-muted-foreground">Reason: {review.rejectionReason}</p>
            ) : null}
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
          <div className="flex flex-col gap-3">
            {review.items.map((item) => {
              const draft = drafts[item.id] ?? {
                choice: item.decision,
                quantity: item.quantityRequested,
                reason: item.rejectionReason ?? "",
              };
              return (
                <article key={item.id} className="flex flex-col gap-3 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.itemCode}</p>
                      <p className="text-base font-semibold">{item.productName}</p>
                      <p className="text-muted-foreground">
                        {item.categoryName} · {item.unit}
                      </p>
                    </div>
                    <DecisionBadge decision={draft.choice} />
                  </div>
                  <p>Requested: {item.quantityRequested} {item.unit}</p>
                  {item.decision !== "PENDING" ? (
                    <p className="text-muted-foreground">
                      Supervisor decision: {item.decision === "APPROVED" ? "Approved" : "Rejected"}
                      {item.decision === "APPROVED" ? ` · ${item.approvedQuantity} ${item.unit}` : ""}
                      {item.rejectionReason ? ` · ${item.rejectionReason}` : ""}
                      {item.decidedByName ? ` · ${item.decidedByName}` : ""}
                      {item.decidedAt ? ` · ${formatDubai(item.decidedAt)}` : ""}
                    </p>
                  ) : null}
                  {item.omDecision === "APPROVED" ? (
                    <p className="text-muted-foreground">
                      Operation manager decision: Approved · {item.omApprovedQuantity} {item.unit}
                    </p>
                  ) : null}
                  {item.omDecision === "REJECTED" ? (
                    <p className="text-muted-foreground">
                      Operation manager decision: Rejected
                      {item.omRejectionReason ? ` · ${item.omRejectionReason}` : ""}
                    </p>
                  ) : null}
                  {item.allocations.length > 0 ? (
                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                      <p className="text-xs font-medium text-muted-foreground">PPE by employee ID</p>
                      <ul className="mt-1">
                        {item.allocations.map((allocation) => (
                          <li key={`${item.id}-${allocation.employeeId}`}>
                            {allocation.employeeId} · {allocation.quantity} {allocation.unit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {review.canDecide ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="lg"
                          variant={draft.choice === "APPROVED" ? "default" : "outline"}
                          onClick={() => update(item.id, { choice: "APPROVED" })}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="lg"
                          variant={draft.choice === "REJECTED" ? "destructive" : "outline"}
                          onClick={() => openReject(item.id)}
                        >
                          Reject
                        </Button>
                      </div>
                      {draft.choice === "APPROVED" ? (
                        <label className="flex flex-col gap-2">
                          <span>Approved quantity ({item.unit})</span>
                          <Input
                            value={draft.quantity}
                            inputMode="decimal"
                            aria-label={`Approved quantity for ${item.itemCode}`}
                            className="h-10 max-w-40"
                            onChange={(event) => update(item.id, { quantity: event.target.value })}
                          />
                          <span className="text-xs text-muted-foreground">
                            Cannot be negative or greater than {item.quantityRequested} {item.unit}.
                          </span>
                        </label>
                      ) : null}
                      {draft.choice === "REJECTED" ? (
                        <p className="text-sm">
                          Rejection reason: {draft.reason.trim() || "Required before this rejection can be saved."}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex flex-col gap-1 text-muted-foreground">
                      <p>Approved quantity: {item.approvedQuantity} {item.unit}</p>
                      <p>Actually issued quantity: {item.quantityIssued} {item.unit}</p>
                      {item.decision === "REJECTED" ? (
                        <p>Rejected quantity: {item.rejectedQuantity} {item.unit}</p>
                      ) : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <PpeLines groups={review.ppe} />
          {review.canDecide ? (
            <Button type="button" size="lg" className="h-12 w-full text-base" disabled={pending} onClick={() => void save()}>
              Save decisions
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              {review.status === "PENDING_OPERATION_MANAGER"
                ? "The operation manager reviews this next. The store cannot issue it yet, and the supervisor quantities stay as recorded."
                : "This request has left supervisor review. The approved quantity stays as recorded."}
            </p>
          )}
          {rejectingId ? (
            <RejectMaterialDialog
              item={review.items.find((item) => item.id === rejectingId) ?? null}
              reason={rejectReason}
              pending={pending}
              onReason={setRejectReason}
              onCancel={() => {
                setRejectingId(null);
                setRejectReason("");
              }}
              onConfirm={confirmReject}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function RejectMaterialDialog({
  item,
  reason,
  pending,
  onReason,
  onCancel,
  onConfirm,
}: {
  item: { itemCode: string; productName: string; quantityRequested: string; unit: string } | null;
  reason: string;
  pending: boolean;
  onReason: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="supervisor-reject-title"
        className="w-full max-w-lg rounded-lg bg-background p-4 shadow-lg"
      >
        <h2 id="supervisor-reject-title" className="text-lg font-semibold">Reject Material</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Material</dt>
            <dd className="font-medium">{item.productName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Requested quantity</dt>
            <dd>{item.quantityRequested} {item.unit}</dd>
          </div>
        </dl>
        <label className="mt-3 flex flex-col gap-2 text-sm">
          <span>Rejection reason</span>
          <textarea
            value={reason}
            required
            aria-label={`Rejection reason for ${item.itemCode}`}
            className="min-h-24 rounded-lg border border-input bg-background px-2.5 py-2"
            onChange={(event) => onReason(event.target.value)}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="lg" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            variant="destructive"
            disabled={pending || reason.trim().length === 0}
            onClick={onConfirm}
          >
            Confirm Rejection
          </Button>
        </div>
      </div>
    </div>
  );
}

async function loadReview(id: string) {
  await openArea("supervisor");
  return getSupervisorReview(id);
}
