-- HAJIZ B11: private flight booking intent persistence.
-- Additive only. This migration must pass a Staging review gate before application.

create table app_private.flight_booking_intents (
  id uuid primary key default gen_random_uuid(),
  booking_intent_id text not null unique
    default ('hbi_v1_' || replace(gen_random_uuid()::text, '-', ''))
    check (booking_intent_id ~ '^hbi_v1_[0-9a-f]{32}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'READY_FOR_PAYMENT'
    check (status = 'READY_FOR_PAYMENT'),
  idempotency_key text not null
    check (idempotency_key ~ '^hbi_req_[A-Za-z0-9_-]{16,80}$'),
  payload_digest text not null
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  priced_selection_digest text not null
    check (priced_selection_digest ~ '^[0-9a-f]{64}$'),
  internal_offer_id text not null
    check (char_length(internal_offer_id) between 1 and 255),
  provider text not null
    check (provider ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  provider_offer_ref text not null
    check (char_length(provider_offer_ref) between 1 and 512),
  itinerary_snapshot jsonb not null
    check (jsonb_typeof(itinerary_snapshot) = 'object'),
  fare_snapshot jsonb not null
    check (jsonb_typeof(fare_snapshot) = 'object'),
  customer_price_snapshot jsonb not null
    check (jsonb_typeof(customer_price_snapshot) = 'object'),
  passenger_composition jsonb not null
    check (jsonb_typeof(passenger_composition) = 'object'),
  traveler_snapshot jsonb not null
    check (jsonb_typeof(traveler_snapshot) = 'array'),
  contact_snapshot jsonb not null
    check (jsonb_typeof(contact_snapshot) = 'object'),
  valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  constraint flight_booking_intents_owner_idempotency_unique
    unique (owner_id, idempotency_key),
  constraint flight_booking_intents_validity_check
    check (valid_until > created_at)
);

create index flight_booking_intents_owner_created_idx
  on app_private.flight_booking_intents(owner_id, created_at desc);

alter table app_private.flight_booking_intents enable row level security;
alter table app_private.flight_booking_intents force row level security;

create policy flight_booking_intents_direct_access_denied
on app_private.flight_booking_intents
for all
to anon, authenticated
using (false)
with check (false);

revoke all on table app_private.flight_booking_intents
  from public, anon, authenticated, service_role;

create or replace function public.create_flight_booking_intent_v1(
  p_owner_id uuid,
  p_idempotency_key text,
  p_payload_digest text,
  p_priced_selection_digest text,
  p_internal_offer_id text,
  p_provider text,
  p_provider_offer_ref text,
  p_itinerary_snapshot jsonb,
  p_fare_snapshot jsonb,
  p_customer_price_snapshot jsonb,
  p_passenger_composition jsonb,
  p_traveler_snapshot jsonb,
  p_contact_snapshot jsonb,
  p_valid_until timestamptz
)
returns table(
  booking_intent_id text,
  status text,
  valid_until timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent app_private.flight_booking_intents%rowtype;
begin
  if p_owner_id is null then
    raise exception 'trusted booking intent owner is required' using errcode = '28000';
  end if;

  insert into app_private.flight_booking_intents (
    owner_id,
    idempotency_key,
    payload_digest,
    priced_selection_digest,
    internal_offer_id,
    provider,
    provider_offer_ref,
    itinerary_snapshot,
    fare_snapshot,
    customer_price_snapshot,
    passenger_composition,
    traveler_snapshot,
    contact_snapshot,
    valid_until
  ) values (
    p_owner_id,
    p_idempotency_key,
    p_payload_digest,
    p_priced_selection_digest,
    p_internal_offer_id,
    p_provider,
    p_provider_offer_ref,
    p_itinerary_snapshot,
    p_fare_snapshot,
    p_customer_price_snapshot,
    p_passenger_composition,
    p_traveler_snapshot,
    p_contact_snapshot,
    p_valid_until
  )
  on conflict (owner_id, idempotency_key) do nothing
  returning * into v_intent;

  if found then
    return query
      select v_intent.booking_intent_id,
             v_intent.status,
             v_intent.valid_until,
             false;
    return;
  end if;

  select intent.*
  into strict v_intent
  from app_private.flight_booking_intents intent
  where intent.owner_id = p_owner_id
    and intent.idempotency_key = p_idempotency_key
  for share;

  if v_intent.payload_digest is distinct from p_payload_digest then
    raise exception 'booking intent idempotency conflict' using errcode = '23505';
  end if;

  return query
    select v_intent.booking_intent_id,
           v_intent.status,
           v_intent.valid_until,
           true;
end;
$$;

revoke all on function public.create_flight_booking_intent_v1(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb,
  jsonb, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_flight_booking_intent_v1(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb,
  jsonb, jsonb, timestamptz
) to service_role;

create or replace function public.get_flight_booking_intent_v1(
  p_owner_id uuid,
  p_booking_intent_id text
)
returns table(
  booking_intent_id text,
  owner_id uuid,
  status text,
  internal_offer_id text,
  provider text,
  provider_offer_ref text,
  itinerary_snapshot jsonb,
  fare_snapshot jsonb,
  customer_price_snapshot jsonb,
  passenger_composition jsonb,
  traveler_snapshot jsonb,
  contact_snapshot jsonb,
  valid_until timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select intent.booking_intent_id,
         intent.owner_id,
         intent.status,
         intent.internal_offer_id,
         intent.provider,
         intent.provider_offer_ref,
         intent.itinerary_snapshot,
         intent.fare_snapshot,
         intent.customer_price_snapshot,
         intent.passenger_composition,
         intent.traveler_snapshot,
         intent.contact_snapshot,
         intent.valid_until,
         intent.created_at
  from app_private.flight_booking_intents intent
  where intent.owner_id = p_owner_id
    and intent.booking_intent_id = p_booking_intent_id
$$;

revoke all on function public.get_flight_booking_intent_v1(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_flight_booking_intent_v1(uuid, text)
  to service_role;
