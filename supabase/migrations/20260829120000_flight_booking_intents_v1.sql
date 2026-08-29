-- HAJIZ B11: private flight booking intent persistence.
-- Additive only. This migration must pass a Staging review gate before application.
-- Canonical signatures make exact replay safe while rejecting unowned same-name drift.

do $migration$
declare
  canonical_table constant text := 'hajiz:b11:flight_booking_intents:table:v1';
  item record;
  existing_table regclass := to_regclass('app_private.flight_booking_intents');
  existing_relkind "char";
  existing_owner oid;
  current_owner oid;
  existing_signature text;
  existing_column_count integer;
  existing_type text;
  existing_not_null boolean;
  existing_default text;
  existing_constraint_oid oid;
  existing_constraint_type "char";
  existing_constraint_signature text;
  created_now boolean := false;
begin
  select role_row.oid
    into strict current_owner
    from pg_catalog.pg_roles as role_row
   where role_row.rolname = current_user;

  if existing_table is null then
    execute $ddl$
      create table app_private.flight_booking_intents (
        id uuid not null default gen_random_uuid(),
        booking_intent_id text not null
          default ('hbi_v1_' || replace(gen_random_uuid()::text, '-', '')),
        owner_id uuid not null,
        status text not null default 'READY_FOR_PAYMENT',
        idempotency_key text not null,
        payload_digest text not null,
        priced_selection_digest text not null,
        internal_offer_id text not null,
        provider text not null,
        provider_offer_ref text not null,
        itinerary_snapshot jsonb not null,
        fare_snapshot jsonb not null,
        customer_price_snapshot jsonb not null,
        passenger_composition jsonb not null,
        traveler_snapshot jsonb not null,
        contact_snapshot jsonb not null,
        valid_until timestamptz not null,
        created_at timestamptz not null default now(),
        constraint flight_booking_intents_pkey primary key (id),
        constraint flight_booking_intents_booking_intent_id_key unique (booking_intent_id),
        constraint flight_booking_intents_booking_intent_id_check
          check (booking_intent_id ~ '^hbi_v1_[0-9a-f]{32}$'),
        constraint flight_booking_intents_owner_id_fkey
          foreign key (owner_id) references auth.users(id) on delete cascade,
        constraint flight_booking_intents_status_check
          check (status = 'READY_FOR_PAYMENT'),
        constraint flight_booking_intents_idempotency_key_check
          check (idempotency_key ~ '^hbi_req_[A-Za-z0-9_-]{16,80}$'),
        constraint flight_booking_intents_payload_digest_check
          check (payload_digest ~ '^[0-9a-f]{64}$'),
        constraint flight_booking_intents_priced_selection_digest_check
          check (priced_selection_digest ~ '^[0-9a-f]{64}$'),
        constraint flight_booking_intents_internal_offer_id_check
          check (char_length(internal_offer_id) between 1 and 255),
        constraint flight_booking_intents_provider_check
          check (provider ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
        constraint flight_booking_intents_provider_offer_ref_check
          check (char_length(provider_offer_ref) between 1 and 512),
        constraint flight_booking_intents_itinerary_snapshot_check
          check (jsonb_typeof(itinerary_snapshot) = 'object'),
        constraint flight_booking_intents_fare_snapshot_check
          check (jsonb_typeof(fare_snapshot) = 'object'),
        constraint flight_booking_intents_customer_price_snapshot_check
          check (jsonb_typeof(customer_price_snapshot) = 'object'),
        constraint flight_booking_intents_passenger_composition_check
          check (jsonb_typeof(passenger_composition) = 'object'),
        constraint flight_booking_intents_traveler_snapshot_check
          check (jsonb_typeof(traveler_snapshot) = 'array'),
        constraint flight_booking_intents_contact_snapshot_check
          check (jsonb_typeof(contact_snapshot) = 'object'),
        constraint flight_booking_intents_owner_idempotency_unique
          unique (owner_id, idempotency_key),
        constraint flight_booking_intents_validity_check
          check (valid_until > created_at)
      )
    $ddl$;
    execute format(
      'comment on table app_private.flight_booking_intents is %L',
      canonical_table
    );
    existing_table := to_regclass('app_private.flight_booking_intents');
    created_now := true;
  else
    select table_row.relkind,
           table_row.relowner,
           pg_catalog.obj_description(table_row.oid, 'pg_class')
      into existing_relkind, existing_owner, existing_signature
      from pg_catalog.pg_class as table_row
     where table_row.oid = existing_table;

    if existing_relkind <> 'r'
       or existing_owner is distinct from current_owner
       or existing_signature is distinct from canonical_table then
      raise exception
        'app_private.flight_booking_intents exists with a non-canonical owner, kind, or signature';
    end if;
  end if;

  select count(*)
    into existing_column_count
    from pg_catalog.pg_attribute as attribute
   where attribute.attrelid = existing_table
     and attribute.attnum > 0
     and not attribute.attisdropped;

  if existing_column_count <> 18 then
    raise exception
      'app_private.flight_booking_intents has a non-canonical column count';
  end if;

  for item in
    select * from (values
      ('id', 'uuid', true, 'gen_random_uuid'),
      ('booking_intent_id', 'text', true, 'hbi_v1_'),
      ('owner_id', 'uuid', true, null),
      ('status', 'text', true, 'READY_FOR_PAYMENT'),
      ('idempotency_key', 'text', true, null),
      ('payload_digest', 'text', true, null),
      ('priced_selection_digest', 'text', true, null),
      ('internal_offer_id', 'text', true, null),
      ('provider', 'text', true, null),
      ('provider_offer_ref', 'text', true, null),
      ('itinerary_snapshot', 'jsonb', true, null),
      ('fare_snapshot', 'jsonb', true, null),
      ('customer_price_snapshot', 'jsonb', true, null),
      ('passenger_composition', 'jsonb', true, null),
      ('traveler_snapshot', 'jsonb', true, null),
      ('contact_snapshot', 'jsonb', true, null),
      ('valid_until', 'timestamp with time zone', true, null),
      ('created_at', 'timestamp with time zone', true, 'now()')
    ) as columns(column_name, type_name, is_not_null, default_token)
  loop
    select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
           attribute.attnotnull,
           pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid)
      into existing_type, existing_not_null, existing_default
      from pg_catalog.pg_attribute as attribute
      left join pg_catalog.pg_attrdef as default_row
        on default_row.adrelid = attribute.attrelid
       and default_row.adnum = attribute.attnum
     where attribute.attrelid = existing_table
       and attribute.attname = item.column_name
       and attribute.attnum > 0
       and not attribute.attisdropped;

    if not found
       or existing_type is distinct from item.type_name
       or existing_not_null is distinct from item.is_not_null
       or (item.default_token is null and existing_default is not null)
       or (item.default_token is not null and
           (existing_default is null or position(item.default_token in existing_default) = 0)) then
      raise exception
        'column app_private.flight_booking_intents.% has a non-canonical definition',
        item.column_name;
    end if;

    existing_type := null;
    existing_not_null := null;
    existing_default := null;
  end loop;

  for item in
    select * from (values
      ('flight_booking_intents_pkey', 'p', 'hajiz:b11:flight_booking_intents:pkey:v1'),
      ('flight_booking_intents_booking_intent_id_key', 'u', 'hajiz:b11:flight_booking_intents:booking_intent_id_unique:v1'),
      ('flight_booking_intents_booking_intent_id_check', 'c', 'hajiz:b11:flight_booking_intents:booking_intent_id_check:v1'),
      ('flight_booking_intents_owner_id_fkey', 'f', 'hajiz:b11:flight_booking_intents:owner_id_fkey:v1'),
      ('flight_booking_intents_status_check', 'c', 'hajiz:b11:flight_booking_intents:status_check:v1'),
      ('flight_booking_intents_idempotency_key_check', 'c', 'hajiz:b11:flight_booking_intents:idempotency_key_check:v1'),
      ('flight_booking_intents_payload_digest_check', 'c', 'hajiz:b11:flight_booking_intents:payload_digest_check:v1'),
      ('flight_booking_intents_priced_selection_digest_check', 'c', 'hajiz:b11:flight_booking_intents:priced_selection_digest_check:v1'),
      ('flight_booking_intents_internal_offer_id_check', 'c', 'hajiz:b11:flight_booking_intents:internal_offer_id_check:v1'),
      ('flight_booking_intents_provider_check', 'c', 'hajiz:b11:flight_booking_intents:provider_check:v1'),
      ('flight_booking_intents_provider_offer_ref_check', 'c', 'hajiz:b11:flight_booking_intents:provider_offer_ref_check:v1'),
      ('flight_booking_intents_itinerary_snapshot_check', 'c', 'hajiz:b11:flight_booking_intents:itinerary_snapshot_check:v1'),
      ('flight_booking_intents_fare_snapshot_check', 'c', 'hajiz:b11:flight_booking_intents:fare_snapshot_check:v1'),
      ('flight_booking_intents_customer_price_snapshot_check', 'c', 'hajiz:b11:flight_booking_intents:customer_price_snapshot_check:v1'),
      ('flight_booking_intents_passenger_composition_check', 'c', 'hajiz:b11:flight_booking_intents:passenger_composition_check:v1'),
      ('flight_booking_intents_traveler_snapshot_check', 'c', 'hajiz:b11:flight_booking_intents:traveler_snapshot_check:v1'),
      ('flight_booking_intents_contact_snapshot_check', 'c', 'hajiz:b11:flight_booking_intents:contact_snapshot_check:v1'),
      ('flight_booking_intents_owner_idempotency_unique', 'u', 'hajiz:b11:flight_booking_intents:owner_idempotency_unique:v1'),
      ('flight_booking_intents_validity_check', 'c', 'hajiz:b11:flight_booking_intents:validity_check:v1')
    ) as constraints(constraint_name, constraint_type, signature)
  loop
    select constraint_row.oid,
           constraint_row.contype,
           pg_catalog.obj_description(constraint_row.oid, 'pg_constraint')
      into existing_constraint_oid,
           existing_constraint_type,
           existing_constraint_signature
      from pg_catalog.pg_constraint as constraint_row
     where constraint_row.conrelid = existing_table
       and constraint_row.conname = item.constraint_name;

    if existing_constraint_oid is null
       or existing_constraint_type::text is distinct from item.constraint_type then
      raise exception
        'constraint % on app_private.flight_booking_intents is missing or non-canonical',
        item.constraint_name;
    elsif created_now then
      execute format(
        'comment on constraint %I on app_private.flight_booking_intents is %L',
        item.constraint_name,
        item.signature
      );
    elsif existing_constraint_signature is distinct from item.signature then
      raise exception
        'constraint % on app_private.flight_booking_intents has a non-canonical signature',
        item.constraint_name;
    end if;

    existing_constraint_oid := null;
    existing_constraint_type := null;
    existing_constraint_signature := null;
  end loop;
