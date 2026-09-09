-- HAJIZ Flight Selection Durability V1 — REVIEW-ONLY proposal.
-- This is deliberately not a migration. Run only in a disposable review database.

begin;

-- Conservative first-install drift guard. A future migration-conversion review
-- must replace this with complete catalog-signature equality checks for replay;
-- it must never DROP or CREATE OR REPLACE a conflicting object as a repair.
do $guard$
declare
  item text;
begin
  if pg_catalog.to_regnamespace('app_private') is null then
    raise exception 'required app_private schema is missing';
  end if;
  if pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'required pgcrypto digest function is missing';
  end if;

  foreach item in array array[
    'app_private.flight_search_selections',
    'app_private.flight_priced_selections',
    'app_private.flight_search_selections_expires_idx',
    'app_private.flight_priced_selections_expires_idx'
  ] loop
    if pg_catalog.to_regclass(item) is not null then
      raise exception 'same-name relation exists; canonical drift review required: %', item;
    end if;
  end loop;

  foreach item in array array[
    'public.remember_flight_search_selections_v1(jsonb)',
    'public.get_flight_search_selection_v1(text)',
    'public.create_or_get_flight_priced_selection_v1(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)',
    'public.get_flight_priced_selection_v1(text)'
  ] loop
    if pg_catalog.to_regprocedure(item) is not null then
      raise exception 'same-name function exists; canonical drift review required: %', item;
    end if;
  end loop;
end
$guard$;

