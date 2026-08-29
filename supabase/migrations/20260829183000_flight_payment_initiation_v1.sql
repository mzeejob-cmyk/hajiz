-- HAJIZ B12: private payment-initiation reservation and atomic canonical
-- booking/payment materialization. Additive only; not applied by this batch.

create table app_private.flight_payment_initiations (
  id uuid primary key default gen_random_uuid(),
  booking_intent_id uuid not null unique
    references app_private.flight_booking_intents(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  payment_method public.payment_method not null
    check (payment_method in ('bankak', 'card')),
  idempotency_key text not null
    check (idempotency_key ~ '^hpi_req_[A-Za-z0-9_-]{16,80}$'),
  request_digest text not null
    check (request_digest ~ '^[0-9a-f]{64}$'),
  booking_id uuid not null unique,
  booking_ref text not null unique
    check (booking_ref ~ '^HJZ-[0-9A-F]{12}$'),
  payment_id uuid not null unique,
  payment_reference text not null unique
    check (payment_reference ~ '^PAY-[0-9A-F]{12}$'),
  state text not null default 'PREPARED'
    check (state in ('PREPARED', 'MATERIALIZED')),
  provider_name text,
  provider_payment_id text,
  provider_session_token text,
  provider_redirect_url text,
  psp_live boolean not null default false,
  payment_expires_at timestamptz,
  handoff_digest text
    check (handoff_digest is null or handoff_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  materialized_at timestamptz,
  constraint flight_payment_initiations_owner_idempotency_unique
    unique (owner_id, idempotency_key),
  constraint flight_payment_initiations_materialized_shape_check
    check (
      (state = 'PREPARED' and materialized_at is null and handoff_digest is null) or
      (state = 'MATERIALIZED' and materialized_at is not null and
       payment_expires_at is not null and handoff_digest is not null)
    )
);

create index flight_payment_initiations_owner_created_idx
  on app_private.flight_payment_initiations(owner_id, created_at desc);

alter table app_private.flight_payment_initiations enable row level security;
alter table app_private.flight_payment_initiations no force row level security;

create policy flight_payment_initiations_direct_access_denied
on app_private.flight_payment_initiations
for all
to anon, authenticated
using (false)
with check (false);

revoke all on table app_private.flight_payment_initiations
  from public, anon, authenticated, service_role;

create or replace function public.prepare_flight_payment_initiation_v1(
  p_owner_id uuid,
  p_booking_intent_id text,
  p_payment_method public.payment_method,
  p_idempotency_key text,
  p_request_digest text
)
returns table(
  booking_id uuid,
  booking_ref text,
  payment_id uuid,
  payment_reference text,
  initiation_state text,
  payment_method public.payment_method,
  booking_status public.booking_status,
  payment_status public.payment_status,
  amount numeric,
  currency text,
  expires_at timestamptz,
  amount_sdg numeric,
  bank_account_display_name text,
  masked_account_number text,
  provider_session_token text,
  provider_redirect_url text,
  psp_live boolean,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent app_private.flight_booking_intents%rowtype;
  v_offer public.offers%rowtype;
  v_initiation app_private.flight_payment_initiations%rowtype;
begin
  if p_owner_id is null then
    raise exception 'trusted payment owner is required' using errcode = '28000';
  end if;
  if p_payment_method is null
     or p_payment_method not in ('bankak', 'card')
     or p_idempotency_key is null
     or p_idempotency_key !~ '^hpi_req_[A-Za-z0-9_-]{16,80}$'
     or p_request_digest is null
     or p_request_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid payment initiation identity' using errcode = '22023';
  end if;

  select intent.*
    into strict v_intent
    from app_private.flight_booking_intents intent
   where intent.owner_id = p_owner_id
     and intent.booking_intent_id = p_booking_intent_id
   for update;

  if v_intent.status <> 'READY_FOR_PAYMENT'
     or v_intent.valid_until <= now()
     or jsonb_typeof(v_intent.customer_price_snapshot) <> 'object'
     or coalesce(v_intent.customer_price_snapshot->>'amount', '') !~ '^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$'
     or coalesce(v_intent.customer_price_snapshot->>'currency', '') !~ '^[A-Z]{3}$'
     or coalesce(v_intent.customer_price_snapshot->>'validUntil', '') = ''
     or (v_intent.customer_price_snapshot->>'validUntil')::timestamptz <= now()
     or jsonb_typeof(v_intent.traveler_snapshot) <> 'array'
     or jsonb_array_length(v_intent.traveler_snapshot) = 0
     or jsonb_typeof(v_intent.contact_snapshot) <> 'object' then
    raise exception 'booking intent is not current and complete' using errcode = '22023';
  end if;

  select offer.*
    into strict v_offer
    from public.offers offer
   where offer.internal_offer_key = v_intent.internal_offer_id
     and offer.supplier_provider = v_intent.provider
     and offer.supplier_offer_ref = v_intent.provider_offer_ref
     and offer.enabled
     and offer.expires_at > now()
     and offer.selling_amount = (v_intent.customer_price_snapshot->>'amount')::numeric
     and offer.currency = v_intent.customer_price_snapshot->>'currency'
   for share;

  if v_offer.net_cost > v_offer.selling_amount then
    raise exception 'trusted offer economics are invalid' using errcode = '22023';
  end if;

  insert into app_private.flight_payment_initiations (
    booking_intent_id,
    owner_id,
    payment_method,
    idempotency_key,
    request_digest,
    booking_id,
    booking_ref,
    payment_id,
    payment_reference
  ) values (
    v_intent.id,
    p_owner_id,
    p_payment_method,
    p_idempotency_key,
    p_request_digest,
    gen_random_uuid(),
    'HJZ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    gen_random_uuid(),
    'PAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  )
  on conflict do nothing
  returning * into v_initiation;

  if not found then
    select initiation.*
      into v_initiation
      from app_private.flight_payment_initiations initiation
     where initiation.owner_id = p_owner_id
       and initiation.idempotency_key = p_idempotency_key
     for update;

    if not found then
      select initiation.*
        into strict v_initiation
        from app_private.flight_payment_initiations initiation
       where initiation.booking_intent_id = v_intent.id
       for update;
    end if;

    if v_initiation.booking_intent_id <> v_intent.id
       or v_initiation.owner_id <> p_owner_id
       or v_initiation.payment_method <> p_payment_method
       or v_initiation.idempotency_key <> p_idempotency_key
       or v_initiation.request_digest <> p_request_digest then
      raise exception 'payment initiation idempotency conflict' using errcode = '23505';
    end if;
  end if;

  return query
    select v_initiation.booking_id,
           v_initiation.booking_ref,
           v_initiation.payment_id,
           v_initiation.payment_reference,
           v_initiation.state,
           v_initiation.payment_method,
           booking.status,
           payment.status,
           payment.amount,
           payment.currency,
           payment.expires_at,
           payment.amount_sdg,
           payment.bank_account_display_name,
           payment.masked_account_number,
           v_initiation.provider_session_token,
           v_initiation.provider_redirect_url,
           v_initiation.psp_live,
           v_initiation.state = 'MATERIALIZED'
      from (select 1) anchor
      left join public.bookings booking on booking.id = v_initiation.booking_id
      left join public.payments payment on payment.id = v_initiation.payment_id;
exception
  when no_data_found then
    raise exception 'trusted booking intent or persisted offer is unavailable' using errcode = 'P0002';
end;
$$;

revoke all on function public.prepare_flight_payment_initiation_v1(
  uuid, text, public.payment_method, text, text
) from public, anon, authenticated;
grant execute on function public.prepare_flight_payment_initiation_v1(
  uuid, text, public.payment_method, text, text
) to service_role;

create or replace function public.materialize_flight_payment_initiation_v1(
  p_owner_id uuid,
  p_booking_intent_id text,
  p_idempotency_key text,
  p_request_digest text,
  p_provider_name text,
  p_provider_payment_id text,
  p_provider_session_token text,
  p_provider_redirect_url text,
  p_psp_live boolean,
  p_payment_expires_at timestamptz,
  p_bank_account_display_name text,
  p_masked_account_number text,
  p_handoff_digest text
)
returns table(
  booking_id uuid,
  booking_ref text,
  payment_id uuid,
  payment_reference text,
  initiation_state text,
  payment_method public.payment_method,
  booking_status public.booking_status,
  payment_status public.payment_status,
  amount numeric,
  currency text,
  expires_at timestamptz,
  amount_sdg numeric,
  bank_account_display_name text,
  masked_account_number text,
  provider_session_token text,
  provider_redirect_url text,
  psp_live boolean,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent app_private.flight_booking_intents%rowtype;
  v_offer public.offers%rowtype;
  v_initiation app_private.flight_payment_initiations%rowtype;
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;
  v_fx public.fx_config%rowtype;
  v_amount numeric;
  v_currency text;
  v_amount_sdg numeric;
  v_fx_rate numeric;
  v_expires_at timestamptz;
begin
  if p_owner_id is null
     or p_request_digest is null
     or p_request_digest !~ '^[0-9a-f]{64}$'
     or p_handoff_digest is null
     or p_handoff_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid trusted payment materialization identity' using errcode = '22023';
  end if;

  select initiation.*
    into strict v_initiation
    from app_private.flight_payment_initiations initiation
   where initiation.owner_id = p_owner_id
     and initiation.idempotency_key = p_idempotency_key
   for update;

  select intent.*
    into strict v_intent
    from app_private.flight_booking_intents intent
   where intent.id = v_initiation.booking_intent_id
     and intent.owner_id = p_owner_id
     and intent.booking_intent_id = p_booking_intent_id
   for update;

  if v_initiation.request_digest <> p_request_digest then
    raise exception 'payment initiation idempotency conflict' using errcode = '23505';
  end if;

  if v_initiation.state = 'MATERIALIZED' then
    if v_initiation.handoff_digest <> p_handoff_digest then
      raise exception 'payment handoff idempotency conflict' using errcode = '23505';
    end if;
    return query
      select v_initiation.booking_id,
             v_initiation.booking_ref,
             v_initiation.payment_id,
             v_initiation.payment_reference,
             v_initiation.state,
             v_initiation.payment_method,
             booking.status,
             payment.status,
             payment.amount,
             payment.currency,
             payment.expires_at,
             payment.amount_sdg,
             payment.bank_account_display_name,
             payment.masked_account_number,
             v_initiation.provider_session_token,
             v_initiation.provider_redirect_url,
             v_initiation.psp_live,
             true
        from public.bookings booking
        join public.payments payment on payment.booking_id = booking.id
       where booking.id = v_initiation.booking_id
         and payment.id = v_initiation.payment_id;
    return;
  end if;

  if v_intent.status <> 'READY_FOR_PAYMENT'
     or v_intent.valid_until <= now()
     or (v_intent.customer_price_snapshot->>'validUntil')::timestamptz <= now()
     or jsonb_array_length(v_intent.traveler_snapshot) = 0 then
    raise exception 'booking intent expired before payment materialization' using errcode = '22023';
  end if;

  select offer.*
    into strict v_offer
    from public.offers offer
   where offer.internal_offer_key = v_intent.internal_offer_id
     and offer.supplier_provider = v_intent.provider
     and offer.supplier_offer_ref = v_intent.provider_offer_ref
     and offer.enabled
     and offer.expires_at > now()
     and offer.selling_amount = (v_intent.customer_price_snapshot->>'amount')::numeric
     and offer.currency = v_intent.customer_price_snapshot->>'currency'
   for share;

  v_amount := (v_intent.customer_price_snapshot->>'amount')::numeric;
  v_currency := v_intent.customer_price_snapshot->>'currency';
  if v_offer.net_cost > v_amount then
    raise exception 'trusted offer economics are invalid' using errcode = '22023';
  end if;

  if v_initiation.payment_method = 'bankak' then
    if p_provider_name is null
       or p_provider_name <> 'manual_transfer'
       or p_provider_payment_id is not null
       or p_provider_session_token is not null
       or p_provider_redirect_url is not null
       or p_psp_live is null
       or p_psp_live
       or nullif(btrim(p_bank_account_display_name), '') is null
       or char_length(p_bank_account_display_name) > 120
       or nullif(btrim(p_masked_account_number), '') is null
       or char_length(p_masked_account_number) > 64 then
      raise exception 'trusted Bankak configuration is unavailable' using errcode = '22023';
    end if;
    if v_currency = 'SDG' then
      v_fx_rate := 1;
      v_amount_sdg := v_amount;
    else
      select fx.*
        into strict v_fx
        from public.fx_config fx
       where fx.source_currency = v_currency
         and fx.target_currency = 'SDG'
         and fx.active
         and fx.valid_from <= now()
         and (fx.valid_until is null or fx.valid_until > now())
       for share;
      v_fx_rate := v_fx.rate;
      v_amount_sdg := round(v_amount * v_fx.rate, 2);
    end if;
    v_expires_at := now() + interval '24 hours';
  else
    if v_initiation.payment_method <> 'card'
       or p_provider_name is null
       or p_provider_name !~ '^[a-z0-9][a-z0-9_-]{1,63}$'
       or p_provider_name in ('bankak', 'manual_transfer')
       or nullif(btrim(p_provider_payment_id), '') is null
       or char_length(p_provider_payment_id) > 512
       or nullif(btrim(p_provider_session_token), '') is null
       or char_length(p_provider_session_token) > 4096
       or p_psp_live is null
       or p_payment_expires_at is null
       or p_payment_expires_at <= now()
       or p_payment_expires_at > now() + interval '24 hours'
       or (p_provider_redirect_url is not null and p_provider_redirect_url !~ '^https://[^[:space:]]+$')
       or char_length(p_provider_redirect_url) > 2048
       or p_bank_account_display_name is not null
       or p_masked_account_number is not null then
      raise exception 'trusted PSP handoff is invalid' using errcode = '22023';
    end if;
    v_expires_at := p_payment_expires_at;
  end if;

  insert into public.bookings (
    id,
    user_id,
    offer_id,
    booking_ref,
    status,
    net_cost,
    sold_price,
    currency,
    fx_rate_sdg,
    agent_profit,
    commission,
    pay_method,
    traveler_snapshot,
    supplier_provider,
    supplier_contract_version
  ) values (
    v_initiation.booking_id,
    p_owner_id,
    v_offer.id,
    v_initiation.booking_ref,
    'pending_payment',
    v_offer.net_cost,
    v_amount,
    v_currency,
    v_fx_rate,
    v_amount - v_offer.net_cost,
    0,
    v_initiation.payment_method,
    jsonb_build_object(
      'contractVersion', 'flight-booking-travelers/v1',
      'travelers', v_intent.traveler_snapshot,
      'contact', v_intent.contact_snapshot
    ),
    v_intent.provider,
    'flight-offer/v1'
  )
  returning * into v_booking;

  insert into public.payments (
    id,
    booking_id,
    user_id,
    idempotency_key,
    payment_reference,
    method,
    status,
    amount,
    currency,
    amount_sdg,
    fx_rate_sdg,
    provider,
    provider_metadata,
    bank_account_display_name,
    masked_account_number,
    expires_at
  ) values (
    v_initiation.payment_id,
    v_booking.id,
    p_owner_id,
    p_idempotency_key,
    v_initiation.payment_reference,
    v_initiation.payment_method,
    'awaiting',
    v_amount,
    v_currency,
    v_amount_sdg,
    v_fx_rate,
    p_provider_name,
    case when v_initiation.payment_method = 'card'
      then jsonb_build_object(
        'contractVersion', 'flight-payment-initiation-provider/v1',
        'providerPaymentId', p_provider_payment_id
      )
      else '{}'::jsonb
    end,
    p_bank_account_display_name,
    p_masked_account_number,
    v_expires_at
  )
  returning * into v_payment;

  update app_private.flight_payment_initiations
     set state = 'MATERIALIZED',
         provider_name = p_provider_name,
         provider_payment_id = p_provider_payment_id,
         provider_session_token = p_provider_session_token,
         provider_redirect_url = p_provider_redirect_url,
         psp_live = p_psp_live,
         payment_expires_at = v_expires_at,
         handoff_digest = p_handoff_digest,
         materialized_at = now()
   where id = v_initiation.id
  returning * into v_initiation;

  insert into public.payment_audit (
    aggregate_type,
    aggregate_id,
    event_type,
    actor_type,
    actor_id,
    idempotency_key,
    after_state,
    event_digest,
    metadata
  ) values (
    'payment',
    v_payment.id,
    'flight_payment_initiated',
    'service',
    p_owner_id,
    p_idempotency_key,
    'awaiting',
    p_handoff_digest,
    jsonb_build_object('bookingStatus', 'pending_payment', 'method', v_initiation.payment_method)
  );

  return query
    select v_booking.id,
           v_booking.booking_ref,
           v_payment.id,
           v_payment.payment_reference,
           v_initiation.state,
           v_initiation.payment_method,
           v_booking.status,
           v_payment.status,
           v_payment.amount,
           v_payment.currency,
           v_payment.expires_at,
           v_payment.amount_sdg,
           v_payment.bank_account_display_name,
           v_payment.masked_account_number,
           v_initiation.provider_session_token,
           v_initiation.provider_redirect_url,
           v_initiation.psp_live,
           false;
exception
  when no_data_found then
    raise exception 'payment reservation or trusted offer is unavailable' using errcode = 'P0002';
end;
$$;

revoke all on function public.materialize_flight_payment_initiation_v1(
  uuid, text, text, text, text, text, text, text, boolean, timestamptz,
  text, text, text
) from public, anon, authenticated;
grant execute on function public.materialize_flight_payment_initiation_v1(
  uuid, text, text, text, text, text, text, text, boolean, timestamptz,
  text, text, text
) to service_role;

-- Gate A compatibility: both SECURITY DEFINER RPCs access the B11 and B12
-- private tables. Keep their ownership identical so NO FORCE RLS uses the
-- documented table-owner path without depending on a BYPASSRLS role attribute.
do $migration$
declare
  item record;
  booking_intents_table regclass :=
    to_regclass('app_private.flight_booking_intents');
  payment_initiations_table regclass :=
    to_regclass('app_private.flight_payment_initiations');
  booking_intents_owner oid;
  payment_initiations_owner oid;
  function_oid regprocedure;
  function_owner oid;
begin
  select table_row.relowner
    into strict booking_intents_owner
    from pg_catalog.pg_class as table_row
   where table_row.oid = booking_intents_table;

  select table_row.relowner
    into strict payment_initiations_owner
    from pg_catalog.pg_class as table_row
   where table_row.oid = payment_initiations_table;

  if booking_intents_owner is distinct from payment_initiations_owner then
    raise exception
      'B11 booking intents and B12 payment initiations must have the same owner';
  end if;

  for item in
    select * from (values
      ('public.prepare_flight_payment_initiation_v1(uuid,text,public.payment_method,text,text)'),
      ('public.materialize_flight_payment_initiation_v1(uuid,text,text,text,text,text,text,text,boolean,timestamptz,text,text,text)')
    ) as functions(signature)
  loop
    function_oid := pg_catalog.to_regprocedure(item.signature);
    if function_oid is null then
      raise exception 'required payment initiation RPC % is missing', item.signature;
    end if;

    select function_row.proowner
      into strict function_owner
      from pg_catalog.pg_proc as function_row
     where function_row.oid = function_oid;

    if function_owner is distinct from payment_initiations_owner then
      raise exception
        'payment initiation RPC % and private tables must have the same owner',
        item.signature;
    end if;
  end loop;
end
$migration$;
