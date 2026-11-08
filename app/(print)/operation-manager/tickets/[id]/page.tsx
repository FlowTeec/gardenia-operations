import { connection } from "next/server";
import { redirect } from "next/navigation";

import { TicketDocument } from "@/components/store/ticket-document";
import { portalPath } from "@/lib/workspace/access";
import { currentActor } from "@/lib/workspace/session";
import { readWorkspace } from "@/lib/workspace/store";
import { ticketForActor } from "@/lib/workspace/views";

export const metadata = { title: "Material issue ticket" };
export const instant = false;

export default async function OperationTicketPage({
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
  if (actor.role !== "OPERATION_MANAGER") redirect(portalPath(actor.role));
  const state = await readWorkspace();
  const ticket = ticketForActor(state, actor, id);
  if (!ticket) {
    return (
      <p className="p-8 text-sm">
        This ticket is not available yet. Opening this page does not change stock.
      </p>
    );
  }
  return (
    <TicketDocument
      ticket={ticket}
      backHref="/operation-manager?tab=issued"
      autoPrint={print === "1"}
    />
  );
}
