-- HAJIZ RT-04: qualify the B14 ticketing issued timestamp self-reference.
-- B14 is already applied on Staging. This additive migration preserves the
-- function signature, authority, locks, idempotency, UNKNOWN/reconciliation,
-- traveler coverage, evidence validation, and lifecycle behavior.

do $migration$
declare
  function_oid regprocedure := pg_catalog.to_regprocedure(
    'public.complete_flight_supplier_ticketing_v1(uuid,uuid,text,text,text,jsonb,text,jsonb)'
  );
  target_table regclass := pg_catalog.to_regclass(
    'app_private.flight_supplier_ticketing_executions'
  );
  function_owner oid;
  table_owner oid;
begin
  if function_oid is null or target_table is null then
    raise exception 'RT-04 requires the canonical B14 completion function and execution table';
  end if;

  select function_row.proowner into strict function_owner
    from pg_catalog.pg_proc as function_row
   where function_row.oid=function_oid;

  select table_row.relowner into strict table_owner
    from pg_catalog.pg_class as table_row
   where table_row.oid=target_table;

  if function_owner is distinct from table_owner then
    raise exception 'RT-04 refuses non-canonical B14 function ownership';
  end if;
end
$migration$;

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
  update app_private.flight_supplier_ticketing_executions as target set execution_state=p_outcome,response_digest=p_response_digest,safe_metadata=p_safe_metadata,reconciliation_required=false,response_received_at=pg_catalog.now(),issued_at=case when p_outcome='ISSUED' then latest_issue else target.issued_at end,reconciled_at=case when prior_state='UNKNOWN' then pg_catalog.now() else reconciled_at end,updated_at=pg_catalog.now() where id=execution.id returning * into execution;
  update app_private.supplier_operations set status=case when p_outcome='ISSUED' then 'succeeded' else 'pending' end,result_metadata=p_safe_metadata,updated_at=pg_catalog.now() where id=execution.operation_id;
  if p_outcome='ISSUED' then
    update public.bookings set status='ticketed',supplier_status='ticketed',supplier_metadata=p_safe_metadata,updated_at=pg_catalog.now() where id=booking.id and status='confirmed';
    insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,idempotency_key,before_state,after_state,event_digest,metadata) values('supplier',booking.id,'supplier_tickets_issued','supplier',p_idempotency_key,'confirmed','ticketed',p_response_digest,p_safe_metadata);
  end if;
  return query select * from app_private.project_flight_supplier_ticketing_v1(execution.id,false,false);
end
$function$;

revoke all on function public.complete_flight_supplier_ticketing_v1(
  uuid,uuid,text,text,text,jsonb,text,jsonb
) from public,anon,authenticated;
grant execute on function public.complete_flight_supplier_ticketing_v1(
  uuid,uuid,text,text,text,jsonb,text,jsonb
) to service_role;

do $migration$
declare
  function_oid regprocedure := pg_catalog.to_regprocedure(
    'public.complete_flight_supplier_ticketing_v1(uuid,uuid,text,text,text,jsonb,text,jsonb)'
  );
  target_table regclass := pg_catalog.to_regclass(
    'app_private.flight_supplier_ticketing_executions'
  );
  function_owner oid;
  table_owner oid;
  function_is_definer boolean;
  function_settings text[];
  function_definition text;
begin
  select function_row.proowner,function_row.prosecdef,function_row.proconfig,
         pg_catalog.pg_get_functiondef(function_row.oid)
    into strict function_owner,function_is_definer,function_settings,function_definition
    from pg_catalog.pg_proc as function_row
   where function_row.oid=function_oid;

  select table_row.relowner into strict table_owner
    from pg_catalog.pg_class as table_row
   where table_row.oid=target_table;

  if function_owner is distinct from table_owner
     or not function_is_definer
     or not ('search_path=""' = any(coalesce(function_settings,array[]::text[])))
     or position('target.issued_at' in function_definition)=0
     or pg_catalog.has_function_privilege('public',function_oid,'EXECUTE')
     or pg_catalog.has_function_privilege('anon',function_oid,'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated',function_oid,'EXECUTE')
     or not pg_catalog.has_function_privilege('service_role',function_oid,'EXECUTE') then
    raise exception 'RT-04 B14 function postcondition failed';
  end if;
end
$migration$;
