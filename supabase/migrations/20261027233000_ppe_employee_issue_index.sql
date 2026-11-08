-- Employee-level PPE issues for the replacement-cycle check.
--
-- This migration is not applied. PostgreSQL is not connected, and the
-- application does not query this table. The demonstration file stores the
-- same facts on each confirmed issue receipt: employee ID, material, actual
-- issued quantity, issue time, store keeper, and the material issue ticket
-- reference. Requested and approved quantities are not copied here.
--
-- A receipt line with no employee split is not backfilled. The application
-- reports "No PPE History" for that material instead of treating it as an
-- issue to a particular employee.
--
-- The lookup is one employee and one PPE material. The index supports
-- "latest actual issue" without scanning every historical row in the client.

create table if not exists public.ppe_issue_lines (
  id uuid primary key,
  employee_id text not null,
  material_id uuid not null,
  quantity numeric not null,
  issued_at timestamptz not null,
  issued_by uuid not null,
  request_id uuid,
  ticket_reference text
);

create index if not exists ppe_issue_lines_employee_material_issued_idx
  on public.ppe_issue_lines (employee_id, material_id, issued_at desc);
