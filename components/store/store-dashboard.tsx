"use client";

import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useServerData } from "@/components/use-server-data";
import { getStoreDashboard } from "@/lib/workspace/actions";

const links = [
  {
    href: "/store-keeper/inventory",
    title: "Inventory Management",
    body: "Add materials, record receipts and adjustments, open a material history, and export an Excel report.",
  },
  {
    href: "/store-keeper/approved",
    title: "Approved Requests by Zone",
    body: "ZONE A through ZONE E. Requests that are approved and still waiting to be issued.",
  },
  {
    href: "/store-keeper/prepared",
    title: "Prepared Requests",
    body: "Materials gathered and waiting for the issue confirmation.",
  },
  {
    href: "/store-keeper/issued",
    title: "Issued History",
    body: "Requests that were fully issued, with the ticket and the store keeper who issued them.",
  },
];

export function StoreDashboard() {
  const page = useServerData(getStoreDashboard);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Store</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Prepare approved requests and issue them from stock. Stock changes
          when a request is issued, not when it is approved or printed.
        </p>
        {page.data ? (
          <p className="text-sm text-muted-foreground">
            Signed in as {page.data.actor.displayName}.
          </p>
        ) : null}
      </div>

      {page.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">{page.error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Count
          label="Pending issuance"
          value={page.data?.pendingIssuance}
          note="Approved or prepared, and not yet issued."
        />
        <Count
          label="Prepared"
          value={page.data?.prepared}
          note="Included in pending issuance."
        />
        <Count
          label="Issued"
          value={page.data?.issued}
          note="Fully issued. Stock was already deducted."
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {links.map((link) => (
          <Card key={link.href}>
            <CardHeader>
              <CardTitle>
                <Link href={link.href} className="underline-offset-4 hover:underline">
                  {link.title}
                </Link>
              </CardTitle>
              <CardDescription>{link.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={link.href}
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                Open
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Count({
  label,
  value,
  note,
}: {
  label: string;
  value: number | undefined;
  note: string;
}) {
  return (
    <div className="summary-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value ?? "—"}</p>
      <p className="text-xs leading-5 text-muted-foreground">{note}</p>
    </div>
  );
}
