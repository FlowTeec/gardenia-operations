import { connection } from "next/server";
import { redirect } from "next/navigation";

import { TicketDocument } from "@/components/store/ticket-document";
import { portalPath } from "@/lib/workspace/access";
import { currentActor } from "@/lib/workspace/session";
import { readWorkspace } from "@/lib/workspace/store";
import { ticketForActor } from "@/lib/workspace/views";

export const metadata = { title: "Material issue ticket" };
export const instant = false;

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const actor = await currentActor();
  if (!actor) redirect("/");
  if (actor.role !== "STORE_KEEPER") redirect(portalPath(actor.role));
  const state = await readWorkspace();
  const ticket = ticketForActor(state, actor, id);
  if (!ticket) {
    return (
      <p className="p-8 text-sm">
        This request does not have an issue ticket yet. Mark it prepared first.
        Opening this page does not change stock.
      </p>
    );
  }
  return <TicketDocument ticket={ticket} />;
}
