-- Replay-safe additive persistence for canonical multi-supplier identity and operations.
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

alter table public.bookings
  add column if not exists supplier_provider text,
  add column if not exists supplier_contract_version text;

-- PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS. Canonical signatures distinguish
-- constraints created here from same-name drift and make replay fail closed.
do $migration$
declare
  item record;
  existing_oid oid;
  existing_type "char";
  existing_signature text;
begin
  for item in
    select * from (values
      ('public.offers', 'offers_supplier_provider_format_check',
       $$check (supplier_provider is null or supplier_provider ~ '^[a-z][a-z0-9_-]{1,63}$')$$,
       'hajiz:ms-b1:offers_supplier_provider_format:v1'),
      ('public.offers', 'offers_contract_version_check',
       $$check (contract_version is null or contract_version = 'flight-offer/v1')$$,
       'hajiz:ms-b1:offers_contract_version:v1'),
      ('public.offers', 'offers_supplier_amount_check',
       $$check (supplier_amount is null or supplier_amount > 0)$$,
       'hajiz:ms-b1:offers_supplier_amount:v1'),
      ('public.offers', 'offers_supplier_currency_check',
       $$check (supplier_currency is null or supplier_currency ~ '^[A-Z]{3}$')$$,
       'hajiz:ms-b1:offers_supplier_currency:v1'),
      ('public.offers', 'offers_supplier_reference_payload_check',
       $$check (jsonb_typeof(supplier_reference_payload) = 'object' and pg_column_size(supplier_reference_payload) <= 16384)$$,
       'hajiz:ms-b1:offers_supplier_reference_payload:v1'),
      ('public.bookings', 'bookings_supplier_provider_format_check',
       $$check (supplier_provider is null or supplier_provider ~ '^[a-z][a-z0-9_-]{1,63}$')$$,
       'hajiz:ms-b1:bookings_supplier_provider_format:v1'),
      ('public.bookings', 'bookings_supplier_contract_version_check',
       $$check (supplier_contract_version is null or supplier_contract_version = 'flight-offer/v1')$$,
       'hajiz:ms-b1:bookings_supplier_contract_version:v1')
    ) as constraints(table_name, constraint_name, definition, signature)
  loop
    select constraint_row.oid,
           constraint_row.contype,
           obj_description(constraint_row.oid, 'pg_constraint')
      into existing_oid, existing_type, existing_signature
      from pg_catalog.pg_constraint as constraint_row
     where constraint_row.conrelid = to_regclass(item.table_name)
       and constraint_row.conname = item.constraint_name;

    if existing_oid is null then
      execute format('alter table %s add constraint %I %s', item.table_name, item.constraint_name, item.definition);
      execute format('comment on constraint %I on %s is %L', item.constraint_name, item.table_name, item.signature);
    elsif existing_type <> 'c' or existing_signature is distinct from item.signature then
      raise exception 'constraint % on % exists with a non-canonical definition', item.constraint_name, item.table_name;
    end if;

    existing_oid := null;
    existing_type := null;
    existing_signature := null;
  end loop;
end
$migration$;

create table if not exists app_private.supplier_operations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  offer_id uuid references public.offers(id),
  provider text not null
    constraint supplier_operations_provider_check
    check (provider ~ '^[a-z][a-z0-9_-]{1,63}$'),
  operation text not null
    constraint supplier_operations_operation_check
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
    constraint supplier_operations_idempotency_key_check
    check (length(idempotency_key) between 1 and 255),
  provider_operation_ref text,
  status text not null default 'pending'
    constraint supplier_operations_status_check
    check (status in ('pending', 'succeeded', 'failed', 'unknown')),
  request_digest text not null
    constraint supplier_operations_request_digest_check
    check (request_digest ~ '^[a-f0-9]{64}$'),
  result_metadata jsonb not null default '{}'::jsonb
    constraint supplier_operations_result_metadata_check
    check (jsonb_typeof(result_metadata) = 'object' and pg_column_size(result_metadata) <= 16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_operations_provider_idempotency_unique unique (provider, idempotency_key)
);

