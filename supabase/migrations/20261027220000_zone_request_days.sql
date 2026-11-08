-- Daily zone request availability and its append-only audit.
--
-- This migration is not applied. PostgreSQL is not connected, and the
-- application does not query these tables. The demonstration file stores
-- the same facts.
--
-- A missing row for a zone and date means CLOSED. The application does not
-- copy one day's rows onto the next day, and it does not insert an OPEN row
-- automatically. Closing a zone does not change material requests.

create table if not exists public.zone_request_days (
  id uuid primary key,
  zone_code text not null,
  request_date date not null,
  status text not null check (status in ('OPEN', 'CLOSED')),
  note text,
  updated_by uuid,
  updated_at timestamptz not null,
  created_at timestamptz not null,
  unique (zone_code, request_date)
);

create table if not exists public.zone_request_changes (
  id uuid primary key,
  zone_code text not null,
  request_date date not null,
  previous_status text not null check (previous_status in ('OPEN', 'CLOSED')),
  new_status text not null check (new_status in ('OPEN', 'CLOSED')),
  note text,
  changed_by uuid,
  changed_at timestamptz not null
);

create index if not exists zone_request_changes_zone_date_idx
  on public.zone_request_changes (zone_code, request_date, changed_at desc);