end
$migration$;

do $migration$
declare
  canonical_index constant text :=
    'hajiz:b11:flight_booking_intents:owner_created_idx:v1';
  target_table regclass := to_regclass('app_private.flight_booking_intents');
  existing_index regclass :=
    to_regclass('app_private.flight_booking_intents_owner_created_idx');
  existing_relation oid;
  existing_unique boolean;
  existing_valid boolean;
  existing_key_count smallint;
  existing_definition text;
  existing_signature text;
begin
  if existing_index is null then
    execute $ddl$
      create index flight_booking_intents_owner_created_idx
        on app_private.flight_booking_intents(owner_id, created_at desc)
    $ddl$;
    execute format(
      'comment on index app_private.flight_booking_intents_owner_created_idx is %L',
      canonical_index
    );
  else
    select index_row.indrelid,
           index_row.indisunique,
           index_row.indisvalid,
           index_row.indnkeyatts,
           pg_catalog.pg_get_indexdef(index_row.indexrelid),
           pg_catalog.obj_description(index_row.indexrelid, 'pg_class')
      into existing_relation,
           existing_unique,
           existing_valid,
           existing_key_count,
           existing_definition,
           existing_signature
      from pg_catalog.pg_index as index_row
     where index_row.indexrelid = existing_index;

    if existing_relation is distinct from target_table::oid
       or existing_unique
       or not existing_valid
       or existing_key_count <> 2
       or position('(owner_id, created_at DESC)' in existing_definition) = 0
       or existing_signature is distinct from canonical_index then
      raise exception
        'index app_private.flight_booking_intents_owner_created_idx has a non-canonical definition';
    end if;
  end if;
