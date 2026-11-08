-- Not applied. The demonstration app does not query these tables.
-- Adds the supervisor's approved quantity beside the quantity the store issued.
-- Depends on material_issue_ticket_lines from
-- 20261025183000_supervisor_assignments_and_issue_tickets.sql.
-- That migration, and the base tables in ARCHITECTURE.md, are also not applied.

alter table public.material_issue_ticket_lines
  add column if not exists quantity_approved numeric(12, 2);

update public.material_issue_ticket_lines
set quantity_approved = quantity_requested
where quantity_approved is null;

alter table public.material_issue_ticket_lines
  alter column quantity_approved set not null;

alter table public.material_issue_ticket_lines
  drop constraint if exists material_issue_ticket_lines_quantity_approved_check;

alter table public.material_issue_ticket_lines
  add constraint material_issue_ticket_lines_quantity_approved_check
  check (quantity_approved >= 0);
