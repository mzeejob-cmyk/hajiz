-- HAJIZ B14: durable supplier ticketing and owner-scoped ticket metadata.
-- Additive code-only migration; deliberately not applied by this batch.

do $migration$
declare
  relation regclass := pg_catalog.to_regclass('app_private.flight_supplier_ticketing_executions');
  relation_owner oid;
  signature text;
  current_owner oid := (select role_row.oid from pg_catalog.pg_roles as role_row where role_row.rolname = current_user);
begin
  if relation is null then
    create table app_private.flight_supplier_ticketing_executions (
      id uuid primary key default gen_random_uuid(),
      operation_id uuid unique references app_private.supplier_operations(id) on delete restrict,
      supplier_execution_id uuid not null unique references app_private.flight_supplier_booking_executions(id) on delete restrict,
      booking_id uuid not null unique references public.bookings(id) on delete restrict,
      owner_id uuid not null references auth.users(id) on delete restrict,
      provider text not null,
      supplier_booking_ref text not null,
      idempotency_key text not null,
      request_digest text not null,
      ticketing_operation text,
      execution_state text not null default 'PREPARED',
      attempt_count integer not null default 0,
      response_digest text,
      safe_metadata jsonb not null default '{}'::jsonb,
      reconciliation_required boolean not null default false,
      failure_code text,
      request_sent_at timestamptz,
      response_received_at timestamptz,
      issued_at timestamptz,
      unknown_outcome_at timestamptz,
      reconciled_at timestamptz,
      created_at timestamptz not null default pg_catalog.now(),
      updated_at timestamptz not null default pg_catalog.now(),
      constraint flight_ticketing_provider_check check (provider ~ '^[a-z][a-z0-9_-]{1,63}$'),
      constraint flight_ticketing_supplier_ref_check check (char_length(supplier_booking_ref) between 1 and 255 and supplier_booking_ref !~ '[[:cntrl:]]'),
      constraint flight_ticketing_idempotency_check check (idempotency_key ~ '^hst_req_[A-Za-z0-9_-]{16,80}$'),
      constraint flight_ticketing_request_digest_check check (request_digest ~ '^[a-f0-9]{64}$'),
      constraint flight_ticketing_operation_check check (ticketing_operation is null or ticketing_operation in ('confirm_booking','retrieve_ticket')),
      constraint flight_ticketing_state_check check (execution_state in ('PREPARED','REQUEST_SENT','PROCESSING','ISSUED','REJECTED','FAILED','UNKNOWN')),
      constraint flight_ticketing_attempt_check check (attempt_count between 0 and 1),
      constraint flight_ticketing_response_digest_check check (response_digest is null or response_digest ~ '^[a-f0-9]{64}$'),
      constraint flight_ticketing_safe_metadata_check check (pg_catalog.jsonb_typeof(safe_metadata) = 'object' and pg_catalog.pg_column_size(safe_metadata) <= 4096),
      constraint flight_ticketing_reconciliation_check check ((execution_state = 'UNKNOWN') = reconciliation_required),
      constraint flight_ticketing_owner_key_unique unique (owner_id, idempotency_key)
    );
    comment on table app_private.flight_supplier_ticketing_executions is 'hajiz:b14:flight_supplier_ticketing_executions:v1';
    relation := 'app_private.flight_supplier_ticketing_executions'::regclass;
  else
    select row.relowner, pg_catalog.obj_description(row.oid, 'pg_class') into relation_owner, signature from pg_catalog.pg_class as row where row.oid = relation;
    if relation_owner is distinct from current_owner or signature is distinct from 'hajiz:b14:flight_supplier_ticketing_executions:v1' then raise exception 'flight_supplier_ticketing_executions exists with non-canonical ownership or signature'; end if;
  end if;
  if (select count(*) from pg_catalog.pg_attribute as column_row where column_row.attrelid = relation and column_row.attnum > 0 and not column_row.attisdropped) <> 23 then raise exception 'flight_supplier_ticketing_executions has non-canonical columns'; end if;
end
$migration$;

do $migration$
declare
  relation regclass := pg_catalog.to_regclass('app_private.flight_ticket_records');
  relation_owner oid;
  signature text;
  current_owner oid := (select role_row.oid from pg_catalog.pg_roles as role_row where role_row.rolname = current_user);
