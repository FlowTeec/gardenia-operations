"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerData } from "@/components/use-server-data";
import { formatDubai } from "@/lib/format";
import { getIssuedHistory } from "@/lib/workspace/actions";

export function IssuedHistory() {
  const page = useServerData(getIssuedHistory);
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (page.data?.rows ?? []).filter((row) => {
      if (!needle) return true;
      return (
        row.requestNo.toLowerCase().includes(needle) ||
        row.ticketNo.toLowerCase().includes(needle) ||
        row.zoneName.toLowerCase().includes(needle) ||
        row.teamLeaderName.toLowerCase().includes(needle) ||
        row.storeKeeperName.toLowerCase().includes(needle)
      );
    });
  }, [page.data, query]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Issued history</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Fully issued requests. Printing a ticket from here does not change stock.
        </p>
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <Label htmlFor="issued-search">Search</Label>
        <Input
          id="issued-search"
          value={query}
          placeholder="Request, ticket, zone, or name"
          className="h-10"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {page.status === "loading" && !page.data ? (
        <p className="text-sm text-muted-foreground">Loading issued requests…</p>
      ) : null}
      {page.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">{page.error}</p>
      ) : null}
      {page.data && rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
          No issued requests match.
        </p>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">Ticket</th>
                <th className="px-2 py-2 font-medium">Request</th>
                <th className="px-2 py-2 font-medium">Zone</th>
                <th className="px-2 py-2 font-medium">Team leader</th>
                <th className="px-2 py-2 font-medium">Store keeper</th>
                <th className="px-2 py-2 font-medium">Issued</th>
                <th className="px-2 py-2 font-medium">Lines</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="px-2 py-2">
                    <Link
                      href={`/store-keeper/requests/${row.id}/ticket`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.ticketNo}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <Link
                      href={`/store-keeper/requests/${row.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {row.requestNo}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{row.zoneName}</td>
                  <td className="px-2 py-2">{row.teamLeaderName}</td>
                  <td className="px-2 py-2">{row.storeKeeperName}</td>
                  <td className="px-2 py-2">{formatDubai(row.issuedAt)}</td>
                  <td className="px-2 py-2">{row.lineCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
