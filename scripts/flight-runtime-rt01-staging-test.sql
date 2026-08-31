-- HAJIZ RT-01 real PostgreSQL regression. The transaction always rolls back.
begin;

insert into auth.users(id,email,created_at,updated_at)
values('71000000-0000-4000-8000-000000000001','hajiz-rt01@example.invalid',now(),now());

insert into public.offers(
  id,supplier_offer_ref,selling_amount,net_cost,currency,enabled,expires_at,
  supplier_metadata,internal_offer_key,supplier_provider,contract_version,
  supplier_amount,supplier_currency,supplier_reference_payload
) values(
  '72000000-0000-4000-8000-000000000001','rt01-accepted-offer',2100,1900,
  'SDG',true,now()+interval '2 hours','{}','hfo_rt01_accepted','mock',
  'flight-offer/v1',1900,'SDG','{}'
);

select * from public.create_flight_booking_intent_v1(
  '71000000-0000-4000-8000-000000000001','hbi_req_rt01accepted0001',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'hfo_rt01_accepted','mock','rt01-accepted-offer','{}','{}',
  pg_catalog.jsonb_build_object('amount','2100','currency','SDG','validUntil',(now()+interval '2 hours')::text),
  '{}','[{"travelerKey":"adt-1"}]','{}',now()+interval '2 hours'
);

select * from public.prepare_flight_payment_initiation_v1(
  '71000000-0000-4000-8000-000000000001',
  (select booking_intent_id from app_private.flight_booking_intents where idempotency_key='hbi_req_rt01accepted0001'),
  'card','hpi_req_rt01accepted0001',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
);

select * from public.materialize_flight_payment_initiation_v1(
  '71000000-0000-4000-8000-000000000001',
  (select booking_intent_id from app_private.flight_booking_intents where idempotency_key='hbi_req_rt01accepted0001'),
  'hpi_req_rt01accepted0001',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  'mock_psp','rt01-payment','rt01-session',null,false,now()+interval '30 minutes',
  null,null,'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
);

select public.apply_payment_event(
  payment.id,'confirmed','mock_psp','rt01-provider-event','approved',
  payment.amount,payment.currency,true,
  'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  now(),null
)
from public.payments as payment
join app_private.flight_payment_initiations as initiation on initiation.payment_id=payment.id
where initiation.idempotency_key='hpi_req_rt01accepted0001';

select * from public.prepare_flight_supplier_booking_execution_v1(
  '71000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt01accepted0001'),
  'hsb_req_rt01accepted0001',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);

select * from public.mark_flight_supplier_booking_request_sent_v1(
  '71000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt01accepted0001'),
  'hsb_req_rt01accepted0001',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);

select * from public.complete_flight_supplier_booking_execution_v1(
  '71000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt01accepted0001'),
  'hsb_req_rt01accepted0001',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  'ACCEPTED','MOCK-RT01-ACCEPTED','MOCK-PNR-RT01',
  '1111111111111111111111111111111111111111111111111111111111111111',
  '{"contractVersion":"flight-supplier-booking-execution/v1","runtimeGate":"RT-01"}'
);

do $test$
declare
  observed record;
begin
  select booking.status as booking_status,
         booking.supplier_reference,
         booking.net_cost,
         booking.sold_price,
         booking.currency,
         booking.fx_rate_sdg,
         booking.agent_profit,
         booking.commission,
         payment.status as payment_status,
         execution.execution_state,
         execution.supplier_booking_ref,
         execution.supplier_accepted_at
    into strict observed
    from app_private.flight_payment_initiations as initiation
    join public.bookings as booking on booking.id=initiation.booking_id
    join public.payments as payment on payment.id=initiation.payment_id
    join app_private.flight_supplier_booking_executions as execution on execution.booking_id=booking.id
   where initiation.idempotency_key='hpi_req_rt01accepted0001';

  if observed.execution_state <> 'ACCEPTED'
     or observed.booking_status <> 'confirmed'
     or observed.supplier_reference <> 'MOCK-RT01-ACCEPTED'
     or observed.supplier_booking_ref <> 'MOCK-RT01-ACCEPTED'
     or observed.supplier_accepted_at is null
     or observed.payment_status <> 'confirmed'
     or observed.net_cost <> 1900
     or observed.sold_price <> 2100
     or observed.currency <> 'SDG'
     or observed.fx_rate_sdg is not null
     or observed.agent_profit <> 200
     or observed.commission <> 0 then
    raise exception 'RT-01 accepted persistence regression failed';
  end if;
end
$test$;

select execution.execution_state,
       booking.status as booking_status,
       booking.supplier_reference,
       execution.supplier_accepted_at is not null as supplier_accepted_at_persisted,
       payment.status as payment_status,
       booking.net_cost,
       booking.sold_price,
       booking.currency,
       booking.fx_rate_sdg,
       booking.agent_profit,
       booking.commission
from app_private.flight_payment_initiations as initiation
join public.bookings as booking on booking.id=initiation.booking_id
join public.payments as payment on payment.id=initiation.payment_id
join app_private.flight_supplier_booking_executions as execution on execution.booking_id=booking.id
where initiation.idempotency_key='hpi_req_rt01accepted0001';

rollback;