create table app_private.flight_search_selections (
  alternative_id text not null,
  payload_digest text not null,
  internal_offer_id text not null,
  provider text not null,
  provider_offer_ref text not null,
  itinerary_snapshot jsonb not null,
  fare_snapshot jsonb not null,
  previous_customer_price_snapshot jsonb not null,
  passenger_composition jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint flight_search_selections_pkey primary key (alternative_id),
  constraint flight_search_selections_alternative_id_check
    check (alternative_id ~ '^hca_v2_[0-9a-f]{32}$'),
  constraint flight_search_selections_payload_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint flight_search_selections_internal_offer_id_check
    check (pg_catalog.char_length(internal_offer_id) between 1 and 255),
  constraint flight_search_selections_provider_check
    check (provider ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint flight_search_selections_provider_offer_ref_check
    check (pg_catalog.char_length(provider_offer_ref) between 1 and 512),
  constraint flight_search_selections_itinerary_snapshot_check
    check (pg_catalog.jsonb_typeof(itinerary_snapshot) = 'object' and pg_catalog.octet_length(itinerary_snapshot::text) <= 16384),
  constraint flight_search_selections_fare_snapshot_check
    check (pg_catalog.jsonb_typeof(fare_snapshot) = 'object' and pg_catalog.octet_length(fare_snapshot::text) <= 8192),
  constraint flight_search_selections_customer_price_snapshot_check
    check (
      pg_catalog.jsonb_typeof(previous_customer_price_snapshot) = 'object'
      and pg_catalog.octet_length(previous_customer_price_snapshot::text) <= 4096
      and previous_customer_price_snapshot ?& array['amount','currency','validUntil']
      and previous_customer_price_snapshot - array['amount','currency','validUntil'] = '{}'::jsonb
      and pg_catalog.jsonb_typeof(previous_customer_price_snapshot->'amount') = 'string'
      and pg_catalog.char_length(previous_customer_price_snapshot->>'amount') <= 40
      and previous_customer_price_snapshot->>'amount' ~ '^(0|[1-9][0-9]*)(\.[0-9]{1,8})?$'
      and (previous_customer_price_snapshot->>'amount')::numeric > 0
      and pg_catalog.jsonb_typeof(previous_customer_price_snapshot->'currency') = 'string'
      and previous_customer_price_snapshot->>'currency' in ('USD','AED','SDG')
      and pg_catalog.jsonb_typeof(previous_customer_price_snapshot->'validUntil') = 'string'
      and previous_customer_price_snapshot->>'validUntil' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
      and (previous_customer_price_snapshot->>'validUntil')::timestamptz > created_at
      and expires_at <= (previous_customer_price_snapshot->>'validUntil')::timestamptz
    ),
  constraint flight_search_selections_passenger_composition_check
    check (
      pg_catalog.jsonb_typeof(passenger_composition) = 'object'
      and pg_catalog.octet_length(passenger_composition::text) <= 1024
      and passenger_composition ?& array['ADT','CHD','INF']
      and passenger_composition - array['ADT','CHD','INF'] = '{}'::jsonb
      and pg_catalog.jsonb_typeof(passenger_composition->'ADT') = 'number'
      and pg_catalog.jsonb_typeof(passenger_composition->'CHD') = 'number'
      and pg_catalog.jsonb_typeof(passenger_composition->'INF') = 'number'
      and passenger_composition->>'ADT' ~ '^(0|[1-9][0-9]*)$'
      and (passenger_composition->>'ADT')::numeric >= 1
      and passenger_composition->>'CHD' ~ '^(0|[1-9][0-9]*)$'
      and passenger_composition->>'INF' ~ '^(0|[1-9][0-9]*)$'
    ),
  constraint flight_search_selections_validity_check check (expires_at > created_at)
);

comment on table app_private.flight_search_selections is
  'hajiz:flight-selection-durability:search-table:v1';

create index flight_search_selections_expires_idx
  on app_private.flight_search_selections (expires_at);
comment on index app_private.flight_search_selections_expires_idx is
  'hajiz:flight-selection-durability:search-expiry-index:v1';

create table app_private.flight_priced_selections (
  priced_selection_id text not null,
  payload_digest text not null,
  alternative_id text not null,
  internal_offer_id text not null,
  provider text not null,
  provider_offer_ref text not null,
  customer_price_snapshot jsonb not null,
  itinerary_snapshot jsonb not null,
  fare_snapshot jsonb not null,
  passenger_composition jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint flight_priced_selections_pkey primary key (priced_selection_id),
  constraint flight_priced_selections_priced_id_check
    check (priced_selection_id ~ '^hpr_v1_[0-9a-f]{40}$'),
  constraint flight_priced_selections_payload_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint flight_priced_selections_alternative_id_check
    check (alternative_id ~ '^hca_v2_[0-9a-f]{32}$'),
  constraint flight_priced_selections_internal_offer_id_check
    check (pg_catalog.char_length(internal_offer_id) between 1 and 255),
  constraint flight_priced_selections_provider_check
    check (provider ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint flight_priced_selections_provider_offer_ref_check
    check (pg_catalog.char_length(provider_offer_ref) between 1 and 512),
  constraint flight_priced_selections_customer_price_snapshot_check
    check (
      pg_catalog.jsonb_typeof(customer_price_snapshot) = 'object'
      and pg_catalog.octet_length(customer_price_snapshot::text) <= 4096
      and customer_price_snapshot ?& array['amount','currency','validUntil']
      and customer_price_snapshot - array['amount','currency','validUntil'] = '{}'::jsonb
      and pg_catalog.jsonb_typeof(customer_price_snapshot->'amount') = 'string'
      and pg_catalog.char_length(customer_price_snapshot->>'amount') <= 40
      and customer_price_snapshot->>'amount' ~ '^(0|[1-9][0-9]*)(\.[0-9]{1,8})?$'
      and (customer_price_snapshot->>'amount')::numeric > 0
      and pg_catalog.jsonb_typeof(customer_price_snapshot->'currency') = 'string'
      and customer_price_snapshot->>'currency' in ('USD','AED','SDG')
      and pg_catalog.jsonb_typeof(customer_price_snapshot->'validUntil') = 'string'
      and customer_price_snapshot->>'validUntil' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
      and (customer_price_snapshot->>'validUntil')::timestamptz > created_at
      and expires_at = (customer_price_snapshot->>'validUntil')::timestamptz
    ),
  constraint flight_priced_selections_itinerary_snapshot_check
    check (pg_catalog.jsonb_typeof(itinerary_snapshot) = 'object' and pg_catalog.octet_length(itinerary_snapshot::text) <= 16384),
  constraint flight_priced_selections_fare_snapshot_check
    check (pg_catalog.jsonb_typeof(fare_snapshot) = 'object' and pg_catalog.octet_length(fare_snapshot::text) <= 8192),
  constraint flight_priced_selections_passenger_composition_check
    check (
      pg_catalog.jsonb_typeof(passenger_composition) = 'object'
      and pg_catalog.octet_length(passenger_composition::text) <= 1024
      and passenger_composition ?& array['ADT','CHD','INF']
      and passenger_composition - array['ADT','CHD','INF'] = '{}'::jsonb
      and pg_catalog.jsonb_typeof(passenger_composition->'ADT') = 'number'
      and pg_catalog.jsonb_typeof(passenger_composition->'CHD') = 'number'
      and pg_catalog.jsonb_typeof(passenger_composition->'INF') = 'number'
      and passenger_composition->>'ADT' ~ '^(0|[1-9][0-9]*)$'
      and (passenger_composition->>'ADT')::numeric >= 1
      and passenger_composition->>'CHD' ~ '^(0|[1-9][0-9]*)$'
      and passenger_composition->>'INF' ~ '^(0|[1-9][0-9]*)$'
    ),
  constraint flight_priced_selections_validity_check check (expires_at > created_at)
);

comment on table app_private.flight_priced_selections is
  'hajiz:flight-selection-durability:priced-table:v1';

create index flight_priced_selections_expires_idx
  on app_private.flight_priced_selections (expires_at);
comment on index app_private.flight_priced_selections_expires_idx is
  'hajiz:flight-selection-durability:priced-expiry-index:v1';

alter table app_private.flight_search_selections enable row level security;
alter table app_private.flight_search_selections no force row level security;
alter table app_private.flight_priced_selections enable row level security;
alter table app_private.flight_priced_selections no force row level security;

create policy flight_search_selections_direct_access_denied
  on app_private.flight_search_selections for all to anon, authenticated
  using (false) with check (false);
comment on policy flight_search_selections_direct_access_denied
  on app_private.flight_search_selections is
  'hajiz:flight-selection-durability:search-deny-policy:v1';

create policy flight_priced_selections_direct_access_denied
  on app_private.flight_priced_selections for all to anon, authenticated
  using (false) with check (false);
comment on policy flight_priced_selections_direct_access_denied
  on app_private.flight_priced_selections is
  'hajiz:flight-selection-durability:priced-deny-policy:v1';

revoke all on table app_private.flight_search_selections
  from public, anon, authenticated, service_role;
revoke all on table app_private.flight_priced_selections
  from public, anon, authenticated, service_role;

create function public.remember_flight_search_selections_v1(p_batch jsonb)
returns table(alternative_id text, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item jsonb;
  v_id text;
  v_internal_offer_id text;
  v_provider text;
  v_provider_offer_ref text;
  v_itinerary jsonb;
  v_fare jsonb;
  v_price jsonb;
  v_passengers jsonb;
  v_expires_at timestamptz;
  v_digest text;
  v_existing_digest text;
  v_inserted boolean;
begin
  if p_batch is null
     or pg_catalog.jsonb_typeof(p_batch) <> 'array'
     or pg_catalog.jsonb_array_length(p_batch) < 1
     or pg_catalog.jsonb_array_length(p_batch) > 500 then
    raise exception 'invalid search selection batch' using errcode = 'FSD10';
  end if;

  -- Stable ordering prevents competing batches from taking row locks in
  -- contradictory order. Any exception rolls back the complete RPC statement.
  for v_item in
    select item
    from pg_catalog.jsonb_array_elements(p_batch) as batch(item)
    order by item->>'alternativeId'
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object'
       or not (v_item ?& array['alternativeId','internalOfferId','provider','providerOfferRef','itinerary','fare','previousCustomerPrice','passengerComposition','expiresAt'])
       or v_item - array['alternativeId','internalOfferId','provider','providerOfferRef','itinerary','fare','previousCustomerPrice','passengerComposition','expiresAt'] <> '{}'::jsonb then
      raise exception 'invalid search selection entry' using errcode = 'FSD11';
    end if;

    v_id := v_item->>'alternativeId';
    v_internal_offer_id := v_item->>'internalOfferId';
    v_provider := v_item->>'provider';
    v_provider_offer_ref := v_item->>'providerOfferRef';
    v_itinerary := v_item->'itinerary';
    v_fare := v_item->'fare';
    v_price := v_item->'previousCustomerPrice';
    v_passengers := v_item->'passengerComposition';

    if pg_catalog.jsonb_typeof(v_item->'expiresAt') <> 'string'
       or v_item->>'expiresAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
      raise exception 'invalid search selection expiry' using errcode = 'FSD11';
    end if;
    if not pg_catalog.pg_input_is_valid(v_item->>'expiresAt', 'timestamptz') then
      raise exception 'invalid search selection expiry' using errcode = 'FSD11';
    end if;
    v_expires_at := (v_item->>'expiresAt')::timestamptz;

    if pg_catalog.jsonb_typeof(v_price) <> 'object'
       or not (v_price ?& array['amount','currency','validUntil'])
       or v_price - array['amount','currency','validUntil'] <> '{}'::jsonb
       or pg_catalog.jsonb_typeof(v_price->'amount') <> 'string'
       or pg_catalog.char_length(v_price->>'amount') > 40
       or v_price->>'amount' !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,8})?$'
       or pg_catalog.jsonb_typeof(v_price->'currency') <> 'string'
       or v_price->>'currency' not in ('USD','AED','SDG')
       or pg_catalog.jsonb_typeof(v_price->'validUntil') <> 'string'
       or v_price->>'validUntil' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
      raise exception 'invalid search customer price' using errcode = 'FSD11';
    end if;
    if (v_price->>'amount')::numeric <= 0
       or not pg_catalog.pg_input_is_valid(v_price->>'validUntil', 'timestamptz') then
      raise exception 'invalid search customer price' using errcode = 'FSD11';
    end if;

    if v_expires_at is null
       or v_expires_at <= pg_catalog.transaction_timestamp()
       or (v_price->>'validUntil')::timestamptz <= pg_catalog.transaction_timestamp()
       or v_expires_at > (v_price->>'validUntil')::timestamptz then
      raise exception 'search selection is expired' using errcode = 'FSD02';
    end if;

    v_digest := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        'flight-search-selection-payload/v1', v_id, v_internal_offer_id,
        v_provider, v_provider_offer_ref, v_itinerary, v_fare, v_price,
        v_passengers, pg_catalog.to_char(v_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      )::text, 'UTF8'), 'sha256'), 'hex');

    insert into app_private.flight_search_selections(
      alternative_id, payload_digest, internal_offer_id, provider,
      provider_offer_ref, itinerary_snapshot, fare_snapshot,
      previous_customer_price_snapshot, passenger_composition, expires_at
    ) values (
      v_id, v_digest, v_internal_offer_id, v_provider, v_provider_offer_ref,
      v_itinerary, v_fare, v_price, v_passengers, v_expires_at
    ) on conflict (alternative_id) do nothing
    returning true into v_inserted;

    if not pg_catalog.coalesce(v_inserted, false) then
      select row.payload_digest into strict v_existing_digest
      from app_private.flight_search_selections as row
      where row.alternative_id = v_id
      for share;
      if v_existing_digest is distinct from v_digest then
        raise exception 'search selection identity conflict' using errcode = 'FSD04';
      end if;
    end if;

    alternative_id := v_id;
    replayed := not pg_catalog.coalesce(v_inserted, false);
    return next;
    v_inserted := false;
  end loop;