begin
  if relation is null then
    create table app_private.flight_ticket_records (
      id uuid primary key default gen_random_uuid(),
      ticketing_execution_id uuid not null references app_private.flight_supplier_ticketing_executions(id) on delete restrict,
      booking_id uuid not null references public.bookings(id) on delete restrict,
      owner_id uuid not null references auth.users(id) on delete restrict,
      provider text not null,
      traveler_key text not null,
      ticket_number text not null,
      supplier_ticket_ref text,
      issued_at timestamptz not null,
      artifact_availability text not null default 'NONE',
      artifact_ref text,
      artifact_media_type text,
      artifact_digest text,
      created_at timestamptz not null default pg_catalog.now(),
      constraint flight_ticket_records_provider_check check (provider ~ '^[a-z][a-z0-9_-]{1,63}$'),
      constraint flight_ticket_records_traveler_key_check check (traveler_key ~ '^[A-Za-z0-9_-]{1,40}$'),
      constraint flight_ticket_records_ticket_number_check check (char_length(ticket_number) between 1 and 255 and ticket_number !~ '[[:cntrl:]]'),
      constraint flight_ticket_records_supplier_ref_check check (supplier_ticket_ref is null or (char_length(supplier_ticket_ref) between 1 and 255 and supplier_ticket_ref !~ '[[:cntrl:]]')),
      constraint flight_ticket_records_artifact_state_check check (artifact_availability in ('NONE','METADATA_ONLY','AVAILABLE')),
      constraint flight_ticket_records_artifact_shape_check check ((artifact_availability = 'AVAILABLE' and artifact_ref is not null and artifact_media_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$' and artifact_digest ~ '^[a-f0-9]{64}$') or (artifact_availability <> 'AVAILABLE' and artifact_ref is null and artifact_media_type is null and artifact_digest is null)),
      constraint flight_ticket_records_execution_traveler_unique unique (ticketing_execution_id, traveler_key),
      constraint flight_ticket_records_provider_number_unique unique (provider, ticket_number)
    );
    comment on table app_private.flight_ticket_records is 'hajiz:b14:flight_ticket_records:v1';
    relation := 'app_private.flight_ticket_records'::regclass;
  else
    select row.relowner, pg_catalog.obj_description(row.oid, 'pg_class') into relation_owner, signature from pg_catalog.pg_class as row where row.oid = relation;
    if relation_owner is distinct from current_owner or signature is distinct from 'hajiz:b14:flight_ticket_records:v1' then raise exception 'flight_ticket_records exists with non-canonical ownership or signature'; end if;
  end if;
  if (select count(*) from pg_catalog.pg_attribute as column_row where column_row.attrelid = relation and column_row.attnum > 0 and not column_row.attisdropped) <> 14 then raise exception 'flight_ticket_records has non-canonical columns'; end if;
end
$migration$;

do $migration$
declare item record; constraint_oid oid; constraint_type "char"; signature text;
begin
  for item in select * from (values
    ('app_private.flight_supplier_ticketing_executions','flight_supplier_ticketing_executions_pkey','p'),
    ('app_private.flight_supplier_ticketing_executions','flight_supplier_ticketing_executions_operation_id_key','u'),
    ('app_private.flight_supplier_ticketing_executions','flight_supplier_ticketing_executions_supplier_execution_id_key','u'),
    ('app_private.flight_supplier_ticketing_executions','flight_supplier_ticketing_executions_booking_id_key','u'),
    ('app_private.flight_supplier_ticketing_executions','flight_ticketing_owner_key_unique','u'),
    ('app_private.flight_supplier_ticketing_executions','flight_ticketing_state_check','c'),
    ('app_private.flight_supplier_ticketing_executions','flight_ticketing_reconciliation_check','c'),
    ('app_private.flight_ticket_records','flight_ticket_records_pkey','p'),
    ('app_private.flight_ticket_records','flight_ticket_records_execution_traveler_unique','u'),
    ('app_private.flight_ticket_records','flight_ticket_records_provider_number_unique','u'),
    ('app_private.flight_ticket_records','flight_ticket_records_artifact_shape_check','c')
  ) as constraints(table_name,name,kind)
  loop
    select row.oid,row.contype,pg_catalog.obj_description(row.oid,'pg_constraint') into constraint_oid,constraint_type,signature from pg_catalog.pg_constraint as row where row.conrelid=item.table_name::regclass and row.conname=item.name;
    if constraint_oid is null or constraint_type <> item.kind then raise exception 'required B14 constraint % is missing or drifted',item.name; end if;
    if signature is null then execute format('comment on constraint %I on %s is %L',item.name,item.table_name,'hajiz:b14:'||item.name||':v1'); elsif signature is distinct from 'hajiz:b14:'||item.name||':v1' then raise exception 'B14 constraint % has a non-canonical signature',item.name; end if;
  end loop;
end
$migration$;

do $migration$
declare item record; existing_index regclass; signature text;
begin
  for item in select * from (values
    ('app_private.flight_ticketing_owner_created_idx','create index flight_ticketing_owner_created_idx on app_private.flight_supplier_ticketing_executions(owner_id,created_at desc)','hajiz:b14:flight_ticketing_owner_created_idx:v1'),
    ('app_private.flight_ticket_records_booking_idx','create index flight_ticket_records_booking_idx on app_private.flight_ticket_records(booking_id,created_at)','hajiz:b14:flight_ticket_records_booking_idx:v1'),
    ('app_private.flight_ticket_records_owner_booking_idx','create index flight_ticket_records_owner_booking_idx on app_private.flight_ticket_records(owner_id,booking_id)','hajiz:b14:flight_ticket_records_owner_booking_idx:v1')
  ) as indexes(name,definition,signature)
  loop
    existing_index := pg_catalog.to_regclass(item.name);
    if existing_index is null then execute item.definition; existing_index:=pg_catalog.to_regclass(item.name); execute format('comment on index %s is %L',existing_index,item.signature);
    else select pg_catalog.obj_description(existing_index::oid,'pg_class') into signature; if signature is distinct from item.signature then raise exception 'B14 index % is non-canonical',item.name; end if; end if;
  end loop;
end
$migration$;

alter table app_private.flight_supplier_ticketing_executions enable row level security;
alter table app_private.flight_supplier_ticketing_executions no force row level security;
alter table app_private.flight_ticket_records enable row level security;
alter table app_private.flight_ticket_records no force row level security;

do $migration$
declare item record; signature text;
begin
  for item in select * from (values
    ('app_private.flight_supplier_ticketing_executions','flight_ticketing_direct_access_denied','hajiz:b14:flight_ticketing_direct_access_denied:v1'),
    ('app_private.flight_ticket_records','flight_ticket_records_direct_access_denied','hajiz:b14:flight_ticket_records_direct_access_denied:v1')
  ) as policies(table_name,name,signature)
  loop
    select pg_catalog.obj_description(row.oid,'pg_policy') into signature from pg_catalog.pg_policy as row where row.polrelid=item.table_name::regclass and row.polname=item.name;
    if not found then execute format('create policy %I on %s for all to anon,authenticated using (false) with check (false)',item.name,item.table_name); execute format('comment on policy %I on %s is %L',item.name,item.table_name,item.signature);
    elsif signature is distinct from item.signature then raise exception 'B14 policy % is non-canonical',item.name; end if;
  end loop;
end
$migration$;

revoke all on table app_private.flight_supplier_ticketing_executions from public,anon,authenticated,service_role;
revoke all on table app_private.flight_ticket_records from public,anon,authenticated,service_role;

create or replace function app_private.project_flight_supplier_ticketing_v1(p_execution_id uuid,p_should_send boolean default false,p_replayed boolean default false)
returns table(
  execution_id uuid,operation_id uuid,booking_id uuid,booking_ref text,booking_status public.booking_status,
  supplier_execution_id uuid,owner_id uuid,provider text,supplier_booking_ref text,traveler_keys jsonb,
  idempotency_key text,request_digest text,ticketing_operation text,execution_state text,ticket_count bigint,
  can_download_ticket boolean,response_digest text,safe_metadata jsonb,reconciliation_required boolean,issued_at timestamptz,
  should_send boolean,replayed boolean
)
language sql stable security invoker set search_path=''
as $function$
  select execution.id,execution.operation_id,execution.booking_id,booking.booking_ref,booking.status,
         execution.supplier_execution_id,execution.owner_id,execution.provider,execution.supplier_booking_ref,
         (select coalesce(pg_catalog.jsonb_agg(element.value->>'travelerKey' order by element.ordinality),'[]'::jsonb) from pg_catalog.jsonb_array_elements(intent.traveler_snapshot) with ordinality as element(value,ordinality)),
         execution.idempotency_key,execution.request_digest,execution.ticketing_operation,execution.execution_state,
         (select count(*) from app_private.flight_ticket_records as ticket where ticket.ticketing_execution_id=execution.id),
         coalesce((select pg_catalog.bool_and(ticket.artifact_availability='AVAILABLE') from app_private.flight_ticket_records as ticket where ticket.ticketing_execution_id=execution.id),false),
         execution.response_digest,execution.safe_metadata,execution.reconciliation_required,execution.issued_at,p_should_send,p_replayed
    from app_private.flight_supplier_ticketing_executions as execution
    join public.bookings as booking on booking.id=execution.booking_id
    join app_private.flight_supplier_booking_executions as supplier on supplier.id=execution.supplier_execution_id
    join app_private.flight_booking_intents as intent on intent.id=supplier.booking_intent_id
   where execution.id=p_execution_id
$function$;
revoke all on function app_private.project_flight_supplier_ticketing_v1(uuid,boolean,boolean) from public,anon,authenticated,service_role;

create or replace function public.prepare_flight_supplier_ticketing_v1(p_owner_id uuid,p_booking_id uuid,p_idempotency_key text,p_request_digest text)
returns table(
  execution_id uuid,operation_id uuid,booking_id uuid,booking_ref text,booking_status public.booking_status,
  supplier_execution_id uuid,owner_id uuid,provider text,supplier_booking_ref text,traveler_keys jsonb,
  idempotency_key text,request_digest text,ticketing_operation text,execution_state text,ticket_count bigint,
  can_download_ticket boolean,response_digest text,safe_metadata jsonb,reconciliation_required boolean,issued_at timestamptz,
  should_send boolean,replayed boolean
)
language plpgsql security definer set search_path=''
as $function$
declare booking public.bookings%rowtype; supplier app_private.flight_supplier_booking_executions%rowtype; execution app_private.flight_supplier_ticketing_executions%rowtype;
begin
  if p_owner_id is null or p_booking_id is null or p_idempotency_key !~ '^hst_req_[A-Za-z0-9_-]{16,80}$' or p_request_digest !~ '^[a-f0-9]{64}$' then raise exception 'invalid ticketing request' using errcode='22023'; end if;
  select row.* into strict booking from public.bookings as row where row.id=p_booking_id and row.user_id=p_owner_id for update;
  select row.* into strict supplier from app_private.flight_supplier_booking_executions as row where row.booking_id=booking.id and row.owner_id=p_owner_id for update;
  select row.* into execution from app_private.flight_supplier_ticketing_executions as row where row.booking_id=booking.id or (row.owner_id=p_owner_id and row.idempotency_key=p_idempotency_key) order by row.created_at limit 1 for update;
  if found then
    if execution.booking_id<>booking.id or execution.owner_id<>p_owner_id or execution.idempotency_key<>p_idempotency_key or execution.request_digest<>p_request_digest then raise exception 'ticketing idempotency conflict' using errcode='23505'; end if;
    return query select * from app_private.project_flight_supplier_ticketing_v1(execution.id,false,true); return;
  end if;
  if booking.status<>'confirmed' then raise exception 'booking is not confirmed' using errcode='22023'; end if;
  if supplier.execution_state<>'ACCEPTED' or supplier.supplier_accepted_at is null then raise exception 'B13 accepted execution is required' using errcode='22023'; end if;
  if supplier.booking_id<>booking.id or supplier.owner_id<>p_owner_id or supplier.provider is distinct from booking.supplier_provider or supplier.supplier_booking_ref is null or supplier.supplier_booking_ref is distinct from booking.supplier_reference then raise exception 'B13 supplier identity mismatch' using errcode='22023'; end if;
  insert into app_private.flight_supplier_ticketing_executions(supplier_execution_id,booking_id,owner_id,provider,supplier_booking_ref,idempotency_key,request_digest)
  values(supplier.id,booking.id,p_owner_id,supplier.provider,supplier.supplier_booking_ref,p_idempotency_key,p_request_digest) returning * into execution;
  return query select * from app_private.project_flight_supplier_ticketing_v1(execution.id,false,false);
exception when no_data_found then raise exception 'trusted ticketing lineage unavailable' using errcode='P0002';
end
$function$;

create or replace function public.mark_flight_supplier_ticketing_request_sent_v1(p_owner_id uuid,p_booking_id uuid,p_idempotency_key text,p_request_digest text,p_operation text)
returns table(
  execution_id uuid,operation_id uuid,booking_id uuid,booking_ref text,booking_status public.booking_status,
  supplier_execution_id uuid,owner_id uuid,provider text,supplier_booking_ref text,traveler_keys jsonb,
  idempotency_key text,request_digest text,ticketing_operation text,execution_state text,ticket_count bigint,
  can_download_ticket boolean,response_digest text,safe_metadata jsonb,reconciliation_required boolean,issued_at timestamptz,
  should_send boolean,replayed boolean
)
language plpgsql security definer set search_path=''
as $function$
declare booking public.bookings%rowtype; supplier app_private.flight_supplier_booking_executions%rowtype; execution app_private.flight_supplier_ticketing_executions%rowtype; operation app_private.supplier_operations%rowtype;
begin
  if p_operation not in ('confirm_booking','retrieve_ticket') then raise exception 'invalid ticketing operation' using errcode='22023'; end if;
  -- Canonical lock order: booking -> B13 supplier execution -> B14 ticketing execution.
  select row.* into strict booking from public.bookings as row where row.id=p_booking_id and row.user_id=p_owner_id for update;
  select row.* into strict supplier from app_private.flight_supplier_booking_executions as row where row.booking_id=booking.id and row.owner_id=p_owner_id for update;
  select row.* into strict execution from app_private.flight_supplier_ticketing_executions as row where row.booking_id=booking.id and row.supplier_execution_id=supplier.id and row.owner_id=p_owner_id and row.idempotency_key=p_idempotency_key and row.request_digest=p_request_digest for update;
  if execution.execution_state<>'PREPARED' then return query select * from app_private.project_flight_supplier_ticketing_v1(execution.id,false,true); return; end if;
  if booking.status<>'confirmed' or supplier.execution_state<>'ACCEPTED' or supplier.supplier_booking_ref is distinct from execution.supplier_booking_ref then raise exception 'ticketing authority changed' using errcode='22023'; end if;
  insert into app_private.supplier_operations(booking_id,offer_id,provider,operation,idempotency_key,status,request_digest,result_metadata)
  values(booking.id,booking.offer_id,execution.provider,p_operation,p_idempotency_key,'pending',p_request_digest,pg_catalog.jsonb_build_object('contractVersion','flight-supplier-ticketing/v1','executionState','REQUEST_SENT')) returning * into operation;
  update app_private.flight_supplier_ticketing_executions set operation_id=operation.id,ticketing_operation=p_operation,execution_state='REQUEST_SENT',attempt_count=1,request_sent_at=pg_catalog.now(),updated_at=pg_catalog.now() where id=execution.id returning * into execution;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,actor_id,idempotency_key,before_state,after_state) values('supplier',booking.id,'supplier_ticketing_request_sent','service',p_owner_id,p_idempotency_key,'confirmed','confirmed');
  return query select * from app_private.project_flight_supplier_ticketing_v1(execution.id,true,false);
end
$function$;

create or replace function public.complete_flight_supplier_ticketing_v1(
  p_owner_id uuid,p_booking_id uuid,p_idempotency_key text,p_request_digest text,p_outcome text,p_tickets jsonb,p_response_digest text,p_safe_metadata jsonb
)
returns table(
  execution_id uuid,operation_id uuid,booking_id uuid,booking_ref text,booking_status public.booking_status,
  supplier_execution_id uuid,owner_id uuid,provider text,supplier_booking_ref text,traveler_keys jsonb,
  idempotency_key text,request_digest text,ticketing_operation text,execution_state text,ticket_count bigint,
  can_download_ticket boolean,response_digest text,safe_metadata jsonb,reconciliation_required boolean,issued_at timestamptz,
  should_send boolean,replayed boolean
)
language plpgsql security definer set search_path=''
as $function$
declare booking public.bookings%rowtype; supplier app_private.flight_supplier_booking_executions%rowtype; execution app_private.flight_supplier_ticketing_executions%rowtype; intent app_private.flight_booking_intents%rowtype; item jsonb; artifact jsonb; latest_issue timestamptz; prior_state text;
begin
  if p_outcome not in ('PROCESSING','ISSUED') or pg_catalog.jsonb_typeof(p_tickets)<>'array' or p_response_digest !~ '^[a-f0-9]{64}$' or pg_catalog.jsonb_typeof(p_safe_metadata)<>'object' or pg_catalog.pg_column_size(p_safe_metadata)>4096 then raise exception 'invalid normalized ticketing result' using errcode='22023'; end if;
  select row.* into strict booking from public.bookings as row where row.id=p_booking_id and row.user_id=p_owner_id for update;
  select row.* into strict supplier from app_private.flight_supplier_booking_executions as row where row.booking_id=booking.id and row.owner_id=p_owner_id for update;
  select row.* into strict execution from app_private.flight_supplier_ticketing_executions as row where row.booking_id=booking.id and row.supplier_execution_id=supplier.id and row.owner_id=p_owner_id and row.idempotency_key=p_idempotency_key and row.request_digest=p_request_digest for update;
  if execution.execution_state='ISSUED' then if execution.response_digest is distinct from p_response_digest then raise exception 'ticketing replay conflict' using errcode='23505'; end if; return query select * from app_private.project_flight_supplier_ticketing_v1(execution.id,false,true); return; end if;
  if execution.execution_state not in ('REQUEST_SENT','PROCESSING','UNKNOWN') or booking.status<>'confirmed' or supplier.execution_state<>'ACCEPTED' then raise exception 'ticketing result is not applicable' using errcode='22023'; end if;
  if p_outcome='PROCESSING' and pg_catalog.jsonb_array_length(p_tickets)<>0 then raise exception 'processing cannot contain ticket evidence' using errcode='22023'; end if;
  if p_outcome='ISSUED' then
    select row.* into strict intent from app_private.flight_booking_intents as row where row.id=supplier.booking_intent_id and row.owner_id=p_owner_id;
    if pg_catalog.jsonb_array_length(p_tickets)=0 or pg_catalog.jsonb_array_length(p_tickets)<>pg_catalog.jsonb_array_length(intent.traveler_snapshot) then raise exception 'complete traveler ticket evidence is required' using errcode='22023'; end if;
    for item in select value from pg_catalog.jsonb_array_elements(p_tickets)
    loop
      if pg_catalog.jsonb_typeof(item)<>'object' or (select count(*) from pg_catalog.jsonb_object_keys(item))<>5 then raise exception 'ticket record shape is invalid' using errcode='22023'; end if;
      artifact:=item->'artifact';
      if item->>'travelerKey' !~ '^[A-Za-z0-9_-]{1,40}$' or item->>'ticketNumber' !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$' or not exists(select 1 from pg_catalog.jsonb_array_elements(intent.traveler_snapshot) as traveler(value) where traveler.value->>'travelerKey'=item->>'travelerKey') or pg_catalog.jsonb_typeof(artifact)<>'object' or (select count(*) from pg_catalog.jsonb_object_keys(artifact))<>4 then raise exception 'ticket identity or artifact is invalid' using errcode='22023'; end if;
      if artifact->>'availability' not in ('NONE','METADATA_ONLY','AVAILABLE') or ((artifact->>'availability'='AVAILABLE') and ((artifact->>'artifactRef') is null or artifact->>'mediaType' !~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$' or artifact->>'digest' !~ '^[a-f0-9]{64}$')) or ((artifact->>'availability'<>'AVAILABLE') and (artifact->>'artifactRef' is not null or artifact->>'mediaType' is not null or artifact->>'digest' is not null)) then raise exception 'ticket artifact evidence is invalid' using errcode='22023'; end if;
      insert into app_private.flight_ticket_records(ticketing_execution_id,booking_id,owner_id,provider,traveler_key,ticket_number,supplier_ticket_ref,issued_at,artifact_availability,artifact_ref,artifact_media_type,artifact_digest)
      values(execution.id,booking.id,p_owner_id,execution.provider,item->>'travelerKey',item->>'ticketNumber',item->>'supplierTicketRef',(item->>'issuedAt')::timestamptz,artifact->>'availability',artifact->>'artifactRef',artifact->>'mediaType',artifact->>'digest');
    end loop;
    select max(ticket.issued_at) into strict latest_issue from app_private.flight_ticket_records as ticket where ticket.ticketing_execution_id=execution.id;
  end if;
  prior_state:=execution.execution_state;
  update app_private.flight_supplier_ticketing_executions set execution_state=p_outcome,response_digest=p_response_digest,safe_metadata=p_safe_metadata,reconciliation_required=false,response_received_at=pg_catalog.now(),issued_at=case when p_outcome='ISSUED' then latest_issue else issued_at end,reconciled_at=case when prior_state='UNKNOWN' then pg_catalog.now() else reconciled_at end,updated_at=pg_catalog.now() where id=execution.id returning * into execution;
  update app_private.supplier_operations set status=case when p_outcome='ISSUED' then 'succeeded' else 'pending' end,result_metadata=p_safe_metadata,updated_at=pg_catalog.now() where id=execution.operation_id;
  if p_outcome='ISSUED' then
    update public.bookings set status='ticketed',supplier_status='ticketed',supplier_metadata=p_safe_metadata,updated_at=pg_catalog.now() where id=booking.id and status='confirmed';
    insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,idempotency_key,before_state,after_state,event_digest,metadata) values('supplier',booking.id,'supplier_tickets_issued','supplier',p_idempotency_key,'confirmed','ticketed',p_response_digest,p_safe_metadata);
  end if;
  return query select * from app_private.project_flight_supplier_ticketing_v1(execution.id,false,false);
end
$function$;

create or replace function public.record_flight_supplier_ticketing_failure_v1(p_owner_id uuid,p_booking_id uuid,p_idempotency_key text,p_request_digest text,p_failure_code text,p_unknown boolean)
returns table(
  execution_id uuid,operation_id uuid,booking_id uuid,booking_ref text,booking_status public.booking_status,
  supplier_execution_id uuid,owner_id uuid,provider text,supplier_booking_ref text,traveler_keys jsonb,
  idempotency_key text,request_digest text,ticketing_operation text,execution_state text,ticket_count bigint,
  can_download_ticket boolean,response_digest text,safe_metadata jsonb,reconciliation_required boolean,issued_at timestamptz,
  should_send boolean,replayed boolean
)
language plpgsql security definer set search_path=''
as $function$
declare booking public.bookings%rowtype; supplier app_private.flight_supplier_booking_executions%rowtype; execution app_private.flight_supplier_ticketing_executions%rowtype; target_state text; safe_result jsonb;
begin
  if p_failure_code !~ '^[A-Z][A-Z0-9_]{2,63}$' or p_unknown is null then raise exception 'invalid ticketing failure' using errcode='22023'; end if;
  select row.* into strict booking from public.bookings as row where row.id=p_booking_id and row.user_id=p_owner_id for update;
  select row.* into strict supplier from app_private.flight_supplier_booking_executions as row where row.booking_id=booking.id and row.owner_id=p_owner_id for update;
  select row.* into strict execution from app_private.flight_supplier_ticketing_executions as row where row.booking_id=booking.id and row.supplier_execution_id=supplier.id and row.owner_id=p_owner_id and row.idempotency_key=p_idempotency_key and row.request_digest=p_request_digest for update;
  if execution.execution_state in ('ISSUED','REJECTED','FAILED','UNKNOWN') then return query select * from app_private.project_flight_supplier_ticketing_v1(execution.id,false,true); return; end if;
  if p_unknown and execution.execution_state not in ('REQUEST_SENT','PROCESSING') then raise exception 'unknown ticketing outcome requires a sent request' using errcode='22023'; end if;
  target_state:=case when p_unknown then 'UNKNOWN' when p_failure_code='SUPPLIER_TICKETING_REJECTED' then 'REJECTED' else 'FAILED' end;
  safe_result:=pg_catalog.jsonb_build_object('contractVersion','flight-supplier-ticketing/v1','failureCode',p_failure_code);
  update app_private.flight_supplier_ticketing_executions set execution_state=target_state,safe_metadata=safe_result,reconciliation_required=p_unknown,failure_code=p_failure_code,response_received_at=pg_catalog.now(),unknown_outcome_at=case when p_unknown then pg_catalog.now() else null end,updated_at=pg_catalog.now() where id=execution.id returning * into execution;
  update app_private.supplier_operations set status=case when p_unknown then 'unknown' else 'failed' end,result_metadata=safe_result,updated_at=pg_catalog.now() where id=execution.operation_id;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,actor_id,idempotency_key,before_state,after_state,reason,metadata) values('supplier',booking.id,'supplier_ticketing_exception','service',p_owner_id,p_idempotency_key,booking.status::text,target_state,p_failure_code,safe_result);
  return query select * from app_private.project_flight_supplier_ticketing_v1(execution.id,false,false);
end
$function$;

create or replace function public.get_my_flight_ticketing_v1()
returns table(booking_ref text,ticketing_state text,ticket_count bigint,artifact_available boolean,issued_at timestamptz,reconciliation_required boolean)
language sql stable security definer set search_path=''
as $function$
  select booking.booking_ref,execution.execution_state,count(ticket.id),coalesce(pg_catalog.bool_and(ticket.artifact_availability='AVAILABLE') filter(where ticket.id is not null),false),execution.issued_at,execution.reconciliation_required
    from public.bookings as booking
    join app_private.flight_supplier_ticketing_executions as execution on execution.booking_id=booking.id and execution.owner_id=booking.user_id
    left join app_private.flight_ticket_records as ticket on ticket.ticketing_execution_id=execution.id and ticket.owner_id=booking.user_id
   where (select auth.uid()) is not null and booking.user_id=(select auth.uid())
   group by booking.id,booking.booking_ref,execution.id,execution.execution_state,execution.issued_at,execution.reconciliation_required
   order by booking.created_at desc
$function$;

create or replace function public.get_my_flight_ticket_records_v1(p_booking_ref text)
returns table(traveler_key text,ticket_number text,issued_at timestamptz,artifact_availability text)
language sql stable security definer set search_path=''
as $function$
  select ticket.traveler_key,ticket.ticket_number,ticket.issued_at,ticket.artifact_availability
    from public.bookings as booking
    join app_private.flight_supplier_ticketing_executions as execution on execution.booking_id=booking.id and execution.owner_id=booking.user_id and execution.execution_state='ISSUED'
    join app_private.flight_ticket_records as ticket on ticket.ticketing_execution_id=execution.id and ticket.booking_id=booking.id and ticket.owner_id=booking.user_id
   where (select auth.uid()) is not null and booking.user_id=(select auth.uid()) and booking.booking_ref=p_booking_ref and booking.status='ticketed'
   order by ticket.created_at,ticket.id
$function$;

revoke all on function public.prepare_flight_supplier_ticketing_v1(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.mark_flight_supplier_ticketing_request_sent_v1(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.complete_flight_supplier_ticketing_v1(uuid,uuid,text,text,text,jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function public.record_flight_supplier_ticketing_failure_v1(uuid,uuid,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.get_my_flight_ticketing_v1() from public,anon,service_role;
revoke all on function public.get_my_flight_ticket_records_v1(text) from public,anon,service_role;
grant execute on function public.prepare_flight_supplier_ticketing_v1(uuid,uuid,text,text) to service_role;
grant execute on function public.mark_flight_supplier_ticketing_request_sent_v1(uuid,uuid,text,text,text) to service_role;
grant execute on function public.complete_flight_supplier_ticketing_v1(uuid,uuid,text,text,text,jsonb,text,jsonb) to service_role;
grant execute on function public.record_flight_supplier_ticketing_failure_v1(uuid,uuid,text,text,text,boolean) to service_role;
grant execute on function public.get_my_flight_ticketing_v1() to authenticated;
grant execute on function public.get_my_flight_ticket_records_v1(text) to authenticated;

do $migration$
declare table_owner oid; relation_owner oid; function_owner oid; item record; function_oid regprocedure;
begin
  select row.relowner into strict table_owner from pg_catalog.pg_class as row where row.oid='app_private.flight_supplier_ticketing_executions'::regclass;
  for item in select * from (values
    ('app_private.flight_booking_intents'::regclass),('app_private.flight_payment_initiations'::regclass),('app_private.flight_supplier_booking_executions'::regclass),('app_private.flight_supplier_ticketing_executions'::regclass),('app_private.flight_ticket_records'::regclass),('app_private.supplier_operations'::regclass)
  ) as relations(oid)
  loop select row.relowner into strict relation_owner from pg_catalog.pg_class as row where row.oid=item.oid; if relation_owner is distinct from table_owner then raise exception 'B11-B14 private tables must share one owner'; end if; end loop;
  for item in select * from (values
    ('public.prepare_flight_supplier_ticketing_v1(uuid,uuid,text,text)'),('public.mark_flight_supplier_ticketing_request_sent_v1(uuid,uuid,text,text,text)'),('public.complete_flight_supplier_ticketing_v1(uuid,uuid,text,text,text,jsonb,text,jsonb)'),('public.record_flight_supplier_ticketing_failure_v1(uuid,uuid,text,text,text,boolean)'),('public.get_my_flight_ticketing_v1()'),('public.get_my_flight_ticket_records_v1(text)')
  ) as functions(signature)
  loop function_oid:=pg_catalog.to_regprocedure(item.signature); select row.proowner into strict function_owner from pg_catalog.pg_proc as row where row.oid=function_oid; if function_owner is distinct from table_owner then raise exception 'B14 RPC % and private tables must share one owner',item.signature; end if; end loop;
end
$migration$;
