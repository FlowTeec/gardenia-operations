"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatDubai } from "@/lib/format";
import { setZoneRequestStatusAction } from "@/lib/workspace/actions";
import type { ZoneAvailability, ZoneChangeRow, ZoneControlRow } from "@/lib/workspace/types";

export function ZoneControl({
  today,
  zones,
  changes,
  onDone,
}: {
  today: string;
  zones: ZoneControlRow[];
  changes: ZoneChangeRow[];
  onDone: () => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle(zone: ZoneControlRow) {
    const next: ZoneAvailability = zone.status === "OPEN" ? "CLOSED" : "OPEN";
    setPendingCode(zone.code);
    setError(null);
    setMessage(null);
    try {
      const result = await setZoneRequestStatusAction({
        zoneCode: zone.code,
        status: next,
        note: notes[zone.code] ?? "",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotes((current) => ({ ...current, [zone.code]: "" }));
      setMessage(
        result.replayed
          ? `${zone.name} is already ${next === "OPEN" ? "open" : "closed"} for today.`
          : `${zone.name} is ${next === "OPEN" ? "open" : "closed"} for new requests today.`,
      );
      onDone();
    } catch {
      setError("The zone status could not be saved.");
    } finally {
      setPendingCode(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Today&apos;s Request Zones</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {today}. An open zone can submit new material requests. A closed zone cannot.
          Closing a zone does not cancel, reject, or stop requests that were already submitted.
          Yesterday&apos;s setting is not carried forward.
        </p>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium">Zone</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Updated</th>
              <th className="px-2 py-2 font-medium">Note</th>
              <th className="px-2 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.code} className="border-b align-middle">
                <td className="px-2 py-3 text-base font-semibold">{zone.name}</td>
                <td className="px-2 py-3"><ZoneStatus status={zone.status} /></td>
                <td className="px-2 py-3 text-muted-foreground">
                  {zone.updatedAt ? `${formatDubai(zone.updatedAt)} · ${zone.updatedByName}` : "Not set today"}
                </td>
                <td className="px-2 py-3">
                  <input
                    aria-label={`Note for ${zone.name}`}
                    className="h-10 w-full min-w-40 rounded-lg border border-input bg-background px-2.5 text-sm"
                    value={notes[zone.code] ?? ""}
                    placeholder="Optional"
                    maxLength={200}
                    onChange={(event) => setNotes((current) => ({ ...current, [zone.code]: event.target.value }))}
                  />
                </td>
                <td className="px-2 py-3">
                  <ZoneButton zone={zone} pending={pendingCode === zone.code} onClick={() => void toggle(zone)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {zones.map((zone) => (
          <article key={zone.code} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-semibold">{zone.name}</p>
              <ZoneStatus status={zone.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {zone.updatedAt ? `${formatDubai(zone.updatedAt)} · ${zone.updatedByName}` : "Not set today"}
            </p>
            <input
              aria-label={`Note for ${zone.name}`}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base"
              value={notes[zone.code] ?? ""}
              placeholder="Optional note"
              maxLength={200}
              onChange={(event) => setNotes((current) => ({ ...current, [zone.code]: event.target.value }))}
            />
            <ZoneButton zone={zone} pending={pendingCode === zone.code} onClick={() => void toggle(zone)} />
          </article>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Zone status changes</h3>
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No zone has been opened or closed yet.</p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {changes.map((change) => (
              <li key={change.id} className="rounded-lg border px-3 py-2 text-sm">
                <p className="font-medium">
                  {change.zoneName} · {change.previousStatus} → {change.newStatus}
                </p>
                <p className="text-muted-foreground">
                  {change.requestDate} · {formatDubai(change.changedAt)} · {change.changedByName}
                </p>
                {change.note ? <p>{change.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ZoneStatus({ status }: { status: ZoneAvailability }) {
  const open = status === "OPEN";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${
        open ? "zone-open-solid" : "zone-closed"
      }`}
    >
      {status}
    </span>
  );
}

function ZoneButton({
  zone,
  pending,
  onClick,
}: {
  zone: ZoneControlRow;
  pending: boolean;
  onClick: () => void;
}) {
  const opening = zone.status !== "OPEN";
  return (
    <Button
      type="button"
      variant={opening ? "default" : "outline"}
      disabled={pending}
      aria-label={`${opening ? "Open" : "Close"} requests for ${zone.name}`}
      onClick={onClick}
    >
      {pending ? "Saving…" : opening ? "Open Requests" : "Close Requests"}
    </Button>
  );
}