-- Index signatures also reject same-name drift instead of accepting IF NOT EXISTS.
do $migration$
declare
  item record;
  existing_index regclass;
  existing_signature text;
begin
  for item in
    select * from (values
      ('public.offers_internal_offer_key_unique',
       'create unique index offers_internal_offer_key_unique on public.offers (internal_offer_key) where internal_offer_key is not null',
       'hajiz:ms-b1:offers_internal_offer_key_unique:v1'),
      ('public.offers_provider_offer_ref_unique',
       'create unique index offers_provider_offer_ref_unique on public.offers (supplier_provider, supplier_offer_ref) where supplier_provider is not null and supplier_offer_ref is not null',
       'hajiz:ms-b1:offers_provider_offer_ref_unique:v1'),
      ('public.offers_legacy_offer_ref_unique',
       'create unique index offers_legacy_offer_ref_unique on public.offers (supplier_offer_ref) where supplier_provider is null and supplier_offer_ref is not null',
       'hajiz:ms-b1:offers_legacy_offer_ref_unique:v1'),
      ('app_private.supplier_operations_booking_created_idx',
       'create index supplier_operations_booking_created_idx on app_private.supplier_operations (booking_id, created_at desc)',
       'hajiz:ms-b1:supplier_operations_booking_created_idx:v1'),
      ('app_private.supplier_operations_live_unique',
       $$create unique index supplier_operations_live_unique on app_private.supplier_operations (booking_id, provider, operation) where status in ('pending', 'unknown')$$,
       'hajiz:ms-b1:supplier_operations_live_unique:v1')
    ) as indexes(index_name, definition, signature)
  loop
    existing_index := to_regclass(item.index_name);
    if existing_index is null then
      execute item.definition;
      existing_index := to_regclass(item.index_name);
      execute format('comment on index %s is %L', existing_index, item.signature);
    else
      select obj_description(existing_index::oid, 'pg_class') into existing_signature;
      if existing_signature is distinct from item.signature then
        raise exception 'index % exists with a non-canonical definition', item.index_name;
      end if;
    end if;

    existing_index := null;
    existing_signature := null;
  end loop;
end
$migration$;

create or replace function app_private.enforce_supplier_operation_identity_immutable()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, app_private
as $$
begin
  if new.booking_id is distinct from old.booking_id
     or new.provider is distinct from old.provider
     or new.operation is distinct from old.operation
     or new.idempotency_key is distinct from old.idempotency_key
     or new.request_digest is distinct from old.request_digest then
    raise exception 'supplier operation identity and request digest are immutable';
  end if;
  return new;
end;
$$;

revoke all on function app_private.enforce_supplier_operation_identity_immutable() from public, anon, authenticated;
grant execute on function app_private.enforce_supplier_operation_identity_immutable() to service_role;

drop trigger if exists supplier_operations_identity_immutable on app_private.supplier_operations;
create trigger supplier_operations_identity_immutable
before update on app_private.supplier_operations
for each row execute function app_private.enforce_supplier_operation_identity_immutable();

create or replace function app_private.enforce_booking_supplier_identity_immutable()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, app_private
as $$
begin
  if (old.supplier_provider is not null and new.supplier_provider is distinct from old.supplier_provider)
     or (old.supplier_contract_version is not null and new.supplier_contract_version is distinct from old.supplier_contract_version) then
    raise exception 'booking supplier identity is immutable once assigned';
  end if;
  return new;
end;
$$;

revoke all on function app_private.enforce_booking_supplier_identity_immutable() from public, anon, authenticated;
grant execute on function app_private.enforce_booking_supplier_identity_immutable() to service_role;

drop trigger if exists bookings_supplier_identity_immutable on public.bookings;
create trigger bookings_supplier_identity_immutable
before update of supplier_provider, supplier_contract_version on public.bookings
for each row execute function app_private.enforce_booking_supplier_identity_immutable();

alter table app_private.supplier_operations enable row level security;

revoke all on table app_private.supplier_operations from public, anon, authenticated;
grant select, insert, update on table app_private.supplier_operations to service_role;
