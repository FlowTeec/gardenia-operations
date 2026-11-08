"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { SignalBadge } from "@/components/operation/signal-badge";
import { UsagePanel } from "@/components/operation/usage-details";
import { PpeCheckList } from "@/components/ppe/ppe-check";
import { PpeLines } from "@/components/ppe-lines";
import { DecisionBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerData } from "@/components/use-server-data";
import { DECISION_LABEL, STATUS_LABEL, formatDubai } from "@/lib/format";
import { decideOperationItemsAction, getOperationReview, openArea } from "@/lib/workspace/actions";
import type { ItemDecision } from "@/lib/workspace/types";

type Draft = {
  choice: ItemDecision;
  quantity: string;
  reason: string;
};

export function OperationReview({ id }: { id: string }) {
  const page = useServerData(() => loadReview(id), id);
  const review = page.data?.ok ? page.data.review : null;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const keyRef = useRef<string | null>(null);

  const decisionKey = review
    ? review.items.map((item) => `${item.omDecision}:${item.omApprovedQuantity}:${item.omRejectionReason ?? ""}`).join("|")
    : "";
  if (review && loadedFor !== `${review.id}:${review.status}:${decisionKey}`) {
    setLoadedFor(`${review.id}:${review.status}:${decisionKey}`);
    setDrafts(
      Object.fromEntries(
        review.items.map((item) => [
          item.id,
          {
            choice: item.supervisorDecision === "APPROVED" ? item.omDecision : "PENDING",
            quantity: item.omDecision === "APPROVED" ? item.omApprovedQuantity : item.supervisorApproved,
            reason: item.omRejectionReason ?? "",
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

  async function save() {
    if (!review) return;
    const decisions = review.items.flatMap((item) => {
      if (item.supervisorDecision !== "APPROVED") return [];
      const draft = drafts[item.id];
      if (!draft || draft.choice === "PENDING") return [];
      return [{
        itemId: item.id,
        decision: draft.choice,
        approvedQuantity: draft.choice === "APPROVED" ? draft.quantity : "0",
        rejectionReason: draft.choice === "REJECTED" ? draft.reason : "",
      }];
    });
    if (decisions.length === 0) {
      setError("Choose approve or reject for at least one material the supervisor approved.");
      return;
    }
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await decideOperationItemsAction(review.id, decisions, keyRef.current);
      if (!result.ok) {
        setError(result.error ?? "The decision was refused.");
        return;
      }
      setMessage(
        result.replayed
          ? "Those decisions were already recorded. Stock was not changed."
          : "Decisions saved. The store receives only the final approved quantity. Stock was not changed.",
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
      <Link href="/operation-manager" className="text-sm underline-offset-4 hover:underline">
        Back to operations
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
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <Info label="Team leader" value={review.teamLeaderName} />
              <Info label="Supervisor" value={review.supervisorName} />
              <Info label="Zone" value={review.zoneName} />
              <Info label="Request date" value={formatDubai(review.requestedAt)} />
              <Info label="Request status" value={STATUS_LABEL[review.status]} />
            </dl>
            {review.canOpenTicket ? (
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href={`/operation-manager/tickets/${review.id}`} className="font-medium underline">
                  View Ticket
                </Link>
                <Link href={`/operation-manager/tickets/${review.id}?print=1`} className="font-medium underline">
                  Print Ticket
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                The material issue ticket opens after the store confirms the issue.
              </p>
            )}
            {review.rejectionReason ? (
              <p className="text-sm text-muted-foreground">Reason: {review.rejectionReason}</p>
            ) : null}
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
          <p className="text-sm text-muted-foreground">
            Available stock is the quantity on hand. Approval does not reserve stock, and these
            figures cannot be edited here.
          </p>
          <div className="flex flex-col gap-3">
            {review.items.map((item) => {
              const draft = drafts[item.id] ?? {
                choice: item.omDecision,
                quantity: item.supervisorApproved,
                reason: item.omRejectionReason ?? "",
              };
              const open = review.canDecide && item.supervisorDecision === "APPROVED";
              return (
                <article key={item.id} className="flex flex-col gap-3 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.itemCode}</p>
                      <p className="text-base font-semibold">{item.productName}</p>
                      <p className="text-muted-foreground">
                        {item.categoryName} · {item.unit}
                        {item.active ? "" : " · Inactive"}
                      </p>
                    </div>
                    <SignalBadge signal={item.signal} />
                  </div>
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Info label="Requested quantity" value={`${item.quantityRequested} ${item.unit}`} />
                    <Info
                      label="Supervisor decision"
                      value={
                        item.supervisorDecision === "APPROVED"
                          ? `Approved · ${item.supervisorApproved} ${item.unit}`
                          : item.supervisorDecision === "REJECTED"
                            ? `Rejected${item.supervisorReason ? ` · ${item.supervisorReason}` : ""}`
                            : "Pending"
                      }
                    />
                    <Info
                      label="Supervisor"
                      value={
                        item.supervisorName
                          ? `${item.supervisorName}${item.supervisorDecidedAt ? ` · ${formatDubai(item.supervisorDecidedAt)}` : ""}`
                          : "Not recorded"
                      }
                    />
                    <Info
                      label="Operation manager decision"
                      value={
                        item.omDecision === "APPROVED"
                          ? `Approved · ${item.omApprovedQuantity} ${item.unit}`
                          : item.omDecision === "REJECTED"
                            ? `Rejected${item.omRejectionReason ? ` · ${item.omRejectionReason}` : ""}`
                            : "Pending"
                      }
                    />
                    <Info label="Current stock" value={`${item.currentStock} ${item.unit}`} />
                    <Info label="Committed / reserved" value="None" />
                    <Info label="Available stock" value={`${item.availableStock} ${item.unit}`} />
                    <Info label="Material status" value={item.active ? "Active" : "Inactive"} />
                    <Info
                      label="Latest stock receipt"
                      value={
                        item.latestReceiptDate
                          ? `${formatDubai(item.latestReceiptDate)}${item.latestReceiptQuantity ? ` · ${item.latestReceiptQuantity} ${item.unit}` : ""}`
                          : "No receipt recorded"
                      }
                    />
                  </dl>
                  <p className="text-sm">
                    Status: <SignalBadge signal={item.signal} />
                  </p>
                  <UsagePanel
                    usage={item.usage}
                    unit={item.unit}
                    requested={item.quantityRequested}
                    supervisorApproved={item.supervisorApproved}
                    currentStock={item.currentStock}
                    availableStock={item.availableStock}
                    signal={item.signal}
                  />
                  {item.allocations.length > 0 ? (
                    <PpeCheckList
                      checks={item.allocations}
                      productName={item.productName}
                      approvedLabel="Supervisor approved"
                      approvedQuantity={item.supervisorApproved}
                    />
                  ) : null}
                  {item.supervisorDecision !== "APPROVED" ? (
                    <p className="text-muted-foreground">
                      The supervisor did not approve this material. That decision stays as recorded.
                    </p>
                  ) : null}
                  {open ? (
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
                          onClick={() => update(item.id, { choice: "REJECTED" })}
                        >
                          Reject
                        </Button>
                      </div>
                      {draft.choice === "APPROVED" ? (
                        <label className="flex flex-col gap-2">
                          <span>Operation manager approved quantity ({item.unit})</span>
                          <Input
                            value={draft.quantity}
                            inputMode="decimal"
                            aria-label={`Operation manager approved quantity for ${item.itemCode}`}
                            className="h-10 max-w-40"
                            onChange={(event) => update(item.id, { quantity: event.target.value })}
                          />
                          <span className="text-xs text-muted-foreground">
                            Cannot be greater than the supervisor approved quantity of {item.supervisorApproved} {item.unit}.
                          </span>
                        </label>
                      ) : null}
                      {draft.choice === "REJECTED" ? (
                        <label className="flex flex-col gap-2">
                          <span>Rejection reason (optional)</span>
                          <textarea
                            value={draft.reason}
                            aria-label={`Rejection reason for ${item.itemCode}`}
                            className="min-h-20 rounded-lg border border-input bg-background px-2.5 py-2"
                            onChange={(event) => update(item.id, { reason: event.target.value })}
                          />
                        </label>
                      ) : null}
                      <DecisionBadge decision={draft.choice} />
                    </>
                  ) : null}
                </article>
              );
            })}
          </div>
          <PpeLines groups={review.ppe} />
          {review.history.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-base font-medium">Approval history</h2>
              <ul className="flex flex-col gap-2">
                {review.history.map((row) => (
                  <li key={row.id} className="rounded-lg border px-3 py-2 text-sm">
                    <p className="font-medium">
                      {row.stage === "SUPERVISOR" ? "Supervisor decision" : "Operation manager decision"}
                      {" · "}
                      {row.itemCode} {row.productName}
                    </p>
                    <p className="text-muted-foreground">
                      {row.actorName} · {DECISION_LABEL[row.decision]} · requested {row.quantityRequested}
                      {row.decision === "APPROVED" ? ` · approved ${row.approvedQuantity}` : ""}
                      {row.rejectionReason ? ` · ${row.rejectionReason}` : ""}
                      {" · "}
                      {formatDubai(row.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {review.canDecide ? (
            <Button type="button" size="lg" className="h-12 w-full text-base" disabled={pending} onClick={() => void save()}>
              Save decisions
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              This request is with the store. The supervisor and operation manager quantities stay as recorded.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

async function loadReview(id: string) {
  await openArea("operations");
  return getOperationReview(id);
}
