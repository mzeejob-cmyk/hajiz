-- HAJIZ RT-01: qualify the B13 supplier acceptance timestamp self-reference.
-- B13 is already applied on Staging, so this additive migration preserves its
-- signature, authority, locking, idempotency, and UNKNOWN reconciliation model.

do $migration$
declare
  function_oid regprocedure := pg_catalog.to_regprocedure(
    'public.complete_flight_supplier_booking_execution_v1(uuid,uuid,text,text,text,text,text,text,jsonb)'
  );
  target_table regclass := pg_catalog.to_regclass(
    'app_private.flight_supplier_booking_executions'
  );
  function_owner oid;
  table_owner oid;
begin
  if function_oid is null or target_table is null then
    raise exception 'RT-01 requires the canonical B13 function and execution table';
  end if;

  select function_row.proowner
    into strict function_owner
    from pg_catalog.pg_proc as function_row
   where function_row.oid = function_oid;

  select table_row.relowner
    into strict table_owner
    from pg_catalog.pg_class as table_row
   where table_row.oid = target_table;

  if function_owner is distinct from table_owner then
    raise exception 'RT-01 refuses non-canonical B13 function ownership';
  end if;
end
$migration$;

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
  update app_private.flight_supplier_booking_executions as target set execution_state=p_outcome,supplier_booking_ref=p_supplier_booking_ref,supplier_locator=p_supplier_locator,response_digest=p_response_digest,safe_metadata=p_safe_metadata,reconciliation_required=false,response_received_at=pg_catalog.now(),supplier_accepted_at=case when p_outcome='ACCEPTED' then pg_catalog.now() else target.supplier_accepted_at end,reconciled_at=case when execution.execution_state='UNKNOWN' then pg_catalog.now() else reconciled_at end,updated_at=pg_catalog.now() where id=execution.id returning * into execution;
  update app_private.supplier_operations set provider_operation_ref=p_supplier_booking_ref,status=case when p_outcome='ACCEPTED' then 'succeeded' else 'pending' end,result_metadata=p_safe_metadata,updated_at=pg_catalog.now() where id=execution.operation_id;
  if p_outcome='ACCEPTED' then
    update public.bookings set status='confirmed',supplier_reference=p_supplier_booking_ref,supplier_status='confirmed',supplier_metadata=p_safe_metadata,updated_at=pg_catalog.now() where id=booking.id and status='processing';
    insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,actor_id,idempotency_key,before_state,after_state,event_digest,metadata) values('supplier',booking.id,'supplier_booking_accepted','supplier',null,p_idempotency_key,'processing','confirmed',p_response_digest,p_safe_metadata);
  end if;
  return query select * from app_private.project_flight_supplier_booking_execution_v1(execution.id,false,false);
end
$function$;

revoke all on function public.complete_flight_supplier_booking_execution_v1(
  uuid,uuid,text,text,text,text,text,text,jsonb
) from public, anon, authenticated;
grant execute on function public.complete_flight_supplier_booking_execution_v1(
  uuid,uuid,text,text,text,text,text,text,jsonb
) to service_role;

do $migration$
declare
  function_oid regprocedure := pg_catalog.to_regprocedure(
    'public.complete_flight_supplier_booking_execution_v1(uuid,uuid,text,text,text,text,text,text,jsonb)'
  );
  target_table regclass := pg_catalog.to_regclass(
    'app_private.flight_supplier_booking_executions'
  );
  function_owner oid;
  table_owner oid;
  function_is_definer boolean;
  function_settings text[];
  function_definition text;
begin
  select function_row.proowner,
         function_row.prosecdef,
         function_row.proconfig,
         pg_catalog.pg_get_functiondef(function_row.oid)
    into strict function_owner,
                function_is_definer,
                function_settings,
                function_definition
    from pg_catalog.pg_proc as function_row
   where function_row.oid = function_oid;

  select table_row.relowner
    into strict table_owner
    from pg_catalog.pg_class as table_row
   where table_row.oid = target_table;

  if function_owner is distinct from table_owner
     or not function_is_definer
     or not ('search_path=""' = any(coalesce(function_settings, array[]::text[])))
    or position('target.supplier_accepted_at' in function_definition) = 0
     or pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE') then
    raise exception 'RT-01 B13 function postcondition failed';
  end if;
end
$migration$;
