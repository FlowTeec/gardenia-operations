"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerData } from "@/components/use-server-data";
import {
  activatePpeIntervalAction,
  addPpeIntervalAction,
  getOperationHome,
  removePpeIntervalAction,
  updatePpeIntervalAction,
} from "@/lib/workspace/actions";

type Notice = { kind: "ok" | "error"; text: string } | null;

export function PpeIntervalSection() {
  const page = useServerData(getOperationHome);
  const [days, setDays] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDays, setEditDays] = useState("");
  const [confirm, setConfirm] = useState<{ id: string; kind: "activate" | "remove"; days: number } | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const intervals = page.data?.ppeIntervals ?? [];
  const active = intervals.find((interval) => interval.active) ?? null;

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    if (pending) return false;
    setPending(true);
    setNotice(null);
    try {
      const result = await action();
      if (!result.ok) {
        setNotice({ kind: "error", text: result.error ?? "The interval could not be saved." });
        return false;
      }
      setNotice({ kind: "ok", text: success });
      setConfirm(null);
      setEditingId(null);
      page.reload();
      return true;
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error && error.message ? error.message : "The interval could not be saved.",
      });
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">PPE replacement interval</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Eligibility compares the days since an employee&apos;s last actual issue of the same PPE with the active interval.
          {active ? ` The active interval is ${active.days} days.` : ""} The status does not approve, reject, or block a request or an issue.
        </p>
      </div>

      {page.status === "loading" && !page.data ? <p className="text-sm text-muted-foreground">Loading intervals…</p> : null}
      {page.status === "error" && !page.data ? (
        <p role="alert" className="text-sm text-destructive">{page.error}</p>
      ) : null}
      {notice ? (
        <p role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {notice.text}
        </p>
      ) : null}

      {intervals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No replacement interval is saved yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">Days</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {intervals.map((interval) => (
                <tr key={interval.id} className="border-b">
                  <td className="px-2 py-2 font-medium tabular-nums">
                    {editingId === interval.id ? (
                      <Input
                        aria-label={`Days for the ${interval.days}-day interval`}
                        inputMode="numeric"
                        className="h-11 max-w-28"
                        value={editDays}
                        disabled={pending}
                        onChange={(event) => setEditDays(event.target.value)}
                      />
                    ) : (
                      interval.days
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={
                        interval.active
                          ? "status-approved inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                          : "inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {interval.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      {editingId === interval.id ? (
                        <>
                          <Button
                            type="button"
                            className="h-11"
                            disabled={pending}
                            onClick={() => {
                              const next = Number(editDays);
                              void run(
                                () => updatePpeIntervalAction(interval.id, next),
                                interval.active
                                  ? "Active interval updated. PPE eligibility uses this number of days."
                                  : "Interval updated. PPE eligibility still uses the active interval.",
                              );
                            }}
                          >
                            Save
                          </Button>
                          <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11"
                          disabled={pending}
                          onClick={() => {
                            setEditingId(interval.id);
                            setEditDays(String(interval.days));
                            setConfirm(null);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {interval.active ? null : (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11"
                          disabled={pending}
                          onClick={() => setConfirm({ id: interval.id, kind: "activate", days: interval.days })}
                        >
                          Activate
                        </Button>
                      )}
                      {interval.active ? null : (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11"
                          disabled={pending}
                          onClick={() => setConfirm({ id: interval.id, kind: "remove", days: interval.days })}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirm ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <p className="text-sm leading-6">
            {confirm.kind === "activate"
              ? `Use the ${confirm.days}-day interval for PPE eligibility? The current active interval will become inactive.`
              : `Remove the inactive ${confirm.days}-day interval? PPE eligibility keeps using the active interval.`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11"
              disabled={pending}
              onClick={() => {
                if (confirm.kind === "activate") {
                  void run(
                    () => activatePpeIntervalAction(confirm.id),
                    "Interval activated. PPE eligibility now uses this number of days.",
                  );
                  return;
                }
                void run(() => removePpeIntervalAction(confirm.id), "Inactive interval removed.");
              }}
            >
              {confirm.kind === "activate" ? "Activate" : "Remove"}
            </Button>
          </div>
        </div>
      ) : null}

      <form
        className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const next = Number(days);
          void run(() => addPpeIntervalAction(next), "Interval added. It stays inactive until you activate it.").then((saved) => {
            if (saved) setDays("");
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span>New interval in days</span>
          <Input
            aria-label="New PPE replacement interval in days"
            inputMode="numeric"
            className="h-11 w-full sm:w-40"
            value={days}
            disabled={pending}
            onChange={(event) => setDays(event.target.value)}
          />
        </label>
        <Button type="submit" className="h-11" disabled={pending}>
          Add interval
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        The active interval cannot be removed. Activate another interval first. Adding an interval does not change eligibility until it is activated.
      </p>
    </section>
  );
}
