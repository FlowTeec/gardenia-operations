"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { PpeCheckList } from "@/components/ppe/ppe-check";
import { PpeLines } from "@/components/ppe-lines";
import { DecisionBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerData } from "@/components/use-server-data";
import { formatDubai } from "@/lib/format";
import { addQty, isPositiveQty, isZeroQty, parseQty, subQty } from "@/lib/workspace/decimal";
import { planEmployeeIssue } from "@/lib/workspace/ppe";
import {
  getRequestDetail,
  issueRequestAction,
  openArea,
  prepareRequestAction,
} from "@/lib/workspace/actions";
import type { PpeEmployeeCheck, RequestLine } from "@/lib/workspace/types";

export function RequestDetail({ id }: { id: string }) {
  const page = useServerData(() => loadDetail(id), id);
  const detail = page.data?.ok ? page.data.detail : null;
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [employeeEdits, setEmployeeEdits] = useState<Record<string, Record<string, string>>>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const keyRef = useRef<string | null>(null);
  const lock = useRef(false);

  if (detail && loadedFor !== detail.id) {
    setLoadedFor(detail.id);
    setQuantities(
      Object.fromEntries(
        detail.items.filter((item) => item.issuable).map((item) => [item.id, item.remaining]),
      ),
    );
    setEmployeeEdits({});
  }

  async function run(action: () => Promise<{ ok: boolean; error?: string; replayed?: boolean }>, success: string) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "The action was refused.");
        return;
      }
      setMessage(result.replayed ? "This issue was already recorded. Stock was not deducted again." : success);
      keyRef.current = null;
      page.reload();
    } catch {
      setError("The action could not be completed.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Link href="/store-keeper/approved" className="text-sm underline-offset-4 hover:underline">
        Back to approved requests
      </Link>
      {page.status === "loading" && !detail ? (
        <p className="text-sm text-muted-foreground">Loading request…</p>
      ) : null}
      {page.data && !page.data.ok ? (
        <p role="alert" className="text-sm text-destructive">{page.data.error}</p>
      ) : null}
      {page.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">{page.error}</p>
      ) : null}
      {detail ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{detail.requestNo}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{detail.zoneName} · {detail.teamLeaderName}</span>
              <StatusBadge status={detail.status} />
            </p>
            <p className="text-sm text-muted-foreground">
              Supervisor {detail.supervisorName}. Requested {formatDubai(detail.requestedAt)}.
              {detail.approvedAt ? ` Approved ${formatDubai(detail.approvedAt)}.` : ""}
            </p>
          </div>

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Item code</th>
                  <th className="px-2 py-2 font-medium">Material</th>
                  <th className="px-2 py-2 font-medium">Requested</th>
                  <th className="px-2 py-2 font-medium">Supervisor</th>
                  <th className="px-2 py-2 font-medium">Final approved</th>
                  <th className="px-2 py-2 font-medium">Rejected</th>
                  <th className="px-2 py-2 font-medium">Approval</th>
                  <th className="px-2 py-2 font-medium">Issued</th>
                  <th className="px-2 py-2 font-medium">Remaining</th>
                  <th className="px-2 py-2 font-medium">On hand</th>
                  <th className="px-2 py-2 font-medium">Issue now</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-2 py-2 font-medium">{item.itemCode}</td>
                    <td className="px-2 py-2">{item.productName}</td>
                    <td className="px-2 py-2">{item.quantityRequested} {item.unit}</td>
                    <td className="px-2 py-2">{item.supervisorApproved} {item.unit}</td>
                    <td className="px-2 py-2">{item.operationApproved} {item.unit}</td>
                    <td className="px-2 py-2">{item.rejectedQuantity} {item.unit}</td>
                    <td className="px-2 py-2"><DecisionBadge decision={item.decision} /></td>
                    <td className="px-2 py-2">{item.quantityIssued} {item.unit}</td>
                    <td className="px-2 py-2">{item.remaining} {item.unit}</td>
                    <td className="px-2 py-2 font-medium">{item.onHand} {item.unit}</td>
                    <td className="px-2 py-2">
                      {detail.canIssue && item.issuable ? (
                        <Input
                          aria-label={`Issue quantity for ${item.itemCode}`}
                          value={quantities[item.id] ?? ""}
                          className="h-9 w-28"
                          inputMode="decimal"
                          onChange={(event) => {
                            setQuantities((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }));
                            setEmployeeEdits((current) => {
                              if (!current[item.id]) return current;
                              const next = { ...current };
                              delete next[item.id];
                              return next;
                            });
                          }}
                        />
                      ) : (
                        item.decision === "REJECTED" ? "Not issued" : "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 md:hidden">
            {detail.items.map((item) => (
              <article key={item.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{item.itemCode}</p>
                <p>{item.productName}</p>
                <div className="mt-2"><DecisionBadge decision={item.decision} /></div>
                <p className="mt-2 text-muted-foreground">
                  Requested {item.quantityRequested} {item.unit} · Supervisor {item.supervisorApproved} {item.unit} · Final {item.operationApproved} {item.unit}
                </p>
                <p className="text-muted-foreground">
                  Issued {item.quantityIssued} {item.unit} · Remaining {item.remaining} {item.unit} · On hand {item.onHand} {item.unit}
                </p>
                {item.rejectionReason ? <p className="mt-1">Reason: {item.rejectionReason}</p> : null}
                {detail.canIssue && item.issuable ? (
                  <Input
                    aria-label={`Issue quantity for ${item.itemCode}`}
                    value={quantities[item.id] ?? ""}
                    className="mt-2 h-10"
                    inputMode="decimal"
                    onChange={(event) => {
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }));
                      setEmployeeEdits((current) => {
                        if (!current[item.id]) return current;
                        const next = { ...current };
                        delete next[item.id];
                        return next;
                      });
                    }}
                  />
                ) : null}
              </article>
            ))}
          </div>
          <PpeLines groups={detail.ppe} />
          {detail.items.some((item) => item.ppeChecks.length > 0) ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-base font-medium">PPE issue verification</h2>
              <p className="text-sm text-muted-foreground">
                Each employee is checked against their own last actual issue of this PPE. The status does not block the issue. Employee quantities must add up to the quantity being issued.
              </p>
              {detail.items.filter((item) => item.ppeChecks.length > 0).map((item) => {
                const split = employeeSplit(item, quantities[item.id] ?? "0", employeeEdits[item.id]);
                const issueQty = parseQty(quantities[item.id] ?? "");
                const assigned = split.reduce((sum, row) => addQty(sum, row.quantity) ?? sum, "0");
                const mismatch = Boolean(
                  issueQty && isPositiveQty(issueQty) && !isZeroQty(subQty(issueQty, assigned) ?? "1"),
                );
                return (
                  <article key={`ppe-${item.id}`} className="rounded-lg border p-3">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      Approved quantity {item.operationApproved} {item.unit}
                    </p>
                    <div className="mt-3">
                      <PpeCheckList
                        checks={item.ppeChecks}
                        productName={item.productName}
                        approvedLabel="Approved quantity"
                        approvedQuantity={item.operationApproved}
                      />
                    </div>
                    {detail.canIssue && item.issuable ? (
                      <div className="mt-3 flex flex-col gap-2">
                        {item.ppeChecks.map((check) => (
                          <label key={check.employeeId} className="flex flex-col gap-1 text-sm">
                            <span>
                              Issue to {check.employeeId} ({item.unit}) · allocated {check.quantity} · already issued {check.issuedOnRequest}
                            </span>
                            <Input
                              aria-label={`Issue quantity for ${check.employeeId} ${item.itemCode}`}
                              value={split.find((row) => row.employeeId === check.employeeId)?.quantity ?? "0"}
                              className="h-9 max-w-40"
                              inputMode="decimal"
                              onChange={(event) =>
                                setEmployeeEdits((current) => ({
                                  ...current,
                                  [item.id]: {
                                    ...(current[item.id] ?? Object.fromEntries(split.map((row) => [row.employeeId, row.quantity]))),
                                    [check.employeeId]: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        ))}
                        {mismatch ? (
                          <p className="text-sm text-destructive">
                            These employee quantities add up to {assigned} {item.unit}. They must equal the issue quantity of {quantities[item.id]} {item.unit}.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ) : null}

          <p className="text-sm leading-6 text-muted-foreground">
            Only the operation manager final approved quantity can be issued. Rejected materials stay on the request
            and are not handed out. Enter the quantities to hand over now. A partial issue
            stays Prepared and deducts just those quantities. Stock changes only when the
            issue is confirmed. Approval and printing do not change stock.
          </p>

          <div className="flex flex-wrap gap-2">
            {detail.canPrepare ? (
              <Button
                type="button"
                size="lg"
                disabled={pending}
                onClick={() =>
                  void run(
                    () => prepareRequestAction(detail.id),
                    "Marked prepared. Stock was not changed.",
                  )
                }
              >
                Mark prepared
              </Button>
            ) : null}
            {detail.canIssue ? (
              <Button
                type="button"
                size="lg"
                disabled={pending}
                onClick={() => {
                  if (!keyRef.current) keyRef.current = crypto.randomUUID();
                  const key = keyRef.current;
                  void run(
                    () =>
                      issueRequestAction(
                        detail.id,
                        detail.items
                          .filter((item) => item.issuable)
                          .map((item) => {
                            const quantity = quantities[item.id] ?? "0";
                            if (item.ppeChecks.length === 0) return { itemId: item.id, quantity };
                            const employees = employeeSplit(item, quantity, employeeEdits[item.id]).filter((row) =>
                              isPositiveQty(parseQty(row.quantity) ?? "0"),
                            );
                            return { itemId: item.id, quantity, employees };
                          }),
                        key,
                      ),
                    "Issue recorded. Stock was deducted for the quantities entered.",
                  );
                }}
              >
                Confirm issue
              </Button>
            ) : null}
            {detail.canPrint ? (
              <Link
                href={`/store-keeper/requests/${detail.id}/ticket`}
                className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium"
              >
                Print issue ticket
              </Link>
            ) : null}
          </div>

          {detail.receipts.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-base font-medium">Issue history</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {detail.receipts.map((receipt) => (
                  <li key={`${receipt.at}-${receipt.by}`} className="rounded-lg border px-3 py-2">
                    {formatDubai(receipt.at)} · {receipt.by}
                    <span className="text-muted-foreground">
                      {" "}
                      · {receipt.lines.map((line) => `${line.itemCode} ${line.quantity}`).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function remainingAllocation(check: PpeEmployeeCheck) {
  const left = subQty(check.quantity, check.issuedOnRequest);
  return left && isPositiveQty(left) ? left : "0";
}

function employeeSplit(item: RequestLine, quantity: string, edited: Record<string, string> | undefined) {
  if (edited) {
    return item.ppeChecks.map((check) => ({
      employeeId: check.employeeId,
      quantity: edited[check.employeeId] ?? "0",
    }));
  }
  return planEmployeeIssue(
    item.ppeChecks.map((check) => ({
      employeeId: check.employeeId,
      remaining: remainingAllocation(check),
    })),
    quantity,
  );
}

async function loadDetail(id: string) {
  await openArea("store");
  return getRequestDetail(id);
}
