-- HAJIZ RT-03 real PostgreSQL regression. The transaction always rolls back.
begin;

insert into auth.users(id,email,created_at,updated_at)
values('73000000-0000-4000-8000-000000000001','hajiz-rt03@example.invalid',now(),now());

insert into public.offers(
  id,supplier_offer_ref,selling_amount,net_cost,currency,enabled,expires_at,
  supplier_metadata,internal_offer_key,supplier_provider,contract_version,
  supplier_amount,supplier_currency,supplier_reference_payload
) values
(
  '74000000-0000-4000-8000-000000000001','rt03-with-ref-offer',2200,2000,
  'SDG',true,now()+interval '2 hours','{}','hfo_rt03_with_ref','mock',
  'flight-offer/v1',2000,'SDG','{}'
),
(
  '74000000-0000-4000-8000-000000000002','rt03-without-ref-offer',2400,2150,
  'SDG',true,now()+interval '2 hours','{}','hfo_rt03_without_ref','mock',
  'flight-offer/v1',2150,'SDG','{}'
);

-- Possible-send UNKNOWN with an exact trusted supplier reference.
select * from public.create_flight_booking_intent_v1(
  '73000000-0000-4000-8000-000000000001','hbi_req_rt03withrefx0001',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'hfo_rt03_with_ref','mock','rt03-with-ref-offer','{}','{}',
  pg_catalog.jsonb_build_object('amount','2200','currency','SDG','validUntil',(now()+interval '2 hours')::text),
  '{}','[{"travelerKey":"adt-1"}]','{}',now()+interval '2 hours'
);

select * from public.prepare_flight_payment_initiation_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_intent_id from app_private.flight_booking_intents where idempotency_key='hbi_req_rt03withrefx0001'),
  'card','hpi_req_rt03withrefx0001',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
);

select * from public.materialize_flight_payment_initiation_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_intent_id from app_private.flight_booking_intents where idempotency_key='hbi_req_rt03withrefx0001'),
  'hpi_req_rt03withrefx0001',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  'mock_psp','rt03-payment-with-ref','rt03-session-with-ref',null,false,now()+interval '30 minutes',
  null,null,'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
);

select public.apply_payment_event(
  payment.id,'confirmed','mock_psp','rt03-provider-event-with-ref','approved',
  payment.amount,payment.currency,true,
  'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  now(),null
)
from public.payments as payment
join app_private.flight_payment_initiations as initiation on initiation.payment_id=payment.id
where initiation.idempotency_key='hpi_req_rt03withrefx0001';

select * from public.prepare_flight_supplier_booking_execution_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt03withrefx0001'),
  'hsb_req_rt03withrefx0001',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);

select * from public.mark_flight_supplier_booking_request_sent_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt03withrefx0001'),
  'hsb_req_rt03withrefx0001',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);

select * from public.record_flight_supplier_booking_failure_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt03withrefx0001'),
  'hsb_req_rt03withrefx0001',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  'SUPPLIER_TIMEOUT',true,'MOCK-RT03-UNKNOWN-REF'
);

create temporary table rt03_with_ref_unknown on commit drop as
select execution.execution_state,
       execution.supplier_booking_ref,
       execution.reconciliation_required,
       execution.attempt_count,
       operation.status as operation_status,
       operation.provider_operation_ref,
       booking.status as booking_status,
       booking.net_cost,
       booking.sold_price,
       booking.currency,
       booking.fx_rate_sdg,
       booking.agent_profit,
       booking.commission,
       payment.status as payment_status
from app_private.flight_payment_initiations as initiation
join public.bookings as booking on booking.id=initiation.booking_id
join public.payments as payment on payment.id=initiation.payment_id
join app_private.flight_supplier_booking_executions as execution on execution.booking_id=booking.id
join app_private.supplier_operations as operation on operation.id=execution.operation_id
where initiation.idempotency_key='hpi_req_rt03withrefx0001';

