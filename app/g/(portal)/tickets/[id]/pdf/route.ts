import { currentActor } from "@/lib/gardenia/auth";
import { canViewIssueTicket } from "@/lib/gardenia/access";
import { readWorkspace } from "@/lib/gardenia/store";
import { renderPlainPdf } from "@/lib/gardenia/ticket-pdf";
import { ticketPdfLines } from "@/lib/gardenia/ticket-document";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const actor = await currentActor();
  if (!actor) return new Response("Sign in required.", { status: 401 });

  const ws = await readWorkspace();
  const ticket = ws.issueTickets.find((item) => item.id === id);
  if (!ticket || !canViewIssueTicket(actor, ticket)) {
    return new Response("Ticket not found.", { status: 404 });
  }

  const pdf = renderPlainPdf(ticketPdfLines(ticket));
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ticket.ticketNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
