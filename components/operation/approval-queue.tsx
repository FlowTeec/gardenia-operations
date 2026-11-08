"use client";

import Link from "next/link";
import { Fragment, useMemo, useRef, useState } from "react";

import { SignalBadge, UsageBadge } from "@/components/operation/signal-badge";
import { daysSinceLabel, UsagePanel } from "@/components/operation/usage-details";
import { PpeCheckList } from "@/components/ppe/ppe-check";
import { formatDubaiDay } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bulkApproveOperationLinesAction, rejectOperationLineAction } from "@/lib/workspace/actions";
import type { OperationQueueGroup, OperationQueueLine } from "@/lib/workspace/types";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

type StockFilter = "all" | "pending" | "available" | "low" | "insufficient" | "selected";

const FILTERS: { id: StockFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending Approval" },
  { id: "available", label: "Available Stock" },
  { id: "low", label: "Low Stock" },
  { id: "insufficient", label: "Insufficient Stock" },
  { id: "selected", label: "Selected" },
];

export function ApprovalQueue({
  queue,
  onDone,
}: {
  queue: OperationQueueGroup[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<StockFilter>("pending");
  const [zone, setZone] = useState("all");
  const [supervisor, setSupervisor] = useState("all");
  const [leader, setLeader] = useState("all");
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState<OperationQueueLine[] | null>(null);
  const [rejecting, setRejecting] = useState<OperationQueueLine | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [openUsage, setOpenUsage] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);
  const rejectKeyRef = useRef<string | null>(null);
  const lock = useRef(false);

  const lines = useMemo(() => queue.flatMap((group) => group.lines), [queue]);
  const zones = unique(lines.map((line) => line.zoneName));
  const supervisors = unique(lines.map((line) => line.supervisorName));
  const leaders = unique(lines.map((line) => line.teamLeaderName));
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const visibleGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return queue
      .map((group) => ({
        ...group,
        lines: group.lines.filter((line) => {
          if (zone !== "all" && line.zoneName !== zone) return false;
          if (supervisor !== "all" && line.supervisorName !== supervisor) return false;
          if (leader !== "all" && line.teamLeaderName !== leader) return false;
          if (!matchesStock(line, filter, selectedSet)) return false;
          if (!needle) return true;
          return (
            line.requestNo.toLowerCase().includes(needle) ||
            line.itemCode.toLowerCase().includes(needle) ||
            line.productName.toLowerCase().includes(needle) ||
            line.teamLeaderName.toLowerCase().includes(needle)
          );
        }),
      }))
      .filter((group) => group.lines.length > 0);
  }, [queue, zone, supervisor, leader, filter, selectedSet, search]);

  const visibleLines = visibleGroups.flatMap((group) => group.lines);
  const visibleSelectable = visibleLines.filter((line) => line.selectable);
  const allVisibleSelected =
    visibleSelectable.length > 0 && visibleSelectable.every((line) => selectedSet.has(line.itemId));

  function toggle(itemId: string) {
    setSelected((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }

  function selectVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const line of visibleSelectable) next.delete(line.itemId);
      } else {
        for (const line of visibleSelectable) next.add(line.itemId);
      }
      return [...next];
    });
  }

  function selectGroup(group: OperationQueueGroup) {
    const ids = group.lines.filter((line) => line.selectable).map((line) => line.itemId);
    const every = ids.length > 0 && ids.every((id) => selectedSet.has(id));
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (every) next.delete(id);
        else next.add(id);
      }
      return [...next];
    });
  }

  function ask(target: OperationQueueLine[]) {
    setError(null);
    setMessage(null);
    setConfirming(target);
  }

  async function approve() {
    if (!confirming || lock.current) return;
    const eligible = confirming.filter((line) => line.selectable);
    if (eligible.length === 0) {
      setError("Inactive materials were not approved. Open the request to reject them.");
      setConfirming(null);
      return;
    }
    lock.current = true;
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await bulkApproveOperationLinesAction(
        eligible.map((line) => ({ requestId: line.requestId, itemId: line.itemId })),
        keyRef.current,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const approved = result.data?.approvedCount ?? eligible.length;
      const requests = result.data?.requestCount ?? new Set(eligible.map((line) => line.requestId)).size;
      setMessage(
        result.replayed
          ? "That approval was already recorded. Stock was not changed."
          : `Approved ${approved} ${approved === 1 ? "material" : "materials"} from ${requests} ${requests === 1 ? "request" : "requests"}. Final quantities match the supervisor. Stock was not changed.`,
      );
      setSelected((current) => current.filter((id) => !eligible.some((line) => line.itemId === id)));
      keyRef.current = null;
      setConfirming(null);
      onDone();
    } catch {
      setError("The approval could not be saved.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  function openReject(line: OperationQueueLine) {
    setError(null);
    setMessage(null);
    setConfirming(null);
    setRejectReason("");
    setRejecting(line);
  }

  async function confirmReject() {
    if (!rejecting || lock.current) return;
    const reason = rejectReason.trim();
    lock.current = true;
    if (!rejectKeyRef.current) rejectKeyRef.current = crypto.randomUUID();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await rejectOperationLineAction(
        { requestId: rejecting.requestId, itemId: rejecting.itemId, rejectionReason: reason },
        rejectKeyRef.current,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        result.replayed
          ? "That rejection was already recorded. Stock was not changed."
          : `${rejecting.productName} was rejected. The supervisor decision was kept. Stock was not changed.`,
      );
      setSelected((current) => current.filter((id) => id !== rejecting.itemId));
      rejectKeyRef.current = null;
      setRejecting(null);
      setRejectReason("");
      onDone();
    } catch {
      setError("The rejection could not be saved.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  const summary = confirming ? summarize(confirming) : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        Select the materials whose supervisor quantity can be issued, then approve them together.
        Last issue and the 30, 60, and 90 day totals are confirmed issues to this team leader.
        Open usage details for the last three issues. The last PPE issue for each employee is on the row.
        Approve or reject each material here. A rejection reason is optional. Rejected materials are not sent to the store.
        Approval does not change stock.
      </p>

      <div className="flex flex-col gap-3">
        <Label htmlFor="operation-search">Search</Label>
        <Input
          id="operation-search"
          value={search}
          placeholder="Request, material code, description, or team leader"
          className="h-10"
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Stock filters">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                filter === item.id ? "bg-foreground text-background" : "bg-background"
              }`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect id="operation-zone" label="Zone" value={zone} options={zones} onChange={setZone} />
          <FilterSelect id="operation-supervisor" label="Supervisor" value={supervisor} options={supervisors} onChange={setSupervisor} />
          <FilterSelect id="operation-leader" label="Team leader" value={leader} options={leaders} onChange={setLeader} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">
          {selected.length} {selected.length === 1 ? "material" : "materials"} selected
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="lg" onClick={selectVisible} disabled={visibleSelectable.length === 0}>
            {allVisibleSelected ? "Clear visible" : "Select all"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => setSelected([])} disabled={selected.length === 0}>
            Clear selection
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={selected.length === 0 || pending}
            onClick={() => ask(lines.filter((line) => selectedSet.has(line.itemId)))}
          >
            Approve selected
          </Button>
        </div>
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

      {queue.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
          No materials are waiting for an operation manager decision.
        </p>
      ) : null}
      {queue.length > 0 && visibleGroups.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
          No materials match these filters.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {visibleGroups.map((group) => {
          const groupSelectable = group.lines.filter((line) => line.selectable);
          const groupSelected = groupSelectable.length > 0 && groupSelectable.every((line) => selectedSet.has(line.itemId));
          return (
            <section key={group.requestId} className="overflow-hidden rounded-lg border">
              <div className="flex flex-col gap-3 border-b bg-muted/40 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">{group.requestNo}</h2>
                  <p className="text-sm">
                    Team leader: <span className="font-medium">{group.teamLeaderName}</span>
                  </p>
                  <p className="text-sm">
                    Supervisor: <span className="font-medium">{group.supervisorName}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{group.zoneName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="lg" disabled={groupSelectable.length === 0} onClick={() => selectGroup(group)}>
                    {groupSelected ? "Clear this request" : "Select all in this request"}
                  </Button>
                  <Button type="button" size="lg" onClick={() => ask(group.lines)}>
                    Approve request
                  </Button>
                  <Link
                    href={`/operation-manager/requests/${group.requestId}`}
                    className="inline-flex h-9 items-center rounded-lg border px-2.5 text-sm font-medium"
                  >
                    Review
                  </Link>
                </div>
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[96rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Select</th>
                      <th className="px-2 py-2 font-medium">Request</th>
                      <th className="px-2 py-2 font-medium">Team leader</th>
                      <th className="px-2 py-2 font-medium">Supervisor</th>
                      <th className="px-2 py-2 font-medium">Zone</th>
                      <th className="px-2 py-2 font-medium">Code</th>
                      <th className="px-2 py-2 font-medium">Material</th>
                      <th className="px-2 py-2 font-medium">Unit</th>
                      <th className="px-2 py-2 font-medium">Requested</th>
                      <th className="px-2 py-2 font-medium">Supervisor approved</th>
                      <th className="px-2 py-2 font-medium">Current stock</th>
                      <th className="px-2 py-2 font-medium">Available</th>
                      <th className="px-2 py-2 font-medium">Last issue</th>
                      <th className="px-2 py-2 font-medium">Last issue date</th>
                      <th className="px-2 py-2 font-medium">30d</th>
                      <th className="px-2 py-2 font-medium">60d</th>
                      <th className="px-2 py-2 font-medium">90d</th>
                      <th className="px-2 py-2 font-medium">Stock status</th>
                      <th className="px-2 py-2 font-medium">Usage</th>
                      <th className="px-2 py-2 font-medium">Approval status</th>
                      <th className="px-2 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.lines.map((line) => (
                      <Fragment key={line.itemId}>
                      <tr
                        className={`border-b align-top ${
                          line.signal === "Insufficient Stock" || !line.active
                            ? "tone-alert"
                            : aboveUsage(line)
                              ? "tone-watch"
                              : ""
                        }`}
                      >
                        <td className="px-2 py-3">
                          <input
                            type="checkbox"
                            className="size-4"
                            aria-label={`Select ${line.itemCode} on ${line.requestNo}`}
                            checked={selectedSet.has(line.itemId)}
                            disabled={!line.selectable || pending}
                            onChange={() => toggle(line.itemId)}
                          />
                        </td>
                        <td className="px-2 py-3 font-medium">{line.requestNo}</td>
                        <td className="px-2 py-3 font-medium">{line.teamLeaderName}</td>
                        <td className="px-2 py-3">{line.supervisorName}</td>
                        <td className="px-2 py-3">{line.zoneName}</td>
                        <td className="px-2 py-3">{line.itemCode}</td>
                        <td className="px-2 py-3">
                          <p className="font-semibold">{line.productName}</p>
                          <button
                            type="button"
                            className="text-xs font-medium underline"
                            aria-expanded={openUsage === line.itemId}
                            onClick={() => setOpenUsage((current) => (current === line.itemId ? null : line.itemId))}
                          >
                            {openUsage === line.itemId ? "Hide usage details" : "Usage details"}
                          </button>
                          {line.ppeChecks.length > 0 ? (
                            <p className="text-xs text-muted-foreground">Employee PPE history is under this row.</p>
                          ) : null}
                          {!line.selectable ? <p className="text-xs text-muted-foreground">This inactive material can be rejected. It cannot be approved from this table.</p> : null}
                        </td>
                        <td className="px-2 py-3">{line.unit}</td>
                        <td className="px-2 py-3 tabular-nums">{line.quantityRequested}</td>
                        <td className="px-2 py-3 font-semibold tabular-nums">{line.supervisorApproved} {line.unit}</td>
                        <td className="px-2 py-3 font-semibold tabular-nums">{line.currentStock} {line.unit}</td>
                        <td className="px-2 py-3 font-semibold tabular-nums">{line.availableStock} {line.unit}</td>
                        <td className="px-2 py-3 font-semibold tabular-nums whitespace-nowrap">
                          {line.usage.lastQuantity ? `${line.usage.lastQuantity} ${line.unit}` : "No Previous Issue"}
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap">
                          {line.usage.lastIssuedAt ? (
                            <>
                              <p className="font-semibold">{formatDubaiDay(line.usage.lastIssuedAt)}</p>
                              <p className="text-xs text-muted-foreground">{daysSinceLabel(line.usage.daysSince)}</p>
                            </>
                          ) : (
                            "No Previous Issue"
                          )}
                        </td>
                        <td className="px-2 py-3 tabular-nums whitespace-nowrap">{line.usage.days30} {line.unit}</td>
                        <td className="px-2 py-3 tabular-nums whitespace-nowrap">{line.usage.days60} {line.unit}</td>
                        <td className="px-2 py-3 tabular-nums whitespace-nowrap">{line.usage.days90} {line.unit}</td>
                        <td className="px-2 py-3"><SignalBadge signal={line.signal} /></td>
                        <td className="px-2 py-3"><UsageBadge level={line.usage.level} /></td>
                        <td className="px-2 py-3">{line.approvalStatus}</td>
                        <td className="px-2 py-3">
                          <div className="flex flex-col gap-1">
                            <Button type="button" size="sm" disabled={pending || !line.selectable} onClick={() => ask([line])}>
                              Approve
                            </Button>
                            <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => openReject(line)}>
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {line.ppeChecks.length > 0 ? (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={21} className="px-3 py-3">
                            <PpeCheckList
                              checks={line.ppeChecks}
                              productName={line.productName}
                              approvedLabel="Supervisor approved"
                              approvedQuantity={line.supervisorApproved}
                            />
                          </td>
                        </tr>
                      ) : null}
                      {openUsage === line.itemId ? (
                        <tr className="border-b bg-muted/30">
                          <td colSpan={21} className="px-3 py-3">
                            <UsagePanel
                              usage={line.usage}
                              unit={line.unit}
                              requested={line.quantityRequested}
                              supervisorApproved={line.supervisorApproved}
                              currentStock={line.currentStock}
                              availableStock={line.availableStock}
                              signal={line.signal}
                            />
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 p-3 md:hidden">
                {group.lines.map((line) => (
                  <article key={line.itemId} className={`rounded-lg border p-3 text-sm ${line.signal === "Insufficient Stock" || !line.active ? "tone-alert border-transparent" : aboveUsage(line) ? "tone-watch border-transparent" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{line.productName}</p>
                        <p className="text-muted-foreground">{line.itemCode} · {line.unit}</p>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-medium">
                        <input
                          type="checkbox"
                          className="size-4"
                          aria-label={`Select ${line.itemCode} on ${line.requestNo}`}
                          checked={selectedSet.has(line.itemId)}
                          disabled={!line.selectable || pending}
                          onChange={() => toggle(line.itemId)}
                        />
                        Select
                      </label>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2">
                      <Field label="Requested" value={`${line.quantityRequested} ${line.unit}`} />
                      <Field label="Supervisor approved" value={`${line.supervisorApproved} ${line.unit}`} />
                      <Field label="Current stock" value={`${line.currentStock} ${line.unit}`} />
                      <Field label="Available stock" value={`${line.availableStock} ${line.unit}`} />
                      <Field label="Last issue" value={line.usage.lastQuantity ? `${line.usage.lastQuantity} ${line.unit}` : "No Previous Issue"} />
                      <Field label="Last issue date" value={line.usage.lastIssuedAt ? `${formatDubaiDay(line.usage.lastIssuedAt)} · ${daysSinceLabel(line.usage.daysSince)}` : "No Previous Issue"} />
                      <Field label="30-day usage" value={`${line.usage.days30} ${line.unit}`} />
                      <Field label="60-day usage" value={`${line.usage.days60} ${line.unit}`} />
                      <Field label="90-day usage" value={`${line.usage.days90} ${line.unit}`} />
                    </dl>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <SignalBadge signal={line.signal} />
                      <UsageBadge level={line.usage.level} />
                      <span className="text-xs text-muted-foreground">{line.approvalStatus}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="lg" disabled={pending || !line.selectable} onClick={() => ask([line])}>
                        Approve
                      </Button>
                      <Button type="button" size="lg" variant="destructive" disabled={pending} onClick={() => openReject(line)}>
                        Reject
                      </Button>
                    </div>
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium underline"
                      aria-expanded={openUsage === line.itemId}
                      onClick={() => setOpenUsage((current) => (current === line.itemId ? null : line.itemId))}
                    >
                      {openUsage === line.itemId ? "Hide usage details" : "Usage details"}
                    </button>
                    {openUsage === line.itemId ? (
                      <div className="mt-2">
                        <UsagePanel
                          usage={line.usage}
                          unit={line.unit}
                          requested={line.quantityRequested}
                          supervisorApproved={line.supervisorApproved}
                          currentStock={line.currentStock}
                          availableStock={line.availableStock}
                          signal={line.signal}
                        />
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {line.requestNo} · {line.teamLeaderName} · {line.supervisorName} · {line.zoneName}
                    </p>
                    {line.ppeChecks.length > 0 ? (
                      <div className="mt-3">
                        <PpeCheckList
                          checks={line.ppeChecks}
                          productName={line.productName}
                          approvedLabel="Supervisor approved"
                          approvedQuantity={line.supervisorApproved}
                        />
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {confirming && summary ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-selected-title"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background p-4 shadow-lg"
          >
            <h2 id="approve-selected-title" className="text-lg font-semibold">Approve selected materials</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm leading-6">
              <p>You are about to approve {summary.eligible} {summary.eligible === 1 ? "material" : "materials"} from {summary.requests} {summary.requests === 1 ? "request" : "requests"}.</p>
              <p>{summary.sufficient} {summary.sufficient === 1 ? "material has" : "materials have"} sufficient stock.</p>
              <p>{summary.insufficient.length} {summary.insufficient.length === 1 ? "material has" : "materials have"} insufficient stock.</p>
              {summary.low > 0 ? (
                <p>{summary.low} {summary.low === 1 ? "material is" : "materials are"} at low stock. The quantity on hand matches the supervisor quantity.</p>
              ) : null}
              {summary.inactive.length > 0 ? (
                <p>Inactive materials will not be approved. Open the request to reject them.</p>
              ) : null}
              <p>The final approved quantity will match the supervisor approved quantity. Stock will not change.</p>
              {summary.above > 0 ? (
                <p>
                  {summary.above} {summary.above === 1 ? "material is" : "materials are"} above this team leader&apos;s 90-day actual usage.
                  Approval stays available.
                </p>
              ) : null}
            </div>
            {summary.insufficient.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {summary.insufficient.map((line) => (
                  <li key={line.itemId} className="tone-alert rounded-lg border border-transparent px-3 py-2">
                    <span className="font-medium">{line.productName}</span>
                    <span className="mt-1 block text-muted-foreground">
                      Supervisor approved {line.supervisorApproved} {line.unit}. Available stock {line.availableStock} {line.unit}.
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {summary.inactive.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {summary.inactive.map((line) => (
                  <li key={line.itemId} className="rounded-lg border px-3 py-2">
                    {line.itemCode} {line.productName} is inactive and will stay pending.
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3">
              <p className="text-sm font-medium">Final approved quantities</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {summary.preview.map((line) => (
                  <li key={line.itemId}>
                    {line.productName}: {line.supervisorApproved} {line.unit}
                  </li>
                ))}
                {summary.remaining > 0 ? <li>{summary.remaining} more materials at the supervisor quantity.</li> : null}
              </ul>
            </div>
            <p className="mt-3 text-sm">Continue?</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" size="lg" disabled={pending || summary.eligible === 0} onClick={() => void approve()}>
                Approve
              </Button>
              <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => setConfirming(null)}>
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
            aria-labelledby="reject-material-title"
            className="w-full max-w-lg rounded-lg bg-background p-4 shadow-lg"
          >
            <h2 id="reject-material-title" className="text-lg font-semibold">Reject Material</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Material</dt>
                <dd className="font-medium">{rejecting.productName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Requested quantity</dt>
                <dd>{rejecting.quantityRequested} {rejecting.unit}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Supervisor approved quantity</dt>
                <dd>{rejecting.supervisorApproved} {rejecting.unit}</dd>
              </div>
            </dl>
            <label className="mt-3 flex flex-col gap-2 text-sm">
              <span>Rejection reason (optional)</span>
              <textarea
                value={rejectReason}
                aria-label={`Rejection reason for ${rejecting.itemCode}`}
                className="min-h-24 rounded-lg border border-input bg-background px-2.5 py-2"
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </label>
            {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="lg"
                variant="destructive"
                disabled={pending}
                onClick={() => void confirmReject()}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function summarize(lines: OperationQueueLine[]) {
  const eligibleLines = lines.filter((line) => line.selectable);
  const insufficient = eligibleLines.filter((line) => line.signal === "Insufficient Stock");
  const low = eligibleLines.filter((line) => line.signal === "Low Stock").length;
  const sufficient = eligibleLines.filter((line) => line.signal === "Available" || line.signal === "Low Stock").length;
  return {
    eligible: eligibleLines.length,
    requests: new Set(eligibleLines.map((line) => line.requestId)).size,
    sufficient,
    low,
    above: eligibleLines.filter((line) => aboveUsage(line)).length,
    insufficient,
    inactive: lines.filter((line) => !line.selectable),
    preview: eligibleLines.slice(0, 8),
    remaining: Math.max(eligibleLines.length - 8, 0),
  };
}

function aboveUsage(line: OperationQueueLine) {
  return line.usage.level === "Above Historical Usage" || line.usage.level === "Above Recent Usage";
}

function matchesStock(line: OperationQueueLine, filter: StockFilter, selected: Set<string>) {
  if (filter === "all" || filter === "pending") return true;
  if (filter === "available") return line.signal === "Available";
  if (filter === "low") return line.signal === "Low Stock";
  if (filter === "insufficient") return line.signal === "Insufficient Stock";
  return selected.has(line.itemId);
}

function unique(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
