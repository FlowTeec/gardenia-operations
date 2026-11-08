-- Item-level supervisor decisions.
--
-- This migration is not applied in the running app. Supabase Auth and
-- PostgreSQL are not connected, and the architecture tables in
-- ARCHITECTURE.md have not been created here. Apply it only after
-- material_requests and material_request_items exist.
-- Until then the server stores decisions in data/workspace-demo.json.

alter table public.material_requests
  drop constraint if exists material_requests_status_check;

alter table public.material_requests
  add constraint material_requests_status_check
  check (
    status in (
      'PENDING',
      'PARTIALLY_APPROVED',
      'FULLY_APPROVED',
      'APPROVED',
      'REJECTED',
      'PREPARED',
      'ISSUED'
    )
  );

alter table public.material_request_items
  add column if not exists decision text not null default 'PENDING',
  add column if not exists approved_quantity numeric(12, 2) not null default 0,
  add column if not exists rejection_reason text,
  add column if not exists decided_by uuid references public.profiles (id),
  add column if not exists decided_at timestamptz;

alter table public.material_request_items
  drop constraint if exists material_request_items_decision_check;

alter table public.material_request_items
  add constraint material_request_items_decision_check
  check (decision in ('PENDING', 'APPROVED', 'REJECTED'));

alter table public.material_request_items
  drop constraint if exists material_request_items_approved_quantity_check;

alter table public.material_request_items
  add constraint material_request_items_approved_quantity_check
  check (
    approved_quantity >= 0
    and approved_quantity <= quantity_requested
    and (
      (decision = 'APPROVED' and approved_quantity > 0 and rejection_reason is null)
      or (decision = 'REJECTED' and approved_quantity = 0 and rejection_reason is not null and length(trim(rejection_reason)) > 0)
      or (decision = 'PENDING' and approved_quantity = 0 and rejection_reason is null)
    )
  );

create table if not exists public.material_request_item_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.material_requests (id),
  request_item_id uuid not null references public.material_request_items (id),
  material_id uuid not null references public.materials (id),
  supervisor_id uuid not null references public.profiles (id),
  decision text not null check (decision in ('APPROVED', 'REJECTED')),
  quantity_requested numeric(12, 2) not null check (quantity_requested > 0),
  approved_quantity numeric(12, 2) not null check (approved_quantity >= 0),
  rejection_reason text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  check (
    (decision = 'APPROVED' and approved_quantity > 0 and approved_quantity <= quantity_requested and rejection_reason is null)
    or (decision = 'REJECTED' and approved_quantity = 0 and rejection_reason is not null and length(trim(rejection_reason)) > 0)
  )
);

create unique index if not exists material_request_item_decisions_key_idx
  on public.material_request_item_decisions (request_id, idempotency_key, request_item_id)
  where idempotency_key is not null;

alter table public.material_request_item_decisions enable row level security;

-- The supervisor recorded on the decision, or a store keeper, can read it.
-- Inserts belong in the approval function, which is not created here because
-- the base request tables and role check are not in this repository yet.

drop policy if exists item_decisions_select_responsible on public.material_request_item_decisions;
create policy item_decisions_select_responsible
  on public.material_request_item_decisions
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
