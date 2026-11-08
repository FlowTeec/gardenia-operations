"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApprovalQueue } from "@/components/operation/approval-queue";
import { RequestTable } from "@/components/operation/dashboard";
import { RecordTable } from "@/components/operation/record-table";
import { useServerData } from "@/components/use-server-data";
import { getOperationHome } from "@/lib/workspace/actions";

export type RequestTab = "pending" | "approved" | "rejected" | "progress" | "history";

const TAB_LABEL: Record<RequestTab, string> = {
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  progress: "In Progress",
  history: "Request History",
};

export function OperationRequests({ initialTab = "pending" }: { initialTab?: RequestTab }) {
  const page = useServerData(getOperationHome);
  const router = useRouter();
  const [tab, setTab] = useState<RequestTab>(initialTab);
  const [tabSource, setTabSource] = useState(initialTab);
  if (tabSource !== initialTab) {
    setTabSource(initialTab);
    setTab(initialTab);
  }
  const data = page.data;
  const counts: Record<RequestTab, number> = {
    pending: data?.pendingMaterials ?? 0,
    approved: data?.approvedLines.length ?? 0,
    rejected: data?.rejectedLines.length ?? 0,
    progress: data?.inProgressRequests.length ?? 0,
    history: data?.history.length ?? 0,
  };

  function selectTab(next: RequestTab) {
    setTab(next);
    const href = next === "pending" ? "/operation-manager/requests" : `/operation-manager/requests?tab=${next}`;
    router.replace(href, { scroll: false });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Approve or reject each material after the supervisor. A decision here does not
          deduct stock. The store keeper prepares and confirms the physical issue.
        </p>
      </div>
      {data ? (
        <p className="text-sm text-muted-foreground">Signed in as {data.actor.displayName}.</p>
      ) : null}
      {page.status === "loading" && !data ? <p className="text-sm text-muted-foreground">Loading requests…</p> : null}
      {page.status === "error" ? <p role="alert" className="text-sm text-destructive">{page.error}</p> : null}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Request filters">
        {(Object.keys(TAB_LABEL) as RequestTab[]).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium ${tab === item ? "bg-foreground text-background" : "bg-background"}`}
            onClick={() => selectTab(item)}
          >
            {TAB_LABEL[item]}
            <span className="ml-2 tabular-nums">{counts[item]}</span>
          </button>
        ))}
      </div>
      {tab === "pending" ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            Pending Approval — {data?.pendingMaterials ?? 0} {(data?.pendingMaterials ?? 0) === 1 ? "material" : "materials"}
          </h2>
          <ApprovalQueue queue={data?.queue ?? []} onDone={() => page.reload()} />
        </div>
      ) : null}
      {tab === "approved" ? <RecordTable mode="approved" rows={data?.approvedLines ?? []} /> : null}
      {tab === "rejected" ? <RecordTable mode="rejected" rows={data?.rejectedLines ?? []} /> : null}
      {tab === "progress" ? (
        <RequestTable
          rows={data?.inProgressRequests ?? []}
          empty="No requests are still in progress."
          showTicket
        />
      ) : null}
      {tab === "history" ? (
        <div className="flex flex-col gap-6">
          <RecordTable mode="history" rows={data?.history ?? []} />
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Issued requests</h2>
            <RequestTable
              rows={data?.issuedRequests ?? []}
              empty="No requests have been issued."
              showTicket
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