end
$migration$;

-- Browser roles have neither privileges nor an allowing policy. NO FORCE RLS is
-- deliberate: the same migration owner owns the table and SECURITY DEFINER RPCs,
-- so RPC execution uses documented table-owner RLS behavior, not BYPASSRLS.
alter table app_private.flight_booking_intents enable row level security;
alter table app_private.flight_booking_intents no force row level security;

do $migration$
declare
  canonical_policy constant text :=
    'hajiz:b11:flight_booking_intents:direct_access_denied:v1';
  target_table regclass := to_regclass('app_private.flight_booking_intents');
  existing_policy_oid oid;
  existing_command "char";
  existing_permissive boolean;
  existing_roles oid[];
  existing_role_names text[];
  existing_using text;
  existing_check text;
  existing_signature text;
begin
  select policy_row.oid,
         policy_row.polcmd,
         policy_row.polpermissive,
         policy_row.polroles,
         pg_catalog.pg_get_expr(policy_row.polqual, policy_row.polrelid),
         pg_catalog.pg_get_expr(policy_row.polwithcheck, policy_row.polrelid),
         pg_catalog.obj_description(policy_row.oid, 'pg_policy')
    into existing_policy_oid,
         existing_command,
         existing_permissive,
         existing_roles,
         existing_using,
         existing_check,
         existing_signature
    from pg_catalog.pg_policy as policy_row
   where policy_row.polrelid = target_table
     and policy_row.polname = 'flight_booking_intents_direct_access_denied';

  if existing_policy_oid is null then
    execute $ddl$
      create policy flight_booking_intents_direct_access_denied
      on app_private.flight_booking_intents
      for all
      to anon, authenticated
      using (false)
      with check (false)
    $ddl$;
    execute format(
      'comment on policy flight_booking_intents_direct_access_denied on app_private.flight_booking_intents is %L',
      canonical_policy
    );
  else
    select pg_catalog.array_agg(role_row.rolname order by role_row.rolname)
      into existing_role_names
      from pg_catalog.pg_roles as role_row
     where role_row.oid = any(existing_roles);

    if existing_command <> '*'
       or not existing_permissive
       or pg_catalog.cardinality(existing_roles) <> 2
       or existing_role_names is distinct from array['anon', 'authenticated']::text[]
       or pg_catalog.regexp_replace(
            coalesce(existing_using, ''),
            '[()[:space:]]',
            '',
            'g'
          ) <> 'false'
       or pg_catalog.regexp_replace(
            coalesce(existing_check, ''),
            '[()[:space:]]',
            '',
            'g'
          ) <> 'false'
       or existing_signature is distinct from canonical_policy then
      raise exception
        'policy flight_booking_intents_direct_access_denied has a non-canonical definition';
    end if;
  end if;
end
$migration$;

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

-- NO FORCE RLS is safe only while each SECURITY DEFINER RPC and its private
-- table share the migration owner. Reject ownership drift instead of silently
-- depending on the function owner having the BYPASSRLS role attribute.
do $migration$
declare
  item record;
  target_table regclass := to_regclass('app_private.flight_booking_intents');
  table_owner oid;
  function_oid regprocedure;
  function_owner oid;
begin
  select table_row.relowner
    into strict table_owner
    from pg_catalog.pg_class as table_row
   where table_row.oid = target_table;

  for item in
    select * from (values
      ('public.create_flight_booking_intent_v1(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,timestamptz)'),
      ('public.get_flight_booking_intent_v1(uuid,text)')
    ) as functions(signature)
  loop
    function_oid := pg_catalog.to_regprocedure(item.signature);
    if function_oid is null then
      raise exception 'required booking intent RPC % is missing', item.signature;
    end if;

    select function_row.proowner
      into strict function_owner
      from pg_catalog.pg_proc as function_row
     where function_row.oid = function_oid;

    if function_owner is distinct from table_owner then
      raise exception
        'booking intent RPC % and private table must have the same owner',
        item.signature;
    end if;
  end loop;
end
$migration$;
