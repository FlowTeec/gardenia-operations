import { connection } from "next/server";
import { redirect } from "next/navigation";

import { TicketDocument } from "@/components/store/ticket-document";
import { portalPath } from "@/lib/workspace/access";
import { currentActor } from "@/lib/workspace/session";
import { readWorkspace } from "@/lib/workspace/store";
import { ticketForActor } from "@/lib/workspace/views";

export const metadata = { title: "Material issue ticket" };
export const instant = false;

export default async function SupervisorTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  await connection();
  const { id } = await params;
  const { print } = await searchParams;
  const actor = await currentActor();
  if (!actor) redirect("/");
  if (actor.role !== "SUPERVISOR") redirect(portalPath(actor.role));
  const state = await readWorkspace();
  const ticket = ticketForActor(state, actor, id);
  if (!ticket) {
    return (
      <p className="p-8 text-sm">
        This finalized ticket is not on your list. Opening this page does not change stock.
      </p>
    );
  }
  return (
    <TicketDocument
      ticket={ticket}
      backHref="/supervisor?tab=issued"
      autoPrint={print === "1"}
    />
  );
}
