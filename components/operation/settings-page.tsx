"use client";

import Link from "next/link";

import { PpeIntervalSection } from "@/components/operation/ppe-intervals";

export function OperationSettings() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Manage the PPE replacement interval used when this role reviews PPE. Account and assignment
          changes stay on the existing Administration screens. Zone opening and closing is on{" "}
          <Link href="/operation-manager/zones" className="underline-offset-4 hover:underline">Zones</Link>.
        </p>
      </div>
      <PpeIntervalSection />
    </div>
  );
}
