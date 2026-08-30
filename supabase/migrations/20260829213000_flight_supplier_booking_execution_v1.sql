-- HAJIZ B13: durable supplier create-booking execution after trusted payment
-- confirmation. Additive code-only migration; not applied by this batch.

do $migration$
declare
  existing_table regclass := to_regclass('app_private.flight_supplier_booking_executions');
  existing_owner oid;
  existing_signature text;
  current_owner oid := (select role_row.oid from pg_catalog.pg_roles as role_row where role_row.rolname = current_user);
begin
  if existing_table is null then
    execute $ddl$
      create table app_private.flight_supplier_booking_executions (
        id uuid primary key default gen_random_uuid(),
        operation_id uuid not null unique references app_private.supplier_operations(id) on delete restrict,
        booking_id uuid not null unique references public.bookings(id) on delete restrict,
        payment_id uuid not null unique references public.payments(id) on delete restrict,
        booking_intent_id uuid not null references app_private.flight_booking_intents(id) on delete restrict,
        owner_id uuid not null references auth.users(id) on delete restrict,
        provider text not null,
        internal_offer_id text not null,
        provider_offer_ref text not null,
        idempotency_key text not null,
        request_digest text not null,
        execution_state text not null default 'PREPARED',
        attempt_count integer not null default 0,
        supplier_booking_ref text,
        supplier_locator text,
        response_digest text,
        safe_metadata jsonb not null default '{}'::jsonb,
        reconciliation_required boolean not null default false,
        failure_code text,
        request_sent_at timestamptz,
        response_received_at timestamptz,
        supplier_accepted_at timestamptz,
        unknown_outcome_at timestamptz,
        reconciled_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint flight_supplier_executions_provider_check check (provider ~ '^[a-z][a-z0-9_-]{1,63}$'),
        constraint flight_supplier_executions_internal_offer_check check (char_length(internal_offer_id) between 1 and 255),
        constraint flight_supplier_executions_provider_offer_ref_check check (char_length(provider_offer_ref) between 1 and 512),
        constraint flight_supplier_executions_idempotency_check check (idempotency_key ~ '^hsb_req_[A-Za-z0-9_-]{16,80}$'),
        constraint flight_supplier_executions_request_digest_check check (request_digest ~ '^[a-f0-9]{64}$'),
        constraint flight_supplier_executions_state_check check (execution_state in ('PREPARED','REQUEST_SENT','SUBMITTED','ACCEPTED','REJECTED','FAILED','UNKNOWN')),
        constraint flight_supplier_executions_attempt_count_check check (attempt_count between 0 and 1),
        constraint flight_supplier_executions_supplier_ref_check check (supplier_booking_ref is null or (char_length(supplier_booking_ref) between 1 and 255 and supplier_booking_ref !~ '[[:cntrl:]]')),
        constraint flight_supplier_executions_locator_check check (supplier_locator is null or (char_length(supplier_locator) between 1 and 255 and supplier_locator !~ '[[:cntrl:]]')),
        constraint flight_supplier_executions_response_digest_check check (response_digest is null or response_digest ~ '^[a-f0-9]{64}$'),
        constraint flight_supplier_executions_safe_metadata_check check (jsonb_typeof(safe_metadata) = 'object' and pg_column_size(safe_metadata) <= 4096),
        constraint flight_supplier_executions_reconciliation_check check ((execution_state = 'UNKNOWN') = reconciliation_required),
        constraint flight_supplier_executions_owner_idempotency_unique unique (owner_id, idempotency_key)
      )
    $ddl$;
    execute format('comment on table app_private.flight_supplier_booking_executions is %L', 'hajiz:b13:flight_supplier_booking_executions:v1');
    existing_table := to_regclass('app_private.flight_supplier_booking_executions');
  else
    select table_row.relowner, pg_catalog.obj_description(table_row.oid, 'pg_class')
      into existing_owner, existing_signature
      from pg_catalog.pg_class as table_row where table_row.oid = existing_table;
    if existing_owner is distinct from current_owner or existing_signature is distinct from 'hajiz:b13:flight_supplier_booking_executions:v1' then
      raise exception 'flight_supplier_booking_executions exists with non-canonical ownership or signature';
    end if;
  end if;

  if (select count(*) from pg_catalog.pg_attribute as column_row where column_row.attrelid = existing_table and column_row.attnum > 0 and not column_row.attisdropped) <> 26 then
    raise exception 'flight_supplier_booking_executions has non-canonical columns';
  end if;
