import type { StockSignal, UsageLevel } from "@/lib/workspace/types";

const signalTone: Record<StockSignal, string> = {
  Available: "status-approved",
  "Low Stock": "status-pending",
  "Insufficient Stock": "status-rejected",
  "Inactive Material": "status-issued",
};

export function SignalBadge({ signal }: { signal: StockSignal }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${signalTone[signal]}`}>
      {signal}
    </span>
  );
}

const usageTone: Record<UsageLevel, string> = {
  "Normal Usage": "status-approved",
  "Above Historical Usage": "status-pending",
  "Above Recent Usage": "status-pending",
  "No Previous Issue": "status-issued",
};

export function UsageBadge({ level }: { level: UsageLevel }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${usageTone[level]}`}>
      {level}
    </span>
  );
}
