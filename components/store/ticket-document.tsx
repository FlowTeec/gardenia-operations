import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { AutoPrint, PrintButton } from "@/components/store/print-button";
import { APPLICATION_NAME } from "@/lib/brand";
import { formatDubai, STATUS_LABEL } from "@/lib/format";
import type { Ticket } from "@/lib/workspace/types";

export function TicketDocument({
  ticket,
  backHref = "/store-keeper/issued",
  autoPrint = false,
}: {
  ticket: Ticket;
  backHref?: string;
  autoPrint?: boolean;
}) {
  return (
    <article className="mx-auto min-h-svh max-w-3xl border-t-4 border-brand bg-white px-6 py-8 text-neutral-950">
      {autoPrint ? <AutoPrint /> : null}
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="text-sm text-neutral-600 underline">
          Back
        </Link>
        <PrintButton />
      </div>
      <header className="flex flex-col gap-3 border-b border-neutral-300 pb-4 sm:flex-row sm:items-center">
        <BrandLogo height={48} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{APPLICATION_NAME}</p>
          <p className="mt-1 text-sm">{ticket.facility}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-wide">{ticket.title}</h1>
        </div>
      </header>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <Item label="Issue ticket number" value={ticket.ticketNo} />
        <Item label="Request number" value={ticket.requestNo} />
        <Item label="Zone" value={ticket.zone} />
        <Item label="Team leader" value={ticket.teamLeader} />
        <Item label="Assigned supervisor" value={ticket.supervisor} />
        <Item label="Store keeper" value={ticket.storeKeeper} />
        <Item
          label="Issue date and time"
          value={ticket.issueAt ? formatDubai(ticket.issueAt) : "Not issued"}
        />
        <Item label="Status" value={STATUS_LABEL[ticket.status]} />
      </dl>
      <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-400">
            <th className="py-2 pr-2 font-medium">Item code</th>
            <th className="py-2 pr-2 font-medium">Description</th>
            <th className="py-2 pr-2 font-medium">Unit</th>
            <th className="py-2 pr-2 font-medium">Requested</th>
            <th className="py-2 pr-2 font-medium">Supervisor approved</th>
            <th className="py-2 pr-2 font-medium">Operation manager approved</th>
            <th className="py-2 font-medium">Actually issued quantity</th>
          </tr>
        </thead>
        <tbody>
          {ticket.lines.map((line) => (
            <tr key={line.itemCode} className="border-b border-neutral-200">
              <td className="py-2 pr-2">{line.itemCode}</td>
              <td className="py-2 pr-2">{line.description}</td>
              <td className="py-2 pr-2">{line.unit}</td>
              <td className="py-2 pr-2">{line.requested}</td>
              <td className="py-2 pr-2">{line.supervisorApproved}</td>
              <td className="py-2 pr-2">{line.approved}</td>
              <td className="py-2">{line.issued}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="mt-3 text-sm">Total line items: {ticket.lineCount}</p>
      <p className="mt-1 text-sm text-neutral-700">
        Supervisor approved is the supervisor decision. Operation manager approved is the quantity the store can issue. Actually issued quantity is what the store keeper handed out.
      </p>
      {ticket.notes ? (
        <p className="mt-3 text-sm">
          <span className="font-medium">Notes. </span>
          {ticket.notes}
        </p>
      ) : null}
      {ticket.ppe.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-sm font-medium">PPE by employee ID</h2>
          <ul className="mt-2 text-sm">
            {ticket.ppe.map((line) => (
              <li key={`${line.employeeId}-${line.itemCode}`}>
                {line.employeeId} · {line.itemCode} · {line.description} · allocated {line.quantity} {line.unit}
                {line.issued ? ` · issued ${line.issued} ${line.unit}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        <Signature label="Receiver signature" />
        <Signature label="Store keeper signature" />
      </div>
    </article>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div>
      <div className="h-12 border-b border-neutral-400" />
      <p className="mt-2 text-sm">{label}</p>
    </div>
  );
}