create temporary table rt03_with_ref_prepare_replay on commit drop as
select * from public.prepare_flight_supplier_booking_execution_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt03withrefx0001'),
  'hsb_req_rt03withrefx0001',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);

create temporary table rt03_with_ref_mark_replay on commit drop as
select * from public.mark_flight_supplier_booking_request_sent_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt03withrefx0001'),
  'hsb_req_rt03withrefx0001',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);

-- Trusted status-only reconciliation may accept the already-known reference.
select * from public.complete_flight_supplier_booking_execution_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt03withrefx0001'),
  'hsb_req_rt03withrefx0001',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  'ACCEPTED','MOCK-RT03-UNKNOWN-REF','MOCK-PNR-RT03',
  '1111111111111111111111111111111111111111111111111111111111111111',
  '{"contractVersion":"flight-supplier-booking-execution/v1","runtimeGate":"RT-03-reconciled"}'
);

-- Possible-send UNKNOWN without a supplier reference remains fail-closed.
select * from public.create_flight_booking_intent_v1(
  '73000000-0000-4000-8000-000000000001','hbi_req_rt03withoutref0001',
  '2222222222222222222222222222222222222222222222222222222222222222',
  '3333333333333333333333333333333333333333333333333333333333333333',
  'hfo_rt03_without_ref','mock','rt03-without-ref-offer','{}','{}',
  pg_catalog.jsonb_build_object('amount','2400','currency','SDG','validUntil',(now()+interval '2 hours')::text),
  '{}','[{"travelerKey":"adt-1"}]','{}',now()+interval '2 hours'
);

select * from public.prepare_flight_payment_initiation_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_intent_id from app_private.flight_booking_intents where idempotency_key='hbi_req_rt03withoutref0001'),
  'card','hpi_req_rt03withoutref0001',
  '4444444444444444444444444444444444444444444444444444444444444444'
);

select * from public.materialize_flight_payment_initiation_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_intent_id from app_private.flight_booking_intents where idempotency_key='hbi_req_rt03withoutref0001'),
  'hpi_req_rt03withoutref0001',
  '4444444444444444444444444444444444444444444444444444444444444444',
  'mock_psp','rt03-payment-without-ref','rt03-session-without-ref',null,false,now()+interval '30 minutes',
  null,null,'5555555555555555555555555555555555555555555555555555555555555555'
);

select public.apply_payment_event(
  payment.id,'confirmed','mock_psp','rt03-provider-event-without-ref','approved',
  payment.amount,payment.currency,true,
  '6666666666666666666666666666666666666666666666666666666666666666',
  now(),null
)
from public.payments as payment
join app_private.flight_payment_initiations as initiation on initiation.payment_id=payment.id
where initiation.idempotency_key='hpi_req_rt03withoutref0001';

select * from public.prepare_flight_supplier_booking_execution_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt03withoutref0001'),
  'hsb_req_rt03withoutref0001',
  '7777777777777777777777777777777777777777777777777777777777777777'
);

select * from public.mark_flight_supplier_booking_request_sent_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt03withoutref0001'),
  'hsb_req_rt03withoutref0001',
  '7777777777777777777777777777777777777777777777777777777777777777'
);

select * from public.record_flight_supplier_booking_failure_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt03withoutref0001'),
  'hsb_req_rt03withoutref0001',
  '7777777777777777777777777777777777777777777777777777777777777777',
  'SUPPLIER_TIMEOUT',true,null
);

create temporary table rt03_without_ref_unknown on commit drop as
select execution.execution_state,
       execution.supplier_booking_ref,
       execution.reconciliation_required,
       execution.attempt_count,
       booking.status as booking_status,
       booking.net_cost,
       booking.sold_price,
       booking.currency,
       booking.fx_rate_sdg,
       booking.agent_profit,
       booking.commission,
       payment.status as payment_status