end
$migration$;

do $migration$
declare
  item record;
  constraint_oid oid;
  constraint_type "char";
  signature text;
begin
  for item in select * from (values
    ('flight_supplier_booking_executions_pkey','p'),
    ('flight_supplier_booking_executions_operation_id_key','u'),
    ('flight_supplier_booking_executions_booking_id_key','u'),
    ('flight_supplier_booking_executions_payment_id_key','u'),
    ('flight_supplier_booking_executions_operation_id_fkey','f'),
    ('flight_supplier_booking_executions_booking_id_fkey','f'),
    ('flight_supplier_booking_executions_payment_id_fkey','f'),
    ('flight_supplier_booking_executions_booking_intent_id_fkey','f'),
    ('flight_supplier_booking_executions_owner_id_fkey','f'),
    ('flight_supplier_executions_provider_check','c'),
    ('flight_supplier_executions_internal_offer_check','c'),
    ('flight_supplier_executions_provider_offer_ref_check','c'),
    ('flight_supplier_executions_idempotency_check','c'),
    ('flight_supplier_executions_request_digest_check','c'),
    ('flight_supplier_executions_state_check','c'),
    ('flight_supplier_executions_attempt_count_check','c'),
    ('flight_supplier_executions_supplier_ref_check','c'),
    ('flight_supplier_executions_locator_check','c'),
    ('flight_supplier_executions_response_digest_check','c'),
    ('flight_supplier_executions_safe_metadata_check','c'),
    ('flight_supplier_executions_reconciliation_check','c'),
    ('flight_supplier_executions_owner_idempotency_unique','u')
  ) as constraints(name, kind)
  loop
    select constraint_row.oid, constraint_row.contype, pg_catalog.obj_description(constraint_row.oid, 'pg_constraint')
      into constraint_oid, constraint_type, signature
      from pg_catalog.pg_constraint as constraint_row
     where constraint_row.conrelid = 'app_private.flight_supplier_booking_executions'::regclass
       and constraint_row.conname = item.name;
    if constraint_oid is null or constraint_type <> item.kind then raise exception 'required B13 constraint % is missing or drifted', item.name; end if;
    if signature is null then
      execute format('comment on constraint %I on app_private.flight_supplier_booking_executions is %L', item.name, 'hajiz:b13:' || item.name || ':v1');
    elsif signature is distinct from 'hajiz:b13:' || item.name || ':v1' then
      raise exception 'B13 constraint % has a non-canonical signature', item.name;
    end if;
  end loop;
end
$migration$;

do $migration$
declare existing_index regclass := to_regclass('app_private.flight_supplier_executions_provider_ref_idx');
begin
  if existing_index is null then
    create index flight_supplier_executions_provider_ref_idx
      on app_private.flight_supplier_booking_executions(provider, supplier_booking_ref)
      where supplier_booking_ref is not null;
    comment on index app_private.flight_supplier_executions_provider_ref_idx is 'hajiz:b13:flight_supplier_executions_provider_ref_idx:v1';
  elsif pg_catalog.obj_description(existing_index::oid, 'pg_class') is distinct from 'hajiz:b13:flight_supplier_executions_provider_ref_idx:v1' then
    raise exception 'flight_supplier_executions_provider_ref_idx is non-canonical';
  end if;
end
$migration$;

