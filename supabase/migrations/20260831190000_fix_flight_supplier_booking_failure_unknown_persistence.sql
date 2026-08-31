-- HAJIZ RT-03: qualify the B13 UNKNOWN supplier-reference self-reference.
-- B13 and RT-01 are already applied on Staging. This additive migration
-- preserves the function signature, authority, locks, idempotency, failure
-- taxonomy, and reconciliation behavior.

do $migration$
declare
  function_oid regprocedure := pg_catalog.to_regprocedure(
    'public.record_flight_supplier_booking_failure_v1(uuid,uuid,text,text,text,boolean,text)'
  );
  target_table regclass := pg_catalog.to_regclass(
    'app_private.flight_supplier_booking_executions'
  );
  function_owner oid;
  table_owner oid;
begin
  if function_oid is null or target_table is null then
    raise exception 'RT-03 requires the canonical B13 failure function and execution table';
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
    raise exception 'RT-03 refuses non-canonical B13 function ownership';
  end if;
end
$migration$;

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
  update app_private.flight_supplier_booking_executions as target set execution_state=target_state,supplier_booking_ref=coalesce(p_supplier_booking_ref,target.supplier_booking_ref),safe_metadata=safe_result,reconciliation_required=p_unknown,failure_code=p_failure_code,response_received_at=pg_catalog.now(),unknown_outcome_at=case when p_unknown then pg_catalog.now() else null end,updated_at=pg_catalog.now() where id=execution.id returning * into execution;
  update app_private.supplier_operations set provider_operation_ref=coalesce(p_supplier_booking_ref,provider_operation_ref),status=case when p_unknown then 'unknown' else 'failed' end,result_metadata=safe_result,updated_at=pg_catalog.now() where id=execution.operation_id;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,actor_id,idempotency_key,before_state,after_state,reason,metadata) values('supplier',p_booking_id,'supplier_booking_exception','service',p_owner_id,p_idempotency_key,null,target_state,p_failure_code,safe_result);
  return query select * from app_private.project_flight_supplier_booking_execution_v1(execution.id,false,false);
end
$function$;

revoke all on function public.record_flight_supplier_booking_failure_v1(
  uuid,uuid,text,text,text,boolean,text
) from public, anon, authenticated;
grant execute on function public.record_flight_supplier_booking_failure_v1(
  uuid,uuid,text,text,text,boolean,text
) to service_role;

do $migration$
declare
  function_oid regprocedure := pg_catalog.to_regprocedure(
    'public.record_flight_supplier_booking_failure_v1(uuid,uuid,text,text,text,boolean,text)'
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
     or position('target.supplier_booking_ref' in function_definition) = 0
     or pg_catalog.has_function_privilege('public', function_oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE') then
    raise exception 'RT-03 B13 function postcondition failed';
  end if;
end
$migration$;
