-- Additive persistence design for canonical multi-supplier identity and operations.
-- This migration is intentionally not applied by the Batch 1 code-only work.

alter table public.offers
  add column if not exists internal_offer_key text,
  add column if not exists supplier_provider text,
  add column if not exists contract_version text,
  add column if not exists supplier_amount numeric(20, 8),
  add column if not exists supplier_currency text,
  add column if not exists supplier_reference_payload jsonb not null default '{}'::jsonb;

alter table public.offers
  drop constraint if exists offers_supplier_offer_ref_key;

alter table public.offers
  add constraint offers_supplier_provider_format_check
    check (supplier_provider is null or supplier_provider ~ '^[a-z][a-z0-9_-]{1,63}$'),
  add constraint offers_contract_version_check
    check (contract_version is null or contract_version = 'flight-offer/v1'),
  add constraint offers_supplier_amount_check
    check (supplier_amount is null or supplier_amount > 0),
  add constraint offers_supplier_currency_check
    check (supplier_currency is null or supplier_currency ~ '^[A-Z]{3}$'),
  add constraint offers_supplier_reference_payload_check
    check (
      jsonb_typeof(supplier_reference_payload) = 'object'
      and pg_column_size(supplier_reference_payload) <= 16384
    );

create unique index if not exists offers_internal_offer_key_unique
  on public.offers (internal_offer_key)
  where internal_offer_key is not null;

create unique index if not exists offers_provider_offer_ref_unique
  on public.offers (supplier_provider, supplier_offer_ref)
  where supplier_provider is not null and supplier_offer_ref is not null;

alter table public.bookings
  add column if not exists supplier_provider text,
  add column if not exists supplier_contract_version text;

alter table public.bookings
  add constraint bookings_supplier_provider_format_check
    check (supplier_provider is null or supplier_provider ~ '^[a-z][a-z0-9_-]{1,63}$'),
  add constraint bookings_supplier_contract_version_check
    check (
      supplier_contract_version is null
      or supplier_contract_version = 'flight-offer/v1'
    );

create table if not exists app_private.supplier_operations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  offer_id uuid references public.offers(id),
  provider text not null
    check (provider ~ '^[a-z][a-z0-9_-]{1,63}$'),
  operation text not null
    check (operation in (
      'search_flights',
      'reprice',
      'create_booking',
      'confirm_booking',
      'get_booking_status',
      'retrieve_ticket',
      'cancel',
      'change',
      'hold'
    )),
  idempotency_key text not null
    check (length(idempotency_key) between 1 and 255),
  provider_operation_ref text,
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'unknown')),
  request_digest text not null
    check (request_digest ~ '^[a-f0-9]{64}$'),
  result_metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(result_metadata) = 'object'
      and pg_column_size(result_metadata) <= 16384
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, idempotency_key)
);

create index if not exists supplier_operations_booking_created_idx
  on app_private.supplier_operations (booking_id, created_at desc);

alter table app_private.supplier_operations enable row level security;

revoke all on table app_private.supplier_operations from public, anon, authenticated;
grant select, insert, update on table app_private.supplier_operations to service_role;
