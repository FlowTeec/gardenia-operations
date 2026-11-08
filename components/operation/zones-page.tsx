"use client";

import { ZoneControl } from "@/components/operation/zone-control";
import { useServerData } from "@/components/use-server-data";
import { getOperationHome } from "@/lib/workspace/actions";

export function OperationZones() {
  const page = useServerData(getOperationHome);
  const data = page.data;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Zones</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Open or close each zone for today&apos;s new material requests. Closing a zone
          stops new requests only. Requests already in approval or fulfillment stay in place.
        </p>
      </div>
      {page.status === "loading" && !data ? <p className="text-sm text-muted-foreground">Loading zones…</p> : null}
      {page.status === "error" ? <p role="alert" className="text-sm text-destructive">{page.error}</p> : null}
      <ZoneControl
        today={data?.today ?? "Today"}
        zones={data?.zones ?? []}
        changes={data?.zoneChanges ?? []}
        onDone={() => page.reload()}
      />
    </div>
  );
}