do $migration$
declare existing_index regclass := to_regclass('app_private.flight_supplier_executions_booking_intent_idx');
begin
  if existing_index is null then
    create index flight_supplier_executions_booking_intent_idx
      on app_private.flight_supplier_booking_executions(booking_intent_id);
    comment on index app_private.flight_supplier_executions_booking_intent_idx is 'hajiz:b13:flight_supplier_executions_booking_intent_idx:v1';
  elsif pg_catalog.obj_description(existing_index::oid, 'pg_class') is distinct from 'hajiz:b13:flight_supplier_executions_booking_intent_idx:v1' then
    raise exception 'flight_supplier_executions_booking_intent_idx is non-canonical';
  end if;
end
$migration$;

alter table app_private.flight_supplier_booking_executions enable row level security;
alter table app_private.flight_supplier_booking_executions no force row level security;

do $migration$
declare policy_signature text;
begin
  select pg_catalog.obj_description(policy_row.oid, 'pg_policy') into policy_signature
    from pg_catalog.pg_policy as policy_row
   where policy_row.polrelid = 'app_private.flight_supplier_booking_executions'::regclass
     and policy_row.polname = 'flight_supplier_executions_direct_access_denied';
  if not found then
    create policy flight_supplier_executions_direct_access_denied
      on app_private.flight_supplier_booking_executions
      for all to anon, authenticated using (false) with check (false);
    select pg_catalog.obj_description(policy_row.oid, 'pg_policy') into policy_signature
      from pg_catalog.pg_policy as policy_row
     where policy_row.polrelid = 'app_private.flight_supplier_booking_executions'::regclass
       and policy_row.polname = 'flight_supplier_executions_direct_access_denied';
    execute format('comment on policy flight_supplier_executions_direct_access_denied on app_private.flight_supplier_booking_executions is %L', 'hajiz:b13:flight_supplier_executions_direct_access_denied:v1');
  elsif policy_signature is distinct from 'hajiz:b13:flight_supplier_executions_direct_access_denied:v1' then
    raise exception 'flight_supplier_executions_direct_access_denied is non-canonical';
  end if;
end
$migration$;

revoke all on table app_private.flight_supplier_booking_executions from public, anon, authenticated, service_role;

create or replace function app_private.project_flight_supplier_booking_execution_v1(
  p_execution_id uuid,
  p_should_send boolean default false,
  p_replayed boolean default false
)
returns table(
  execution_id uuid, operation_id uuid, booking_id uuid, booking_ref text,
  payment_id uuid, booking_intent_id uuid, owner_id uuid, provider text,
  internal_offer_id text, provider_offer_ref text, traveler_snapshot jsonb,
  contact_snapshot jsonb, idempotency_key text, request_digest text,
  execution_state text, booking_status public.booking_status,
  payment_status public.payment_status, supplier_booking_ref text,
  supplier_locator text, response_digest text, safe_metadata jsonb,
  reconciliation_required boolean, supplier_accepted_at timestamptz,
  should_send boolean, replayed boolean
)
language sql stable security invoker set search_path = ''
as $function$
  select execution.id, execution.operation_id, execution.booking_id, booking.booking_ref,
         execution.payment_id, execution.booking_intent_id, execution.owner_id,
         execution.provider, execution.internal_offer_id, execution.provider_offer_ref,
         intent.traveler_snapshot, intent.contact_snapshot, execution.idempotency_key,
         execution.request_digest, execution.execution_state, booking.status, payment.status,
         execution.supplier_booking_ref, execution.supplier_locator, execution.response_digest,
         execution.safe_metadata, execution.reconciliation_required,
         execution.supplier_accepted_at, p_should_send, p_replayed
    from app_private.flight_supplier_booking_executions as execution
    join public.bookings as booking on booking.id = execution.booking_id
    join public.payments as payment on payment.id = execution.payment_id
    join app_private.flight_booking_intents as intent on intent.id = execution.booking_intent_id
   where execution.id = p_execution_id
$function$;