from app_private.flight_payment_initiations as initiation
join public.bookings as booking on booking.id=initiation.booking_id
join public.payments as payment on payment.id=initiation.payment_id
join app_private.flight_supplier_booking_executions as execution on execution.booking_id=booking.id
where initiation.idempotency_key='hpi_req_rt03withoutref0001';

create temporary table rt03_without_ref_prepare_replay on commit drop as
select * from public.prepare_flight_supplier_booking_execution_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt03withoutref0001'),
  'hsb_req_rt03withoutref0001',
  '7777777777777777777777777777777777777777777777777777777777777777'
);

create temporary table rt03_without_ref_mark_replay on commit drop as
select * from public.mark_flight_supplier_booking_request_sent_v1(
  '73000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt03withoutref0001'),
  'hsb_req_rt03withoutref0001',
  '7777777777777777777777777777777777777777777777777777777777777777'
);

create temporary table rt03_without_ref_reconciliation_error(
  sqlstate text,
  message text
) on commit drop;

do $blocked$
begin
  perform * from public.complete_flight_supplier_booking_execution_v1(
    '73000000-0000-4000-8000-000000000001',
    (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt03withoutref0001'),
    'hsb_req_rt03withoutref0001',
    '7777777777777777777777777777777777777777777777777777777777777777',
    'ACCEPTED','INVENTED-REF-MUST-NOT-PERSIST','INVENTED-PNR',
    '8888888888888888888888888888888888888888888888888888888888888888','{}'
  );
exception when others then
  insert into rt03_without_ref_reconciliation_error values(sqlstate,sqlerrm);
end
$blocked$;

do $test$
declare
  with_ref record;
  without_ref record;
  reconciled record;
  blocked record;
begin
  select * into strict with_ref from rt03_with_ref_unknown;
  select * into strict without_ref from rt03_without_ref_unknown;
  select * into strict blocked from rt03_without_ref_reconciliation_error;

  select execution.execution_state,
         execution.reconciliation_required,
         execution.supplier_booking_ref,
         execution.reconciled_at,
         booking.status as booking_status,
         payment.status as payment_status,
         booking.net_cost,
         booking.sold_price,
         booking.currency,
         booking.fx_rate_sdg,
         booking.agent_profit,
         booking.commission
    into strict reconciled
    from app_private.flight_payment_initiations as initiation
    join public.bookings as booking on booking.id=initiation.booking_id
    join public.payments as payment on payment.id=initiation.payment_id
    join app_private.flight_supplier_booking_executions as execution on execution.booking_id=booking.id
   where initiation.idempotency_key='hpi_req_rt03withrefx0001';

  if with_ref.execution_state <> 'UNKNOWN'
     or not with_ref.reconciliation_required
     or with_ref.supplier_booking_ref <> 'MOCK-RT03-UNKNOWN-REF'
     or with_ref.provider_operation_ref <> 'MOCK-RT03-UNKNOWN-REF'
     or with_ref.operation_status <> 'unknown'
     or with_ref.attempt_count <> 1
     or with_ref.booking_status <> 'processing'
     or with_ref.payment_status <> 'confirmed'
     or with_ref.net_cost <> 2000
     or with_ref.sold_price <> 2200
     or with_ref.currency <> 'SDG'
     or with_ref.fx_rate_sdg is not null
     or with_ref.agent_profit <> 200
     or with_ref.commission <> 0 then
    raise exception 'RT-03 UNKNOWN-with-reference persistence regression failed';
  end if;

  if exists(select 1 from rt03_with_ref_prepare_replay where should_send or not replayed or execution_state <> 'UNKNOWN')
     or exists(select 1 from rt03_with_ref_mark_replay where should_send or not replayed or execution_state <> 'UNKNOWN')
     or (select count(*) from rt03_with_ref_prepare_replay) <> 1
     or (select count(*) from rt03_with_ref_mark_replay) <> 1 then
    raise exception 'RT-03 UNKNOWN-with-reference replay attempted a blind send';
  end if;

  if reconciled.execution_state <> 'ACCEPTED'
     or reconciled.reconciliation_required
     or reconciled.supplier_booking_ref <> 'MOCK-RT03-UNKNOWN-REF'
     or reconciled.reconciled_at is null
     or reconciled.booking_status <> 'confirmed'
     or reconciled.payment_status <> 'confirmed'
     or reconciled.net_cost <> 2000
     or reconciled.sold_price <> 2200
     or reconciled.currency <> 'SDG'
     or reconciled.fx_rate_sdg is not null
     or reconciled.agent_profit <> 200
     or reconciled.commission <> 0 then
    raise exception 'RT-03 trusted reference reconciliation regression failed';
  end if;

  if without_ref.execution_state <> 'UNKNOWN'
     or not without_ref.reconciliation_required
     or without_ref.supplier_booking_ref is not null
     or without_ref.attempt_count <> 1
     or without_ref.booking_status <> 'processing'
     or without_ref.payment_status <> 'confirmed'
     or without_ref.net_cost <> 2150
     or without_ref.sold_price <> 2400
     or without_ref.currency <> 'SDG'
     or without_ref.fx_rate_sdg is not null
     or without_ref.agent_profit <> 250
     or without_ref.commission <> 0
     or blocked.sqlstate <> '22023'
     or blocked.message <> 'unknown supplier outcome requires external reconciliation' then
    raise exception 'RT-03 UNKNOWN-without-reference fail-closed regression failed';
  end if;

  if exists(select 1 from rt03_without_ref_prepare_replay where should_send or not replayed or execution_state <> 'UNKNOWN')
     or exists(select 1 from rt03_without_ref_mark_replay where should_send or not replayed or execution_state <> 'UNKNOWN')
     or (select count(*) from rt03_without_ref_prepare_replay) <> 1
     or (select count(*) from rt03_without_ref_mark_replay) <> 1
     or (select count(*) from app_private.flight_supplier_booking_executions where owner_id='73000000-0000-4000-8000-000000000001') <> 2
     or (select count(*) from app_private.supplier_operations where booking_id in (
          select booking_id from app_private.flight_payment_initiations
           where idempotency_key in ('hpi_req_rt03withrefx0001','hpi_req_rt03withoutref0001')
        ) and operation='create_booking') <> 2 then
    raise exception 'RT-03 UNKNOWN-without-reference replay duplicated supplier execution';
  end if;
end
$test$;

select 'with_supplier_ref' as case_name,
       snapshot.execution_state as unknown_state,
       snapshot.supplier_booking_ref as unknown_supplier_booking_ref,
       snapshot.reconciliation_required,
       final_execution.execution_state as final_state,
       final_booking.status as final_booking_state,
       final_payment.status as payment_state,
       false as blind_retry
from rt03_with_ref_unknown as snapshot
join app_private.flight_payment_initiations as initiation on initiation.idempotency_key='hpi_req_rt03withrefx0001'
join app_private.flight_supplier_booking_executions as final_execution on final_execution.booking_id=initiation.booking_id
join public.bookings as final_booking on final_booking.id=initiation.booking_id
join public.payments as final_payment on final_payment.id=initiation.payment_id
union all
select 'without_supplier_ref',
       snapshot.execution_state,
       snapshot.supplier_booking_ref,
       snapshot.reconciliation_required,
       final_execution.execution_state,
       final_booking.status,
       final_payment.status,
       false
from rt03_without_ref_unknown as snapshot
join app_private.flight_payment_initiations as initiation on initiation.idempotency_key='hpi_req_rt03withoutref0001'
join app_private.flight_supplier_booking_executions as final_execution on final_execution.booking_id=initiation.booking_id
join public.bookings as final_booking on final_booking.id=initiation.booking_id
join public.payments as final_payment on final_payment.id=initiation.payment_id
order by case_name;

rollback;