end
$function$;

comment on function public.remember_flight_search_selections_v1(jsonb) is
  'hajiz:flight-selection-durability:remember-search-rpc:v1';

create function public.get_flight_search_selection_v1(p_alternative_id text)
returns table(
  alternative_id text, internal_offer_id text, provider text,
  provider_offer_ref text, itinerary_snapshot jsonb, fare_snapshot jsonb,
  previous_customer_price_snapshot jsonb, passenger_composition jsonb,
  expires_at timestamptz, payload_digest text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_row app_private.flight_search_selections%rowtype;
begin
  if p_alternative_id !~ '^hca_v2_[0-9a-f]{32}$' then
    raise exception 'search selection not found' using errcode = 'FSD01';
  end if;
  select row.* into v_row
  from app_private.flight_search_selections as row
  where row.alternative_id = p_alternative_id;
  if not found then raise exception 'search selection not found' using errcode = 'FSD01'; end if;
  if v_row.expires_at <= pg_catalog.transaction_timestamp() then
    raise exception 'search selection expired' using errcode = 'FSD02';
  end if;
  return query select v_row.alternative_id, v_row.internal_offer_id, v_row.provider,
    v_row.provider_offer_ref, v_row.itinerary_snapshot, v_row.fare_snapshot,
    v_row.previous_customer_price_snapshot, v_row.passenger_composition,
    v_row.expires_at, v_row.payload_digest;
end
$function$;

comment on function public.get_flight_search_selection_v1(text) is
  'hajiz:flight-selection-durability:get-search-rpc:v1';

create function public.create_or_get_flight_priced_selection_v1(
  p_priced_selection_id text,
  p_alternative_id text,
  p_internal_offer_id text,
  p_provider text,
  p_provider_offer_ref text,
  p_customer_price_snapshot jsonb,
  p_itinerary_snapshot jsonb,
  p_fare_snapshot jsonb,
  p_passenger_composition jsonb,
  p_expires_at timestamptz
)
returns table(priced_selection_id text, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_digest text;
  v_existing_digest text;
  v_inserted boolean;
begin
  if p_expires_at is null then
    raise exception 'invalid priced selection expiry' using errcode = 'FSD11';
  end if;
  if p_customer_price_snapshot is null
     or pg_catalog.jsonb_typeof(p_customer_price_snapshot) <> 'object'
     or not (p_customer_price_snapshot ?& array['amount','currency','validUntil'])
     or p_customer_price_snapshot - array['amount','currency','validUntil'] <> '{}'::jsonb
     or pg_catalog.jsonb_typeof(p_customer_price_snapshot->'amount') <> 'string'
     or pg_catalog.char_length(p_customer_price_snapshot->>'amount') > 40
     or p_customer_price_snapshot->>'amount' !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,8})?$'
     or pg_catalog.jsonb_typeof(p_customer_price_snapshot->'currency') <> 'string'
     or p_customer_price_snapshot->>'currency' not in ('USD','AED','SDG')
     or pg_catalog.jsonb_typeof(p_customer_price_snapshot->'validUntil') <> 'string'
     or p_customer_price_snapshot->>'validUntil' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'invalid priced customer price' using errcode = 'FSD11';
  end if;
  if (p_customer_price_snapshot->>'amount')::numeric <= 0
     or not pg_catalog.pg_input_is_valid(p_customer_price_snapshot->>'validUntil', 'timestamptz') then
    raise exception 'invalid priced customer price' using errcode = 'FSD11';
  end if;
  if p_expires_at <= pg_catalog.transaction_timestamp()
     or (p_customer_price_snapshot->>'validUntil')::timestamptz <= pg_catalog.transaction_timestamp() then
    raise exception 'priced selection is expired' using errcode = 'FSD02';
  end if;
  if p_expires_at <> (p_customer_price_snapshot->>'validUntil')::timestamptz then
    raise exception 'priced selection expiry mismatch' using errcode = 'FSD11';
  end if;

  v_digest := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(
      'flight-priced-selection-payload/v1', p_priced_selection_id,
      p_alternative_id, p_internal_offer_id, p_provider, p_provider_offer_ref,
      p_customer_price_snapshot, p_itinerary_snapshot, p_fare_snapshot,
      p_passenger_composition,
      pg_catalog.to_char(p_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    )::text, 'UTF8'), 'sha256'), 'hex');

  insert into app_private.flight_priced_selections(
    priced_selection_id, payload_digest, alternative_id, internal_offer_id,
    provider, provider_offer_ref, customer_price_snapshot, itinerary_snapshot,
    fare_snapshot, passenger_composition, expires_at
  ) values (
    p_priced_selection_id, v_digest, p_alternative_id, p_internal_offer_id,
    p_provider, p_provider_offer_ref, p_customer_price_snapshot,
    p_itinerary_snapshot, p_fare_snapshot, p_passenger_composition, p_expires_at
  ) on conflict (priced_selection_id) do nothing
  returning true into v_inserted;

  if not pg_catalog.coalesce(v_inserted, false) then
    select row.payload_digest into strict v_existing_digest
    from app_private.flight_priced_selections as row
    where row.priced_selection_id = p_priced_selection_id
    for share;
    if v_existing_digest is distinct from v_digest then
      raise exception 'priced selection identity conflict' using errcode = 'FSD04';
    end if;
  end if;

  priced_selection_id := p_priced_selection_id;
  replayed := not pg_catalog.coalesce(v_inserted, false);
  return next;
