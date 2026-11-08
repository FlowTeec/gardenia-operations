export const instant = false;
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/gardenia/auth";
import { canViewIssueTicket } from "@/lib/gardenia/access";
import { readWorkspace } from "@/lib/gardenia/store";
import { IssueTicketView } from "@/components/gardenia/issue-ticket-view";

export const metadata: Metadata = { title: "Issue Ticket" };

export default async function IssueTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(["salesperson", "branch_manager", "branch_storekeeper", "management"]);
  const ws = await readWorkspace();
  const ticket = ws.issueTickets.find((item) => item.id === id);
  if (!ticket || !canViewIssueTicket(actor, ticket)) notFound();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href={`/g/requests/${ticket.salesRequestId}`} className="text-sm text-green-700 hover:text-green-800 font-medium print:hidden">
        Back to request {ticket.requestNumber}
      </Link>
      <div className="mt-3">
        <IssueTicketView ticket={ticket} />
      </div>
    </div>
  );
}
