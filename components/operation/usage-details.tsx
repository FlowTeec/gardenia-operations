import type { ReactNode } from "react";

import { UsageBadge } from "@/components/operation/signal-badge";
import { formatDubaiDay } from "@/lib/format";
import type { MaterialUsage, StockSignal } from "@/lib/workspace/types";

export function daysSinceLabel(days: number | null) {
  if (days === null) return "No Previous Issue";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function UsagePanel({
  usage,
  unit,
  requested,
  supervisorApproved,
  currentStock,
  availableStock,
  signal,
}: {
  usage: MaterialUsage;
  unit: string;
  requested: string;
  supervisorApproved: string;
  currentStock: string;
  availableStock: string;
  signal: StockSignal;
}) {
  const qty = (value: string) => `${value} ${unit}`;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Usage details</h3>
        <UsageBadge level={usage.level} />
        {signal === "Insufficient Stock" ? (
          <span className="status-rejected inline-flex rounded-full px-2 py-0.5 text-xs font-medium">
            Insufficient Available Stock
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Block title="Current request">
          <Line label="Requested" value={qty(requested)} />
          <Line label="Supervisor approved" value={qty(supervisorApproved)} />
        </Block>
        <Block title="Current inventory">
          <Line label="Current stock" value={qty(currentStock)} />
          <Line label="Committed / reserved" value="None" />
          <Line label="Available stock" value={qty(availableStock)} />
        </Block>
        <Block title="Team leader consumption">
          <Line label="Last actual issue" value={usage.lastQuantity ? qty(usage.lastQuantity) : "No Previous Issue"} />
          <Line label="Last issue date" value={usage.lastIssuedAt ? formatDubaiDay(usage.lastIssuedAt) : "No Previous Issue"} />
          <Line label="Days since last issue" value={daysSinceLabel(usage.daysSince)} />
          <Line label="30-day consumption" value={qty(usage.days30)} />
          <Line label="60-day consumption" value={qty(usage.days60)} />
          <Line label="90-day consumption" value={qty(usage.days90)} />
          <Line label="Average monthly usage" value={usage.averageMonthly ? qty(usage.averageMonthly) : "Insufficient History"} />
        </Block>
        <Block title="Recent issues">
          {usage.recent.length === 0 ? (
            <p>No Previous Issue</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 font-medium">Actual issued</th>
                  <th className="py-1 font-medium">Ticket</th>
                </tr>
              </thead>
              <tbody>
                {usage.recent.map((issue) => (
                  <tr key={`${issue.reference}-${issue.issuedAt}-${issue.quantity}`} className="border-t">
                    <td className="py-1 pr-2">{formatDubaiDay(issue.issuedAt)}</td>
                    <td className="py-1 pr-2 tabular-nums">{qty(issue.quantity)}</td>
                    <td className="py-1">{issue.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Block>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Consumption is the quantity the store keeper confirmed. Approval does not reserve stock, so available stock equals the quantity on hand.
        Average monthly usage is the 90-day actual total ÷ 3, and only when this team leader&apos;s oldest issue of this material is at least 90 days ago.
        {usage.level === "Above Historical Usage" || usage.level === "Above Recent Usage"
          ? " The supervisor quantity is higher than the 90-day actual total. This does not change the quantity."
          : ""}
      </p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-background px-3 py-2">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      <div className="mt-1 flex flex-col gap-1">{children}</div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </p>
  );
}