end
$function$;

comment on function public.create_or_get_flight_priced_selection_v1(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz) is
  'hajiz:flight-selection-durability:create-priced-rpc:v1';

create function public.get_flight_priced_selection_v1(p_priced_selection_id text)
returns table(
  priced_selection_id text, alternative_id text, internal_offer_id text,
  provider text, provider_offer_ref text, customer_price_snapshot jsonb,
  itinerary_snapshot jsonb, fare_snapshot jsonb, passenger_composition jsonb,
  expires_at timestamptz, payload_digest text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_row app_private.flight_priced_selections%rowtype;
begin
  if p_priced_selection_id !~ '^hpr_v1_[0-9a-f]{40}$' then
    raise exception 'priced selection not found' using errcode = 'FSD01';
  end if;
  select row.* into v_row
  from app_private.flight_priced_selections as row
  where row.priced_selection_id = p_priced_selection_id;
  if not found then raise exception 'priced selection not found' using errcode = 'FSD01'; end if;
  if v_row.expires_at <= pg_catalog.transaction_timestamp() then
    raise exception 'priced selection expired' using errcode = 'FSD02';
  end if;
  return query select v_row.priced_selection_id, v_row.alternative_id,
    v_row.internal_offer_id, v_row.provider, v_row.provider_offer_ref,
    v_row.customer_price_snapshot, v_row.itinerary_snapshot,
    v_row.fare_snapshot, v_row.passenger_composition, v_row.expires_at,
    v_row.payload_digest;
end
$function$;

comment on function public.get_flight_priced_selection_v1(text) is
  'hajiz:flight-selection-durability:get-priced-rpc:v1';

revoke all on function public.remember_flight_search_selections_v1(jsonb)
  from public, anon, authenticated;
revoke all on function public.get_flight_search_selection_v1(text)
  from public, anon, authenticated;
revoke all on function public.create_or_get_flight_priced_selection_v1(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_flight_priced_selection_v1(text)
  from public, anon, authenticated;

grant execute on function public.remember_flight_search_selections_v1(jsonb)
  to service_role;
grant execute on function public.get_flight_search_selection_v1(text)
  to service_role;
grant execute on function public.create_or_get_flight_priced_selection_v1(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)
  to service_role;
grant execute on function public.get_flight_priced_selection_v1(text)
  to service_role;

-- Same-owner behavior is mandatory because these functions intentionally use
-- SECURITY DEFINER to cross private-table RLS without direct service_role grants.
do $owner_guard$
declare
  v_owner oid;
  v_other_owner oid;
  item text;
begin
  select relowner into strict v_owner
  from pg_catalog.pg_class
  where oid = 'app_private.flight_search_selections'::regclass;

  select relowner into strict v_other_owner
  from pg_catalog.pg_class
  where oid = 'app_private.flight_priced_selections'::regclass;
  if v_other_owner is distinct from v_owner then
    raise exception 'private selection tables must share one owner';
  end if;

  foreach item in array array[
    'public.remember_flight_search_selections_v1(jsonb)',
    'public.get_flight_search_selection_v1(text)',
    'public.create_or_get_flight_priced_selection_v1(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)',
    'public.get_flight_priced_selection_v1(text)'
  ] loop
    select proowner into strict v_other_owner
    from pg_catalog.pg_proc where oid = item::regprocedure;
    if v_other_owner is distinct from v_owner then
      raise exception 'RPC and private tables must share one owner: %', item;
    end if;
  end loop;
end
$owner_guard$;

-- No cleanup worker, cron, migration history entry, or persistent change.
rollback;