revoke all on function app_private.project_flight_supplier_booking_execution_v1(uuid,boolean,boolean) from public, anon, authenticated, service_role;

create or replace function public.prepare_flight_supplier_booking_execution_v1(
  p_owner_id uuid, p_booking_id uuid, p_idempotency_key text, p_request_digest text
)
returns table(
  execution_id uuid, operation_id uuid, booking_id uuid, booking_ref text,
  payment_id uuid, booking_intent_id uuid, owner_id uuid, provider text,
  internal_offer_id text, provider_offer_ref text, traveler_snapshot jsonb,
  contact_snapshot jsonb, idempotency_key text, request_digest text,
  execution_state text, booking_status public.booking_status,
  payment_status public.payment_status, supplier_booking_ref text,
  supplier_locator text, response_digest text, safe_metadata jsonb,
  reconciliation_required boolean, supplier_accepted_at timestamptz,
  should_send boolean, replayed boolean
)
language plpgsql security definer set search_path = ''
as $function$
declare
  booking public.bookings%rowtype;
  payment public.payments%rowtype;
  initiation app_private.flight_payment_initiations%rowtype;
  intent app_private.flight_booking_intents%rowtype;
  offer public.offers%rowtype;
  execution app_private.flight_supplier_booking_executions%rowtype;
  operation app_private.supplier_operations%rowtype;
begin
  if p_owner_id is null or p_booking_id is null or p_idempotency_key is null or p_request_digest is null or p_idempotency_key !~ '^hsb_req_[A-Za-z0-9_-]{16,80}$' or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid supplier booking execution request' using errcode = '22023';
  end if;
  select booking_row.* into strict booking from public.bookings as booking_row where booking_row.id = p_booking_id and booking_row.user_id = p_owner_id for update;
  select payment_row.* into strict payment from public.payments as payment_row where payment_row.booking_id = booking.id and payment_row.user_id = p_owner_id for update;
  select initiation_row.* into strict initiation from app_private.flight_payment_initiations as initiation_row where initiation_row.booking_id = booking.id and initiation_row.payment_id = payment.id and initiation_row.owner_id = p_owner_id;
  select intent_row.* into strict intent from app_private.flight_booking_intents as intent_row where intent_row.id = initiation.booking_intent_id and intent_row.owner_id = p_owner_id;
  select offer_row.* into strict offer from public.offers as offer_row where offer_row.id = booking.offer_id;

  select execution_row.* into execution from app_private.flight_supplier_booking_executions as execution_row
   where execution_row.booking_id = booking.id or (execution_row.owner_id = p_owner_id and execution_row.idempotency_key = p_idempotency_key)
   order by execution_row.created_at limit 1 for update;
  if found then
    if execution.booking_id <> booking.id or execution.owner_id <> p_owner_id or execution.idempotency_key <> p_idempotency_key or execution.request_digest <> p_request_digest then
      raise exception 'supplier booking execution idempotency conflict' using errcode = '23505';
    end if;
    return query select * from app_private.project_flight_supplier_booking_execution_v1(execution.id, false, true);
    return;
  end if;

  if payment.status <> 'confirmed' then raise exception 'payment is not confirmed' using errcode = '22023'; end if;
  if booking.status <> 'payment_confirmed' then raise exception 'booking is not payment_confirmed' using errcode = '22023'; end if;
  if initiation.state <> 'MATERIALIZED' or booking.supplier_reference is not null then raise exception 'booking lineage or supplier state is not executable' using errcode = '22023'; end if;
  if booking.supplier_contract_version is distinct from 'flight-offer/v1' or booking.supplier_provider is distinct from intent.provider or booking.supplier_provider is distinct from offer.supplier_provider or offer.internal_offer_key is distinct from intent.internal_offer_id or offer.supplier_offer_ref is distinct from intent.provider_offer_ref then
    raise exception 'protected supplier identity mismatch' using errcode = '22023';
  end if;
  if booking.traveler_snapshot is distinct from pg_catalog.jsonb_build_object('contractVersion','flight-booking-travelers/v1','travelers',intent.traveler_snapshot,'contact',intent.contact_snapshot) then
    raise exception 'trusted traveler lineage mismatch' using errcode = '22023';
  end if;
  if exists(select 1 from app_private.supplier_operations as prior where prior.booking_id=booking.id and prior.provider=intent.provider and prior.operation='create_booking') then
    raise exception 'a supplier create-booking operation already exists' using errcode = '23505';
  end if;

  insert into app_private.supplier_operations(booking_id, offer_id, provider, operation, idempotency_key, status, request_digest, result_metadata)
  values(booking.id, offer.id, intent.provider, 'create_booking', p_idempotency_key, 'pending', p_request_digest, pg_catalog.jsonb_build_object('contractVersion','flight-supplier-booking-execution/v1','executionState','PREPARED'))
  returning * into operation;

  insert into app_private.flight_supplier_booking_executions(operation_id, booking_id, payment_id, booking_intent_id, owner_id, provider, internal_offer_id, provider_offer_ref, idempotency_key, request_digest)
  values(operation.id, booking.id, payment.id, intent.id, p_owner_id, intent.provider, intent.internal_offer_id, intent.provider_offer_ref, p_idempotency_key, p_request_digest)
  returning * into execution;

  return query select * from app_private.project_flight_supplier_booking_execution_v1(execution.id, false, false);
