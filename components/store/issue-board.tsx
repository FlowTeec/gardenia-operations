"use client";

import Link from "next/link";

import { PpeCheckSummary } from "@/components/ppe/ppe-check";
import { PpeLines } from "@/components/ppe-lines";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerData } from "@/components/use-server-data";
import { formatDubai, STATUS_LABEL } from "@/lib/format";
import { getIssueBoard } from "@/lib/workspace/actions";
import type { RequestCard, RequestStatus } from "@/lib/workspace/types";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

export function IssueBoard({
  title,
  description,
  statuses,
}: {
  title: string;
  description: string;
  statuses: RequestStatus[];
}) {
  const page = useServerData(() => getIssueBoard(statuses), statuses.join(","));
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("all");
  const [status, setStatus] = useState("all");

  const zones = page.data?.zones;
  const filtered = useMemo(
    () =>
      (zones ?? []).map((entry) => ({
        ...entry,
        leaders: entry.leaders
          .map((leader) => ({
            ...leader,
            requests: leader.requests.filter((request) =>
              matches(request, query, zone, status),
            ),
          }))
          .filter((leader) => leader.requests.length > 0),
      })),
    [zones, query, zone, status],
  );
  const zoneOptions = zones ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        {page.data ? (
          <p className="text-sm text-muted-foreground">
            Signed in as {page.data.actor.displayName}. Pending and rejected requests stay off this queue.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2 sm:col-span-1">
          <Label htmlFor="queue-search">Search</Label>
          <Input
            id="queue-search"
            value={query}
            placeholder="Team leader, zone, or request number"
            className="h-10"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="queue-zone">Zone</Label>
          <select
            id="queue-zone"
            className={fieldClass}
            value={zone}
            onChange={(event) => setZone(event.target.value)}
          >
            <option value="all">All zones</option>
            {zoneOptions.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="queue-status">Status</Label>
          <select
            id="queue-status"
            className={fieldClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All shown statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {STATUS_LABEL[item]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {page.status === "loading" && !page.data ? (
        <p className="text-sm text-muted-foreground">Loading requests…</p>
      ) : null}
      {page.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">{page.error}</p>
      ) : null}

      <div className="flex flex-col gap-3">
        {filtered.map((entry) => (
          <details key={entry.code} open className="rounded-lg border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              {entry.name}
              <span className="ml-2 font-normal text-muted-foreground">
                Supervisor {entry.supervisorName}
              </span>
            </summary>
            <div className="flex flex-col gap-4 border-t px-4 py-4">
              {entry.leaders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No requests in {entry.name} match this queue.
                </p>
              ) : (
                entry.leaders.map((leader) => (
                  <section key={leader.id} className="flex flex-col gap-2">
                    <h2 className="text-sm font-medium">{leader.name}</h2>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {leader.requests.map((request) => (
                        <RequestCardView key={request.id} request={request} />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function RequestCardView({ request }: { request: RequestCard }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border px-3 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{request.teamLeaderName}</p>
          <p className="text-muted-foreground">{request.zoneName}</p>
        </div>
        <p className="text-xs font-medium">{STATUS_LABEL[request.status]}</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Request number</dt>
          <dd>{request.requestNo}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Request date</dt>
          <dd>{formatDubai(request.requestedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Assigned supervisor</dt>
          <dd>{request.supervisorName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Approval date</dt>
          <dd>{formatDubai(request.approvedAt)}</dd>
        </div>
      </dl>
      <ul className="flex flex-col gap-1">
        {request.items.map((item) => (
          <li key={`${request.id}-${item.name}`}>
            {item.name} · requested {item.quantity} {item.unit} · supervisor {item.approvedQuantity} {item.unit} · final {item.finalQuantity} {item.unit}
          </li>
        ))}
      </ul>
      <PpeLines groups={request.ppe} />
      <PpeCheckSummary checks={request.ppeChecks} />
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/store-keeper/requests/${request.id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          Open request
        </Link>
        {request.canPrint ? (
          <Link
            href={`/store-keeper/requests/${request.id}/ticket`}
            className="underline-offset-4 hover:underline"
          >
            Print issue ticket
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function matches(request: RequestCard, query: string, zone: string, status: string) {
  if (zone !== "all" && request.zoneCode !== zone) return false;
  if (status !== "all" && request.status !== status) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    request.teamLeaderName.toLowerCase().includes(needle) ||
    request.zoneName.toLowerCase().includes(needle) ||
    request.zoneCode.toLowerCase() === needle ||
    request.requestNo.toLowerCase().includes(needle) ||
    STATUS_LABEL[request.status].toLowerCase().includes(needle)
  );
}
