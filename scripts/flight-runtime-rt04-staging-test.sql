-- HAJIZ RT-04 real PostgreSQL regression. The transaction always rolls back.
begin;

insert into auth.users(id,email,created_at,updated_at)
values('77000000-0000-4000-8000-000000000001','hajiz-rt04@example.invalid',now(),now());

insert into public.offers(
  id,supplier_offer_ref,selling_amount,net_cost,currency,enabled,expires_at,
  supplier_metadata,internal_offer_key,supplier_provider,contract_version,
  supplier_amount,supplier_currency,supplier_reference_payload
) values(
  '78000000-0000-4000-8000-000000000001','rt04-issued-offer',2600,2300,
  'SDG',true,now()+interval '2 hours','{}','hfo_rt04_issued','mock',
  'flight-offer/v1',2300,'SDG','{}'
);

select * from public.create_flight_booking_intent_v1(
  '77000000-0000-4000-8000-000000000001','hbi_req_rt04issued000001',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'hfo_rt04_issued','mock','rt04-issued-offer','{}','{}',
  pg_catalog.jsonb_build_object('amount','2600','currency','SDG','validUntil',(now()+interval '2 hours')::text),
  '{}','[{"travelerKey":"adt-1"}]','{}',now()+interval '2 hours'
);

select * from public.prepare_flight_payment_initiation_v1(
  '77000000-0000-4000-8000-000000000001',
  (select booking_intent_id from app_private.flight_booking_intents where idempotency_key='hbi_req_rt04issued000001'),
  'card','hpi_req_rt04issued000001',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
);

select * from public.materialize_flight_payment_initiation_v1(
  '77000000-0000-4000-8000-000000000001',
  (select booking_intent_id from app_private.flight_booking_intents where idempotency_key='hbi_req_rt04issued000001'),
  'hpi_req_rt04issued000001',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  'mock_psp','rt04-payment','rt04-session',null,false,now()+interval '30 minutes',
  null,null,'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
);

select public.apply_payment_event(
  payment.id,'confirmed','mock_psp','rt04-provider-event','approved',
  payment.amount,payment.currency,true,
  'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  now(),null
)
from public.payments as payment
join app_private.flight_payment_initiations as initiation on initiation.payment_id=payment.id
where initiation.idempotency_key='hpi_req_rt04issued000001';

select * from public.prepare_flight_supplier_booking_execution_v1(
  '77000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt04issued000001'),
  'hsb_req_rt04issued000001',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);

select * from public.mark_flight_supplier_booking_request_sent_v1(
  '77000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt04issued000001'),
  'hsb_req_rt04issued000001',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);

select * from public.complete_flight_supplier_booking_execution_v1(
  '77000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt04issued000001'),
  'hsb_req_rt04issued000001',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  'ACCEPTED','MOCK-RT04-BOOKING','MOCK-PNR-RT04',
  '1111111111111111111111111111111111111111111111111111111111111111',
  '{"contractVersion":"flight-supplier-booking-execution/v1","runtimeGate":"RT-04"}'
);

select * from public.prepare_flight_supplier_ticketing_v1(
  '77000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt04issued000001'),
  'hst_req_rt04issued000001',
  '2222222222222222222222222222222222222222222222222222222222222222'
);

select * from public.mark_flight_supplier_ticketing_request_sent_v1(
  '77000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt04issued000001'),
  'hst_req_rt04issued000001',
  '2222222222222222222222222222222222222222222222222222222222222222',
  'confirm_booking'
);

-- PROCESSING exercises the formerly ambiguous ELSE branch without evidence.
select * from public.complete_flight_supplier_ticketing_v1(
  '77000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt04issued000001'),
  'hst_req_rt04issued000001',
  '2222222222222222222222222222222222222222222222222222222222222222',
  'PROCESSING','[]',
  '3333333333333333333333333333333333333333333333333333333333333333',
  '{"contractVersion":"flight-supplier-ticketing/v1","runtimeGate":"RT-04-processing"}'
);

create temporary table rt04_mark_replay on commit drop as
select * from public.mark_flight_supplier_ticketing_request_sent_v1(
  '77000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt04issued000001'),
  'hst_req_rt04issued000001',
  '2222222222222222222222222222222222222222222222222222222222222222',
  'confirm_booking'
);

do $processing$
declare observed record;
begin
  select execution.execution_state,
         execution.issued_at,
         booking.status as booking_status,
         payment.status as payment_status,
         (select count(*) from app_private.flight_ticket_records as ticket where ticket.ticketing_execution_id=execution.id) as ticket_count
    into strict observed
    from app_private.flight_payment_initiations as initiation
    join public.bookings as booking on booking.id=initiation.booking_id
    join public.payments as payment on payment.id=initiation.payment_id
    join app_private.flight_supplier_ticketing_executions as execution on execution.booking_id=booking.id
   where initiation.idempotency_key='hpi_req_rt04issued000001';

  if observed.execution_state<>'PROCESSING'
     or observed.issued_at is not null
     or observed.booking_status<>'confirmed'
     or observed.payment_status<>'confirmed'
     or observed.ticket_count<>0
     or exists(select 1 from rt04_mark_replay where should_send or not replayed or execution_state<>'PROCESSING') then
    raise exception 'RT-04 PROCESSING/no-blind-reissue regression failed';
  end if;
