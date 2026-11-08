export const instant = false;
import type { Metadata } from "next";
import Link from "next/link";
import { requireActor } from "@/lib/gardenia/auth";
import { canViewIssueTicket } from "@/lib/gardenia/access";
import { readWorkspace } from "@/lib/gardenia/store";
import { PageHeader } from "@/components/gardenia/page-header";
import { StatusBadge } from "@/components/gardenia/status-badge";
import { formatAed } from "@/lib/gardenia/money";

export const metadata: Metadata = { title: "Issue Tickets" };

export default async function IssueTicketsPage() {
  const actor = await requireActor(["salesperson", "branch_manager", "branch_storekeeper", "management"]);
  const ws = await readWorkspace();
  const tickets = ws.issueTickets
    .filter((ticket) => canViewIssueTicket(actor, ticket))
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Issue tickets" subtitle="Permanent records of materials issued from branch stock." />
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {tickets.length === 0 ? (
          <p className="px-5 py-10 text-center text-gray-500">No issue tickets yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <Link key={ticket.id} href={`/g/tickets/${ticket.id}`} className="block px-5 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-gray-800">{ticket.ticketNumber}</span>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-1">{ticket.customerName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ticket.requestNumber} · {ticket.branchName} · {ticket.salespersonName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatAed(ticket.totalValue)}</p>
                    <p className="text-xs text-gray-400">{new Date(ticket.issuedAt).toLocaleString()}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