exception when no_data_found then raise exception 'trusted booking execution lineage unavailable' using errcode = 'P0002';
end
$function$;

create or replace function public.mark_flight_supplier_booking_request_sent_v1(
  p_owner_id uuid, p_booking_id uuid, p_idempotency_key text, p_request_digest text
)
returns table(
  execution_id uuid, operation_id uuid, booking_id uuid, booking_ref text,
  payment_id uuid, booking_intent_id uuid, owner_id uuid, provider text,
  internal_offer_id text, provider_offer_ref text, traveler_snapshot jsonb,
  contact_snapshot jsonb, idempotency_key text, request_digest text,
  execution_state text, booking_status public.booking_status,
  payment_status public.payment_status, supplier_booking_ref text,
  supplier_locator text, response_digest text, safe_metadata jsonb,
  reconciliation_required boolean, supplier_accepted_at timestamptz,
  should_send boolean, replayed boolean
)
language plpgsql security definer set search_path = ''
as $function$
declare execution app_private.flight_supplier_booking_executions%rowtype; booking public.bookings%rowtype; payment public.payments%rowtype;
begin
  -- Keep the same booking -> payment -> execution lock order in every B13 RPC.
  select booking_row.* into strict booking from public.bookings as booking_row where booking_row.id=p_booking_id and booking_row.user_id=p_owner_id for update;
  select payment_row.* into strict payment from public.payments as payment_row where payment_row.booking_id=booking.id and payment_row.user_id=p_owner_id for update;
  select execution_row.* into strict execution from app_private.flight_supplier_booking_executions as execution_row where execution_row.booking_id=booking.id and execution_row.payment_id=payment.id and execution_row.owner_id=p_owner_id and execution_row.idempotency_key=p_idempotency_key and execution_row.request_digest=p_request_digest for update;
  if execution.execution_state <> 'PREPARED' then return query select * from app_private.project_flight_supplier_booking_execution_v1(execution.id,false,true); return; end if;
  if payment.status <> 'confirmed' then raise exception 'payment is not confirmed' using errcode='22023'; end if;
  if booking.status <> 'payment_confirmed' then raise exception 'booking is not payment_confirmed' using errcode='22023'; end if;
  update public.bookings set status='processing',updated_at=pg_catalog.now() where id=booking.id and status='payment_confirmed';
  update app_private.flight_supplier_booking_executions set execution_state='REQUEST_SENT',attempt_count=1,request_sent_at=pg_catalog.now(),updated_at=pg_catalog.now() where id=execution.id returning * into execution;
  update app_private.supplier_operations set result_metadata=pg_catalog.jsonb_build_object('contractVersion','flight-supplier-booking-execution/v1','executionState','REQUEST_SENT'),updated_at=pg_catalog.now() where id=execution.operation_id;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,actor_id,idempotency_key,before_state,after_state) values('supplier',booking.id,'supplier_booking_request_sent','service',p_owner_id,p_idempotency_key,'payment_confirmed','processing');
  return query select * from app_private.project_flight_supplier_booking_execution_v1(execution.id,true,false);
