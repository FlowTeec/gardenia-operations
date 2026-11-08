-- Supervisor assignments and finalized material issue tickets.
--
-- This migration is not applied in the running app. Supabase Auth and
-- PostgreSQL are not connected, and the architecture tables in
-- ARCHITECTURE.md have not been created here. Apply it only after those
-- tables exist (profiles, material_requests, material_request_items, materials).
-- Until then the server stores assignments and tickets in data/workspace-demo.json.

alter table public.profiles
  add column if not exists zone_code text,
  add column if not exists supervisor_id uuid;

alter table public.profiles
  drop constraint if exists profiles_zone_code_check;

alter table public.profiles
  add constraint profiles_zone_code_check
  check (zone_code is null or zone_code in ('A', 'B', 'C', 'D', 'E'));

alter table public.profiles
  drop constraint if exists profiles_supervisor_id_fkey;

alter table public.profiles
  add constraint profiles_supervisor_id_fkey
  foreign key (supervisor_id) references public.profiles (id);

-- A team leader has at most one active supervisor because supervisor_id is a single column.
-- Zone matching is not a table check: it has to read the supervisor's zone_code.
-- ARCHITECTURE.md does not define an administrator role, so this file does not
-- grant an assignment function yet. Add that function when the administrator
-- role is part of the profiles check.

create table if not exists public.material_issue_tickets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.material_requests (id),
  ticket_no text not null unique,
  request_no integer not null,
  zone_code text not null check (zone_code in ('A', 'B', 'C', 'D', 'E')),
  team_leader_id uuid not null references public.profiles (id),
  supervisor_id uuid not null references public.profiles (id),
  store_keeper_id uuid not null references public.profiles (id),
  issued_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.material_issue_ticket_lines (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.material_issue_tickets (id),
  request_item_id uuid not null references public.material_request_items (id),
  item_code text not null,
  description text not null,
  unit text not null,
  quantity_requested numeric(12, 2) not null check (quantity_requested > 0),
  quantity_issued numeric(12, 2) not null check (quantity_issued >= 0),
  unique (ticket_id, request_item_id)
);

create index if not exists material_issue_tickets_supervisor_idx
  on public.material_issue_tickets (supervisor_id, issued_at desc);

alter table public.material_issue_tickets enable row level security;
alter table public.material_issue_ticket_lines enable row level security;

-- Reads: the supervisor recorded on the ticket, or a store keeper.
-- Inserts belong in issue_request, which is not in this migration.
-- There is no update or delete policy: a ticket is a historical record.

drop policy if exists tickets_select_responsible on public.material_issue_tickets;
create policy tickets_select_responsible
  on public.material_issue_tickets
  for select
  to authenticated
  using (
    supervisor_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'STORE_KEEPER'
    )
  );

drop policy if exists ticket_lines_select_responsible on public.material_issue_ticket_lines;
create policy ticket_lines_select_responsible
  on public.material_issue_ticket_lines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.material_issue_tickets
      where material_issue_tickets.id = ticket_id
        and (
          material_issue_tickets.supervisor_id = auth.uid()
          or exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.role = 'STORE_KEEPER'
          )
        )
    )
  );
