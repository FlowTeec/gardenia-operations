-- Lookup support for finalized material issue tickets by team leader.
--
-- This migration is not applied. PostgreSQL is not connected, and the
-- application does not query these tables.
--
-- The operation manager dashboard calculates consumption in one pass over
-- confirmed issue receipts, including a partial issue that has no finalized
-- ticket yet. Those receipts are not a separate table. This index only
-- covers finalized tickets (one row per fully issued request). It does not
-- copy transaction data and it does not include prepared or approved
-- quantities.

create index if not exists material_issue_tickets_leader_issued_idx
  on public.material_issue_tickets (team_leader_id, issued_at desc);

create index if not exists material_issue_ticket_lines_ticket_idx
  on public.material_issue_ticket_lines (ticket_id);