end
$function$;

create or replace function public.complete_flight_supplier_booking_execution_v1(
  p_owner_id uuid, p_booking_id uuid, p_idempotency_key text, p_request_digest text,
  p_outcome text, p_supplier_booking_ref text, p_supplier_locator text,
  p_response_digest text, p_safe_metadata jsonb
)
returns table(
  execution_id uuid, operation_id uuid, booking_id uuid, booking_ref text,
  payment_id uuid, booking_intent_id uuid, owner_id uuid, provider text,
  internal_offer_id text, provider_offer_ref text, traveler_snapshot jsonb,
  contact_snapshot jsonb, idempotency_key text, request_digest text,
  execution_state text, booking_status public.booking_status,
  payment_status public.payment_status, supplier_booking_ref text,
  supplier_locator text, response_digest text, safe_metadata jsonb,
  reconciliation_required boolean, supplier_accepted_at timestamptz,
  should_send boolean, replayed boolean
)
language plpgsql security definer set search_path = ''
as $function$
declare execution app_private.flight_supplier_booking_executions%rowtype; booking public.bookings%rowtype; payment public.payments%rowtype;
begin
  if p_outcome is null or p_response_digest is null or p_safe_metadata is null or p_outcome not in ('SUBMITTED','ACCEPTED') or p_supplier_booking_ref is null or char_length(p_supplier_booking_ref) not between 1 and 255 or p_supplier_booking_ref ~ '[[:cntrl:]]' or p_response_digest !~ '^[a-f0-9]{64}$' or pg_catalog.jsonb_typeof(p_safe_metadata) <> 'object' or pg_catalog.pg_column_size(p_safe_metadata)>4096 then raise exception 'invalid trusted supplier result' using errcode='22023'; end if;
  select booking_row.* into strict booking from public.bookings as booking_row where booking_row.id=p_booking_id and booking_row.user_id=p_owner_id for update;
  select payment_row.* into strict payment from public.payments as payment_row where payment_row.booking_id=booking.id and payment_row.user_id=p_owner_id for update;
  select execution_row.* into strict execution from app_private.flight_supplier_booking_executions as execution_row where execution_row.booking_id=booking.id and execution_row.payment_id=payment.id and execution_row.owner_id=p_owner_id and execution_row.idempotency_key=p_idempotency_key and execution_row.request_digest=p_request_digest for update;
  if execution.execution_state='ACCEPTED' then
    if execution.response_digest is distinct from p_response_digest or execution.supplier_booking_ref is distinct from p_supplier_booking_ref then raise exception 'supplier booking replay conflict' using errcode='23505'; end if;
    return query select * from app_private.project_flight_supplier_booking_execution_v1(execution.id,false,true); return;
  end if;
  if execution.execution_state not in ('REQUEST_SENT','SUBMITTED','UNKNOWN') then raise exception 'supplier result is not applicable' using errcode='22023'; end if;
  if execution.execution_state='UNKNOWN' and execution.supplier_booking_ref is null then raise exception 'unknown supplier outcome requires external reconciliation' using errcode='22023'; end if;
  if execution.supplier_booking_ref is not null and execution.supplier_booking_ref is distinct from p_supplier_booking_ref then raise exception 'supplier booking identity mismatch' using errcode='22023'; end if;
  if payment.status <> 'confirmed' then raise exception 'payment is not confirmed' using errcode='22023'; end if;
  if booking.status <> 'processing' then raise exception 'booking is not processing' using errcode='22023'; end if;
  update app_private.flight_supplier_booking_executions set execution_state=p_outcome,supplier_booking_ref=p_supplier_booking_ref,supplier_locator=p_supplier_locator,response_digest=p_response_digest,safe_metadata=p_safe_metadata,reconciliation_required=false,response_received_at=pg_catalog.now(),supplier_accepted_at=case when p_outcome='ACCEPTED' then pg_catalog.now() else supplier_accepted_at end,reconciled_at=case when execution.execution_state='UNKNOWN' then pg_catalog.now() else reconciled_at end,updated_at=pg_catalog.now() where id=execution.id returning * into execution;
  update app_private.supplier_operations set provider_operation_ref=p_supplier_booking_ref,status=case when p_outcome='ACCEPTED' then 'succeeded' else 'pending' end,result_metadata=p_safe_metadata,updated_at=pg_catalog.now() where id=execution.operation_id;
  if p_outcome='ACCEPTED' then
    update public.bookings set status='confirmed',supplier_reference=p_supplier_booking_ref,supplier_status='confirmed',supplier_metadata=p_safe_metadata,updated_at=pg_catalog.now() where id=booking.id and status='processing';
    insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,actor_id,idempotency_key,before_state,after_state,event_digest,metadata) values('supplier',booking.id,'supplier_booking_accepted','supplier',null,p_idempotency_key,'processing','confirmed',p_response_digest,p_safe_metadata);
  end if;
  return query select * from app_private.project_flight_supplier_booking_execution_v1(execution.id,false,false);