end
$processing$;

select * from public.complete_flight_supplier_ticketing_v1(
  '77000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt04issued000001'),
  'hst_req_rt04issued000001',
  '2222222222222222222222222222222222222222222222222222222222222222',
  'ISSUED',
  '[{"travelerKey":"adt-1","ticketNumber":"ETKT-RT04-0001","supplierTicketRef":"MOCK-RT04-TICKET-REF","issuedAt":"2026-08-31T18:30:00Z","artifact":{"availability":"NONE","artifactRef":null,"mediaType":null,"digest":null}}]',
  '4444444444444444444444444444444444444444444444444444444444444444',
  '{"contractVersion":"flight-supplier-ticketing/v1","runtimeGate":"RT-04-issued"}'
);

-- Exact replay must not duplicate per-traveler evidence.
select * from public.complete_flight_supplier_ticketing_v1(
  '77000000-0000-4000-8000-000000000001',
  (select booking_id from app_private.flight_payment_initiations where idempotency_key='hpi_req_rt04issued000001'),
  'hst_req_rt04issued000001',
  '2222222222222222222222222222222222222222222222222222222222222222',
  'ISSUED',
  '[{"travelerKey":"adt-1","ticketNumber":"ETKT-RT04-0001","supplierTicketRef":"MOCK-RT04-TICKET-REF","issuedAt":"2026-08-31T18:30:00Z","artifact":{"availability":"NONE","artifactRef":null,"mediaType":null,"digest":null}}]',
  '4444444444444444444444444444444444444444444444444444444444444444',
  '{"contractVersion":"flight-supplier-ticketing/v1","runtimeGate":"RT-04-issued"}'
);

do $test$
declare observed record;
begin
  select execution.execution_state,
         execution.issued_at,
         execution.reconciliation_required,
         booking.status as booking_status,
         payment.status as payment_status,
         booking.net_cost,
         booking.sold_price,
         booking.currency,
         booking.fx_rate_sdg,
         booking.agent_profit,
         booking.commission,
         operation.status as operation_status,
         count(ticket.id) as ticket_count,
         min(ticket.traveler_key) as traveler_key,
         min(ticket.ticket_number) as ticket_number,
         min(ticket.supplier_ticket_ref) as supplier_ticket_ref,
         min(ticket.issued_at) as ticket_issued_at,
         bool_or(ticket.artifact_availability='AVAILABLE') as artifact_available
    into strict observed
    from app_private.flight_payment_initiations as initiation
    join public.bookings as booking on booking.id=initiation.booking_id
    join public.payments as payment on payment.id=initiation.payment_id
    join app_private.flight_supplier_ticketing_executions as execution on execution.booking_id=booking.id
    join app_private.supplier_operations as operation on operation.id=execution.operation_id
    left join app_private.flight_ticket_records as ticket on ticket.ticketing_execution_id=execution.id
   where initiation.idempotency_key='hpi_req_rt04issued000001'
   group by execution.execution_state,execution.issued_at,execution.reconciliation_required,
            booking.status,payment.status,booking.net_cost,booking.sold_price,
            booking.currency,booking.fx_rate_sdg,booking.agent_profit,booking.commission,
            operation.status;

  if observed.execution_state<>'ISSUED'
     or observed.issued_at is distinct from '2026-08-31T18:30:00Z'::timestamptz
     or observed.reconciliation_required
     or observed.booking_status<>'ticketed'
     or observed.payment_status<>'confirmed'
     or observed.net_cost<>2300
     or observed.sold_price<>2600
     or observed.currency<>'SDG'
     or observed.fx_rate_sdg is not null
     or observed.agent_profit<>300
     or observed.commission<>0
     or observed.operation_status<>'succeeded'
     or observed.ticket_count<>1
     or observed.traveler_key<>'adt-1'
     or observed.ticket_number<>'ETKT-RT04-0001'
     or observed.supplier_ticket_ref<>'MOCK-RT04-TICKET-REF'
     or observed.ticket_issued_at is distinct from observed.issued_at
     or observed.artifact_available then
    raise exception 'RT-04 trusted ISSUED persistence regression failed';
  end if;
end
$test$;

select execution.execution_state,
       execution.issued_at,
       booking.status as booking_status,
       payment.status as payment_status,
       count(ticket.id) as ticket_records,
       bool_or(ticket.artifact_availability='AVAILABLE') as artifact_available,
       booking.net_cost,
       booking.sold_price,
       booking.currency,
       booking.fx_rate_sdg,
       booking.agent_profit,
       booking.commission
from app_private.flight_payment_initiations as initiation
join public.bookings as booking on booking.id=initiation.booking_id
join public.payments as payment on payment.id=initiation.payment_id
join app_private.flight_supplier_ticketing_executions as execution on execution.booking_id=booking.id
left join app_private.flight_ticket_records as ticket on ticket.ticketing_execution_id=execution.id
where initiation.idempotency_key='hpi_req_rt04issued000001'
group by execution.execution_state,execution.issued_at,booking.status,payment.status,
         booking.net_cost,booking.sold_price,booking.currency,booking.fx_rate_sdg,
         booking.agent_profit,booking.commission;

rollback;
