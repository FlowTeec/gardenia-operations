-- Operation manager approval stage.
--
-- This migration is not applied in the running app. Supabase Auth and
-- PostgreSQL are not connected, and the architecture tables in
-- ARCHITECTURE.md have not been created here. Apply it only after
-- material_requests, material_request_items, material_request_item_decisions,
-- and profiles exist.
-- Until then the server stores the second approval in data/workspace-demo.json.
--
-- OPERATION_MANAGER must be allowed by the profiles role check when that
-- check exists. This file does not grant inventory updates, stock receipts,
-- stock adjustments, or material issue to that role.

alter table public.material_requests
  drop constraint if exists material_requests_status_check;

alter table public.material_requests
  add constraint material_requests_status_check
  check (
    status in (
      'PENDING',
      'PENDING_OPERATION_MANAGER',
      'PARTIALLY_APPROVED',
      'FULLY_APPROVED',
      'APPROVED',
      'OPERATION_MANAGER_APPROVED',
      'REJECTED',
      'PREPARED',
      'ISSUED'
    )
  );

alter table public.material_requests
  add column if not exists operation_reviewed_by uuid references public.profiles (id),
  add column if not exists operation_reviewed_at timestamptz;

alter table public.material_request_items
  add column if not exists om_decision text not null default 'PENDING',
  add column if not exists om_approved_quantity numeric(12, 2) not null default 0,
  add column if not exists om_rejection_reason text,
  add column if not exists om_decided_by uuid references public.profiles (id),
  add column if not exists om_decided_at timestamptz;

-- Requests already past supervisor approval keep their store queue.
-- The operation manager quantity starts equal to the supervisor quantity.
update public.material_request_items as item
set
  om_decision = 'APPROVED',
  om_approved_quantity = item.approved_quantity,
  om_rejection_reason = null
from public.material_requests as request
where request.id = item.request_id
  and request.status in (
    'APPROVED',
    'FULLY_APPROVED',
    'PARTIALLY_APPROVED',
    'PREPARED',
    'ISSUED',
    'OPERATION_MANAGER_APPROVED'
  )
  and item.decision = 'APPROVED'
  and item.om_decision = 'PENDING';

alter table public.material_request_items
  drop constraint if exists material_request_items_om_decision_check;

alter table public.material_request_items
  add constraint material_request_items_om_decision_check
  check (om_decision in ('PENDING', 'APPROVED', 'REJECTED'));

-- A supervisor rejection still requires a non-blank reason. That check is in
-- 20261026120000_item_level_approvals.sql. An operation manager rejection
-- may leave om_rejection_reason null.
alter table public.material_request_items
  drop constraint if exists material_request_items_om_quantity_check;

alter table public.material_request_items
  add constraint material_request_items_om_quantity_check
  check (
    om_approved_quantity >= 0
    and (
      (om_decision = 'APPROVED' and om_approved_quantity > 0 and om_approved_quantity <= approved_quantity and om_rejection_reason is null)
      or (om_decision = 'REJECTED' and om_approved_quantity = 0 and (om_rejection_reason is null or length(trim(om_rejection_reason)) > 0))
      or (om_decision = 'PENDING' and om_approved_quantity = 0 and om_rejection_reason is null)
    )
  );

alter table public.material_request_item_decisions
  add column if not exists stage text not null default 'SUPERVISOR';

alter table public.material_request_item_decisions
  drop constraint if exists material_request_item_decisions_stage_check;

alter table public.material_request_item_decisions
  add constraint material_request_item_decisions_stage_check
  check (stage in ('SUPERVISOR', 'OPERATION_MANAGER'));

-- The approved quantity on an operation manager row cannot exceed the
-- supervisor approved quantity. That comparison needs the request item, so
-- it belongs in the approval function rather than this column check.
-- Historical supervisor rows are not updated when an operation manager decides.