end
$function$;

create or replace function public.record_flight_supplier_booking_failure_v1(
  p_owner_id uuid, p_booking_id uuid, p_idempotency_key text, p_request_digest text,
  p_failure_code text, p_unknown boolean, p_supplier_booking_ref text default null
)
returns table(
  execution_id uuid, operation_id uuid, booking_id uuid, booking_ref text,
  payment_id uuid, booking_intent_id uuid, owner_id uuid, provider text,
  internal_offer_id text, provider_offer_ref text, traveler_snapshot jsonb,
  contact_snapshot jsonb, idempotency_key text, request_digest text,
  execution_state text, booking_status public.booking_status,
  payment_status public.payment_status, supplier_booking_ref text,
  supplier_locator text, response_digest text, safe_metadata jsonb,
  reconciliation_required boolean, supplier_accepted_at timestamptz,
  should_send boolean, replayed boolean
)
language plpgsql security definer set search_path = ''
as $function$
declare execution app_private.flight_supplier_booking_executions%rowtype; booking public.bookings%rowtype; payment public.payments%rowtype; target_state text; safe_result jsonb;
begin
  if p_failure_code is null or p_unknown is null or p_failure_code !~ '^[A-Z][A-Z0-9_]{2,63}$' then raise exception 'invalid supplier failure code' using errcode='22023'; end if;
  if p_supplier_booking_ref is not null and (char_length(p_supplier_booking_ref) not between 1 and 255 or p_supplier_booking_ref ~ '[[:cntrl:]]') then raise exception 'invalid supplier booking reference' using errcode='22023'; end if;
  select booking_row.* into strict booking from public.bookings as booking_row where booking_row.id=p_booking_id and booking_row.user_id=p_owner_id for update;
  select payment_row.* into strict payment from public.payments as payment_row where payment_row.booking_id=booking.id and payment_row.user_id=p_owner_id for update;
  select execution_row.* into strict execution from app_private.flight_supplier_booking_executions as execution_row where execution_row.booking_id=booking.id and execution_row.payment_id=payment.id and execution_row.owner_id=p_owner_id and execution_row.idempotency_key=p_idempotency_key and execution_row.request_digest=p_request_digest for update;
  if execution.execution_state in ('ACCEPTED','REJECTED','FAILED','UNKNOWN') then return query select * from app_private.project_flight_supplier_booking_execution_v1(execution.id,false,true); return; end if;
  if p_unknown and execution.execution_state <> 'REQUEST_SENT' then raise exception 'unknown outcome requires a sent request' using errcode='22023'; end if;
  target_state := case when p_unknown then 'UNKNOWN' when p_failure_code='SUPPLIER_REJECTED' then 'REJECTED' else 'FAILED' end;
  safe_result := pg_catalog.jsonb_build_object('contractVersion','flight-supplier-booking-execution/v1','failureCode',p_failure_code);
  update app_private.flight_supplier_booking_executions set execution_state=target_state,supplier_booking_ref=coalesce(p_supplier_booking_ref,supplier_booking_ref),safe_metadata=safe_result,reconciliation_required=p_unknown,failure_code=p_failure_code,response_received_at=pg_catalog.now(),unknown_outcome_at=case when p_unknown then pg_catalog.now() else null end,updated_at=pg_catalog.now() where id=execution.id returning * into execution;
  update app_private.supplier_operations set provider_operation_ref=coalesce(p_supplier_booking_ref,provider_operation_ref),status=case when p_unknown then 'unknown' else 'failed' end,result_metadata=safe_result,updated_at=pg_catalog.now() where id=execution.operation_id;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,actor_id,idempotency_key,before_state,after_state,reason,metadata) values('supplier',p_booking_id,'supplier_booking_exception','service',p_owner_id,p_idempotency_key,null,target_state,p_failure_code,safe_result);
  return query select * from app_private.project_flight_supplier_booking_execution_v1(execution.id,false,false);
end
$function$;

revoke all on function public.prepare_flight_supplier_booking_execution_v1(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.mark_flight_supplier_booking_request_sent_v1(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.complete_flight_supplier_booking_execution_v1(uuid,uuid,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.record_flight_supplier_booking_failure_v1(uuid,uuid,text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.prepare_flight_supplier_booking_execution_v1(uuid,uuid,text,text) to service_role;
grant execute on function public.mark_flight_supplier_booking_request_sent_v1(uuid,uuid,text,text) to service_role;
grant execute on function public.complete_flight_supplier_booking_execution_v1(uuid,uuid,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.record_flight_supplier_booking_failure_v1(uuid,uuid,text,text,text,boolean,text) to service_role;

do $migration$
declare
  table_owner oid;
  relation_owner oid;
  function_owner oid;
  item record;
  function_oid regprocedure;
begin
  select relation.relowner into strict table_owner from pg_catalog.pg_class as relation where relation.oid='app_private.flight_supplier_booking_executions'::regclass;
  for item in select * from (values
    ('app_private.flight_booking_intents'::regclass),
    ('app_private.flight_payment_initiations'::regclass),
    ('app_private.supplier_operations'::regclass)
  ) as relations(oid)
  loop
    select relation.relowner into strict relation_owner from pg_catalog.pg_class as relation where relation.oid=item.oid;
    if relation_owner is distinct from table_owner then raise exception 'B11/B12/B13 private tables must share one owner'; end if;
  end loop;
  for item in select * from (values
    ('public.prepare_flight_supplier_booking_execution_v1(uuid,uuid,text,text)'),
    ('public.mark_flight_supplier_booking_request_sent_v1(uuid,uuid,text,text)'),
    ('public.complete_flight_supplier_booking_execution_v1(uuid,uuid,text,text,text,text,text,text,jsonb)'),
    ('public.record_flight_supplier_booking_failure_v1(uuid,uuid,text,text,text,boolean,text)')
  ) as functions(signature)
  loop
    function_oid := pg_catalog.to_regprocedure(item.signature);
    select function_row.proowner into strict function_owner from pg_catalog.pg_proc as function_row where function_row.oid=function_oid;
    if function_owner is distinct from table_owner then raise exception 'B13 RPC % and private tables must share one owner',item.signature; end if;
  end loop;
end
$migration$;
