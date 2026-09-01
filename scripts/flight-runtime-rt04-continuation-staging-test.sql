-- HAJIZ RT-04 continuation gate. All synthetic fixtures are rolled back.
begin;

create or replace function pg_temp.rt04_confirmed_booking(
  p_owner_id uuid,
  p_offer_id uuid,
  p_tag text,
  p_travelers jsonb,
  p_stop_after_payment boolean default false
) returns uuid
language plpgsql
set search_path=''
as $helper$
declare
  v_booking_id uuid;
  v_payment_id uuid;
begin
  insert into auth.users(id,email,created_at,updated_at)
  values(p_owner_id,p_tag||'@example.invalid',pg_catalog.now(),pg_catalog.now());

  insert into public.offers(
    id,supplier_offer_ref,selling_amount,net_cost,currency,enabled,expires_at,
    supplier_metadata,internal_offer_key,supplier_provider,contract_version,
    supplier_amount,supplier_currency,supplier_reference_payload
  ) values(
    p_offer_id,p_tag||'-offer',2600,2300,'SDG',true,pg_catalog.now()+interval '2 hours',
    '{}'::jsonb,'hfo_'||p_tag,'mock','flight-offer/v1',2300,'SDG','{}'::jsonb
  );

  perform * from public.create_flight_booking_intent_v1(
    p_owner_id,'hbi_req_'||p_tag,
    pg_catalog.repeat('a',64),pg_catalog.repeat('b',64),
    'hfo_'||p_tag,'mock',p_tag||'-offer','{}'::jsonb,'{}'::jsonb,
    pg_catalog.jsonb_build_object('amount','2600','currency','SDG','validUntil',(pg_catalog.now()+interval '2 hours')::text),
    '{}'::jsonb,p_travelers,'{}'::jsonb,pg_catalog.now()+interval '2 hours'
  );

  perform * from public.prepare_flight_payment_initiation_v1(
    p_owner_id,
    (select intent.booking_intent_id from app_private.flight_booking_intents as intent where intent.idempotency_key='hbi_req_'||p_tag),
    'card','hpi_req_'||p_tag,pg_catalog.repeat('c',64)
  );

  perform * from public.materialize_flight_payment_initiation_v1(
    p_owner_id,
    (select intent.booking_intent_id from app_private.flight_booking_intents as intent where intent.idempotency_key='hbi_req_'||p_tag),
    'hpi_req_'||p_tag,pg_catalog.repeat('c',64),
    'mock_psp',p_tag||'-payment',p_tag||'-session',null,false,pg_catalog.now()+interval '30 minutes',
    null,null,pg_catalog.repeat('d',64)
  );

  select initiation.booking_id,initiation.payment_id
    into strict v_booking_id,v_payment_id
    from app_private.flight_payment_initiations as initiation
   where initiation.idempotency_key='hpi_req_'||p_tag;

  perform public.apply_payment_event(
    v_payment_id,'confirmed','mock_psp',p_tag||'-provider-event','approved',
    2600,'SDG',true,pg_catalog.repeat('e',64),pg_catalog.now(),null
  );

  if p_stop_after_payment then
    return v_booking_id;
  end if;

  perform * from public.prepare_flight_supplier_booking_execution_v1(
    p_owner_id,v_booking_id,'hsb_req_'||p_tag,pg_catalog.repeat('f',64)
  );
  perform * from public.mark_flight_supplier_booking_request_sent_v1(
    p_owner_id,v_booking_id,'hsb_req_'||p_tag,pg_catalog.repeat('f',64)
  );
  perform * from public.complete_flight_supplier_booking_execution_v1(
    p_owner_id,v_booking_id,'hsb_req_'||p_tag,pg_catalog.repeat('f',64),
    'ACCEPTED','MOCK-'||p_tag||'-BOOKING','MOCK-'||p_tag||'-PNR',
    pg_catalog.repeat('1',64),
    pg_catalog.jsonb_build_object('contractVersion','flight-supplier-booking-execution/v1','runtimeGate','RT-04')
  );

  return v_booking_id;
end
$helper$;

create or replace function pg_temp.rt04_prepare_ticketing(
  p_owner_id uuid,
  p_booking_id uuid,
  p_tag text,
  p_mark_sent boolean
) returns void
language plpgsql
set search_path=''
as $helper$
begin
  perform * from public.prepare_flight_supplier_ticketing_v1(
    p_owner_id,p_booking_id,'hst_req_'||p_tag,pg_catalog.repeat('2',64)
  );
  if p_mark_sent then
    perform * from public.mark_flight_supplier_ticketing_request_sent_v1(
      p_owner_id,p_booking_id,'hst_req_'||p_tag,pg_catalog.repeat('2',64),'confirm_booking'
    );
  end if;
end
$helper$;

-- Failure taxonomy: known pre-send, definite rejection, possible-send timeout,
-- and malformed normalized response after the durable send claim.
do $taxonomy$
declare
  v_owner uuid;
  v_booking uuid;
  v_execution app_private.flight_supplier_ticketing_executions%rowtype;
  v_replay record;
  v_error text;
begin
  v_owner:='77100000-0000-4000-8000-000000000001';
  v_booking:=pg_temp.rt04_confirmed_booking(v_owner,'78100000-0000-4000-8000-000000000001','rt04presendcase0001','[{"travelerKey":"adt-1"}]'::jsonb);
  perform pg_temp.rt04_prepare_ticketing(v_owner,v_booking,'rt04presendcase0001',false);
  perform * from public.record_flight_supplier_ticketing_failure_v1(v_owner,v_booking,'hst_req_rt04presendcase0001',pg_catalog.repeat('2',64),'CONFIGURATION_FAILED',false);
  select execution.* into strict v_execution from app_private.flight_supplier_ticketing_executions as execution where execution.booking_id=v_booking;
  if v_execution.execution_state<>'FAILED' or v_execution.reconciliation_required or v_execution.attempt_count<>0 then
    raise exception 'RT-04 pre-send failure taxonomy regression';
  end if;

  v_owner:='77100000-0000-4000-8000-000000000002';
  v_booking:=pg_temp.rt04_confirmed_booking(v_owner,'78100000-0000-4000-8000-000000000002','rt04rejectcase000001','[{"travelerKey":"adt-1"}]'::jsonb);
  perform pg_temp.rt04_prepare_ticketing(v_owner,v_booking,'rt04rejectcase000001',true);
  perform * from public.record_flight_supplier_ticketing_failure_v1(v_owner,v_booking,'hst_req_rt04rejectcase000001',pg_catalog.repeat('2',64),'SUPPLIER_TICKETING_REJECTED',false);
  select execution.* into strict v_execution from app_private.flight_supplier_ticketing_executions as execution where execution.booking_id=v_booking;
  if v_execution.execution_state<>'REJECTED' or v_execution.reconciliation_required or v_execution.attempt_count<>1 then
    raise exception 'RT-04 definite rejection taxonomy regression';
  end if;

  v_owner:='77100000-0000-4000-8000-000000000003';
  v_booking:=pg_temp.rt04_confirmed_booking(v_owner,'78100000-0000-4000-8000-000000000003','rt04timeoutcase00001','[{"travelerKey":"adt-1"}]'::jsonb);
  perform pg_temp.rt04_prepare_ticketing(v_owner,v_booking,'rt04timeoutcase00001',true);
  perform * from public.record_flight_supplier_ticketing_failure_v1(v_owner,v_booking,'hst_req_rt04timeoutcase00001',pg_catalog.repeat('2',64),'SUPPLIER_TIMEOUT',true);
  select * into strict v_replay from public.mark_flight_supplier_ticketing_request_sent_v1(v_owner,v_booking,'hst_req_rt04timeoutcase00001',pg_catalog.repeat('2',64),'confirm_booking');
  select execution.* into strict v_execution from app_private.flight_supplier_ticketing_executions as execution where execution.booking_id=v_booking;
  if v_execution.execution_state<>'UNKNOWN' or not v_execution.reconciliation_required
     or v_execution.supplier_booking_ref is null or v_execution.attempt_count<>1
     or v_replay.should_send or not v_replay.replayed then
    raise exception 'RT-04 possible-send UNKNOWN/no-blind-reissue regression';
  end if;

  v_owner:='77100000-0000-4000-8000-000000000004';
  v_booking:=pg_temp.rt04_confirmed_booking(v_owner,'78100000-0000-4000-8000-000000000004','rt04malformed000001','[{"travelerKey":"adt-1"}]'::jsonb);
  perform pg_temp.rt04_prepare_ticketing(v_owner,v_booking,'rt04malformed000001',true);
  begin
    perform * from public.complete_flight_supplier_ticketing_v1(
      v_owner,v_booking,'hst_req_rt04malformed000001',pg_catalog.repeat('2',64),
      'ISSUED','[{"notATicket":true}]'::jsonb,pg_catalog.repeat('3',64),'{}'::jsonb
    );
    raise exception 'RT-04 malformed result unexpectedly accepted';
  exception when sqlstate '22023' then
    get stacked diagnostics v_error=message_text;
  end;
  perform * from public.record_flight_supplier_ticketing_failure_v1(v_owner,v_booking,'hst_req_rt04malformed000001',pg_catalog.repeat('2',64),'MALFORMED_SUPPLIER_RESPONSE',true);
  select execution.* into strict v_execution from app_private.flight_supplier_ticketing_executions as execution where execution.booking_id=v_booking;
  if v_error is null or v_execution.execution_state<>'UNKNOWN' or not v_execution.reconciliation_required
     or exists(select 1 from app_private.flight_ticket_records as ticket where ticket.booking_id=v_booking) then
    raise exception 'RT-04 malformed response UNKNOWN regression';
  end if;
end
$taxonomy$;

-- Ticket evidence: B13 PNR/reference alone and B14 PROCESSING remain confirmed;
-- partial, duplicate, and malformed evidence fail before a complete trusted set.
do $evidence$
declare
  v_owner constant uuid:='77200000-0000-4000-8000-000000000001';
  v_booking uuid;
  v_execution app_private.flight_supplier_ticketing_executions%rowtype;
  v_payment public.payments%rowtype;
  v_booking_row public.bookings%rowtype;
  v_partial text;
  v_dup_traveler text;
  v_dup_ticket text;
  v_malformed text;
begin
  v_booking:=pg_temp.rt04_confirmed_booking(
    v_owner,'78200000-0000-4000-8000-000000000001','rt04evidencecase001',
    '[{"travelerKey":"adt-1"},{"travelerKey":"adt-2"}]'::jsonb
  );

  select booking.* into strict v_booking_row from public.bookings as booking where booking.id=v_booking;
  if v_booking_row.status<>'confirmed' or v_booking_row.supplier_reference is null
     or exists(select 1 from app_private.flight_ticket_records as ticket where ticket.booking_id=v_booking) then
    raise exception 'RT-04 PNR/supplier-reference-only gate regression';
  end if;

  perform pg_temp.rt04_prepare_ticketing(v_owner,v_booking,'rt04evidencecase001',true);
  perform * from public.complete_flight_supplier_ticketing_v1(
    v_owner,v_booking,'hst_req_rt04evidencecase001',pg_catalog.repeat('2',64),
    'PROCESSING','[]'::jsonb,pg_catalog.repeat('3',64),'{}'::jsonb
  );
  select booking.* into strict v_booking_row from public.bookings as booking where booking.id=v_booking;
  if v_booking_row.status<>'confirmed' or exists(select 1 from app_private.flight_ticket_records as ticket where ticket.booking_id=v_booking) then
    raise exception 'RT-04 PROCESSING ticket gate regression';
  end if;

  begin
    perform * from public.complete_flight_supplier_ticketing_v1(
      v_owner,v_booking,'hst_req_rt04evidencecase001',pg_catalog.repeat('2',64),'ISSUED',
      '[{"travelerKey":"adt-1","ticketNumber":"ETKT-RT04-PARTIAL-1","supplierTicketRef":"RT04-PARTIAL","issuedAt":"2026-08-31T19:00:00Z","artifact":{"availability":"NONE","artifactRef":null,"mediaType":null,"digest":null}}]'::jsonb,
      pg_catalog.repeat('4',64),'{}'::jsonb
    );
    raise exception 'RT-04 partial coverage unexpectedly accepted';
  exception when sqlstate '22023' then get stacked diagnostics v_partial=message_text; end;

  begin
    perform * from public.complete_flight_supplier_ticketing_v1(
      v_owner,v_booking,'hst_req_rt04evidencecase001',pg_catalog.repeat('2',64),'ISSUED',
      '[{"travelerKey":"adt-1","ticketNumber":"ETKT-RT04-DUP-T-1","supplierTicketRef":"RT04-DUP-T","issuedAt":"2026-08-31T19:00:00Z","artifact":{"availability":"NONE","artifactRef":null,"mediaType":null,"digest":null}},{"travelerKey":"adt-1","ticketNumber":"ETKT-RT04-DUP-T-2","supplierTicketRef":"RT04-DUP-T","issuedAt":"2026-08-31T19:00:00Z","artifact":{"availability":"NONE","artifactRef":null,"mediaType":null,"digest":null}}]'::jsonb,
      pg_catalog.repeat('5',64),'{}'::jsonb
    );
    raise exception 'RT-04 duplicate traveler unexpectedly accepted';
  exception when unique_violation then get stacked diagnostics v_dup_traveler=message_text; end;

  begin
    perform * from public.complete_flight_supplier_ticketing_v1(
      v_owner,v_booking,'hst_req_rt04evidencecase001',pg_catalog.repeat('2',64),'ISSUED',
      '[{"travelerKey":"adt-1","ticketNumber":"ETKT-RT04-DUP-NUMBER","supplierTicketRef":"RT04-DUP-N","issuedAt":"2026-08-31T19:00:00Z","artifact":{"availability":"NONE","artifactRef":null,"mediaType":null,"digest":null}},{"travelerKey":"adt-2","ticketNumber":"ETKT-RT04-DUP-NUMBER","supplierTicketRef":"RT04-DUP-N","issuedAt":"2026-08-31T19:00:00Z","artifact":{"availability":"NONE","artifactRef":null,"mediaType":null,"digest":null}}]'::jsonb,
      pg_catalog.repeat('6',64),'{}'::jsonb
    );
    raise exception 'RT-04 duplicate ticket number unexpectedly accepted';
  exception when unique_violation then get stacked diagnostics v_dup_ticket=message_text; end;

  begin
    perform * from public.complete_flight_supplier_ticketing_v1(
      v_owner,v_booking,'hst_req_rt04evidencecase001',pg_catalog.repeat('2',64),'ISSUED',
      '[{"travelerKey":"adt-1","ticketNumber":"ETKT-RT04-VALID-1","supplierTicketRef":"RT04-BAD","issuedAt":"2026-08-31T19:00:00Z","artifact":{"availability":"NONE","artifactRef":null,"mediaType":null,"digest":null}},{"travelerKey":"adt-2","ticketNumber":"?","supplierTicketRef":"RT04-BAD","issuedAt":"2026-08-31T19:00:00Z","artifact":{"availability":"NONE","artifactRef":null,"mediaType":null,"digest":null}}]'::jsonb,
      pg_catalog.repeat('7',64),'{}'::jsonb
    );
    raise exception 'RT-04 malformed ticket number unexpectedly accepted';
  exception when sqlstate '22023' then get stacked diagnostics v_malformed=message_text; end;

  if v_partial is null or v_dup_traveler is null or v_dup_ticket is null or v_malformed is null
     or exists(select 1 from app_private.flight_ticket_records as ticket where ticket.booking_id=v_booking) then
    raise exception 'RT-04 invalid evidence rollback regression';
  end if;

  perform * from public.complete_flight_supplier_ticketing_v1(
    v_owner,v_booking,'hst_req_rt04evidencecase001',pg_catalog.repeat('2',64),'ISSUED',
    '[{"travelerKey":"adt-1","ticketNumber":"ETKT-RT04-FINAL-1","supplierTicketRef":"RT04-FINAL-1","issuedAt":"2026-08-31T19:00:00Z","artifact":{"availability":"NONE","artifactRef":null,"mediaType":null,"digest":null}},{"travelerKey":"adt-2","ticketNumber":"ETKT-RT04-FINAL-2","supplierTicketRef":"RT04-FINAL-2","issuedAt":"2026-08-31T19:01:00Z","artifact":{"availability":"NONE","artifactRef":null,"mediaType":null,"digest":null}}]'::jsonb,
    pg_catalog.repeat('8',64),'{}'::jsonb
  );

  select execution.* into strict v_execution from app_private.flight_supplier_ticketing_executions as execution where execution.booking_id=v_booking;
  select booking.* into strict v_booking_row from public.bookings as booking where booking.id=v_booking;
  select payment.* into strict v_payment from public.payments as payment where payment.booking_id=v_booking;
  if v_execution.execution_state<>'ISSUED'
     or v_execution.issued_at is distinct from '2026-08-31T19:01:00Z'::timestamptz
     or v_booking_row.status<>'ticketed'
     or v_payment.status<>'confirmed'
     or v_booking_row.net_cost<>2300 or v_booking_row.sold_price<>2600
     or v_booking_row.currency<>'SDG' or v_booking_row.fx_rate_sdg is not null
     or v_booking_row.agent_profit<>300 or v_booking_row.commission<>0
     or (select count(*) from app_private.flight_ticket_records as ticket where ticket.booking_id=v_booking)<>2
     or exists(select 1 from app_private.flight_ticket_records as ticket where ticket.booking_id=v_booking and ticket.artifact_availability<>'NONE') then
    raise exception 'RT-04 complete trusted coverage/firewall regression';
  end if;
end
$evidence$;

-- Owner A cannot view Owner B's B14/ticket evidence through authenticated RPCs,
-- cannot reach private tables, and cannot invoke the service boundary for B.
do $owner_setup$
declare
  v_owner_a constant uuid:='77300000-0000-4000-8000-000000000001';
  v_owner_b constant uuid:='77300000-0000-4000-8000-000000000002';
  v_booking_a uuid;
  v_booking_b uuid;
begin
  v_booking_a:=pg_temp.rt04_confirmed_booking(v_owner_a,'78300000-0000-4000-8000-000000000001','rt04owneracase0001','[{"travelerKey":"adt-1"}]'::jsonb);
  v_booking_b:=pg_temp.rt04_confirmed_booking(v_owner_b,'78300000-0000-4000-8000-000000000002','rt04ownerbcase0001','[{"travelerKey":"adt-1"}]'::jsonb);
  perform pg_temp.rt04_prepare_ticketing(v_owner_b,v_booking_b,'rt04ownerbcase0001',true);
  perform * from public.complete_flight_supplier_ticketing_v1(
    v_owner_b,v_booking_b,'hst_req_rt04ownerbcase0001',pg_catalog.repeat('2',64),'ISSUED',
    '[{"travelerKey":"adt-1","ticketNumber":"ETKT-RT04-OWNER-B","supplierTicketRef":"RT04-OWNER-B","issuedAt":"2026-08-31T19:30:00Z","artifact":{"availability":"AVAILABLE","artifactRef":"trusted://rt04-owner-b","mediaType":"application/pdf","digest":"9999999999999999999999999999999999999999999999999999999999999999"}}]'::jsonb,
    pg_catalog.repeat('8',64),'{}'::jsonb
  );

  begin
    perform * from public.prepare_flight_supplier_ticketing_v1(v_owner_a,v_booking_b,'hst_req_rt04idorattempt001',pg_catalog.repeat('a',64));
    raise exception 'RT-04 cross-owner service mutation unexpectedly accepted';
  exception when no_data_found then null; end;

  begin
    perform * from public.prepare_flight_supplier_booking_execution_v1(v_owner_a,v_booking_b,'hsb_req_rt04idorattempt001',pg_catalog.repeat('a',64));
    raise exception 'RT-04 cross-owner B13 mutation unexpectedly accepted';
  exception when no_data_found then null; end;
end
$owner_setup$;

select pg_catalog.set_config(
  'hajiz.rt04_owner_b_booking_ref',
  (select booking.booking_ref from public.bookings as booking where booking.user_id='77300000-0000-4000-8000-000000000002'),
  true
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','77300000-0000-4000-8000-000000000001',true);

do $owner_read$
declare
  v_owner_b_booking_ref text:=pg_catalog.current_setting('hajiz.rt04_owner_b_booking_ref');
begin
  if (select count(*) from public.get_my_bookings())<>1
     or (select count(*) from public.get_my_payments())<>1
     or (select count(*) from public.get_my_flight_ticketing_v1())<>0
     or (select count(*) from public.get_my_flight_ticket_records_v1(v_owner_b_booking_ref))<>0
     or not exists(select 1 from public.get_my_bookings() as booking where booking.status='confirmed')
     or pg_catalog.has_table_privilege('authenticated','app_private.flight_supplier_booking_executions','select')
     or pg_catalog.has_table_privilege('authenticated','app_private.flight_supplier_ticketing_executions','select')
     or pg_catalog.has_table_privilege('authenticated','app_private.flight_ticket_records','select') then
    raise exception 'RT-04 owner/ticket/artifact isolation regression';
  end if;
end
$owner_read$;

reset role;

-- Trusted ticket evidence is visible only to its owner. Artifact NONE keeps the
-- download flag false even though the authoritative booking is ticketed.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','77200000-0000-4000-8000-000000000001',true);

do $ticketed_my_trips$
begin
  if not exists(select 1 from public.get_my_bookings() as booking where booking.status='ticketed')
     or not exists(
       select 1 from public.get_my_flight_ticketing_v1() as ticketing
        where ticketing.ticketing_state='ISSUED'
          and ticketing.ticket_count=2
          and not ticketing.artifact_available
          and ticketing.issued_at is not null
     )
     or (select count(*) from public.get_my_flight_ticket_records_v1((select booking_ref from public.get_my_bookings() limit 1)))<>2 then
    raise exception 'RT-04 database-backed My Trips ISSUED projection regression';
  end if;
end
$ticketed_my_trips$;

reset role;

-- An AVAILABLE, digest-pinned artifact enables the owner projection only.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','77300000-0000-4000-8000-000000000002',true);

do $artifact_my_trips$
begin
  if not exists(
       select 1 from public.get_my_flight_ticketing_v1() as ticketing
        where ticketing.ticketing_state='ISSUED'
          and ticketing.ticket_count=1
          and ticketing.artifact_available
     )
     or (select count(*) from public.get_my_flight_ticket_records_v1((select booking_ref from public.get_my_bookings() limit 1)))<>1 then
    raise exception 'RT-04 trusted artifact owner projection regression';
  end if;
end
$artifact_my_trips$;

reset role;

-- Payment confirmation alone is not supplier confirmation.
do $payment_only_setup$
declare
  v_booking uuid;
begin
  v_booking:=pg_temp.rt04_confirmed_booking(
    '77500000-0000-4000-8000-000000000001',
    '78500000-0000-4000-8000-000000000001',
    'rt04paymentonly001',
    '[{"travelerKey":"adt-1"}]'::jsonb,
    true
  );
end
$payment_only_setup$;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','77500000-0000-4000-8000-000000000001',true);

do $payment_only_read$
begin
  if not exists(select 1 from public.get_my_bookings() as booking where booking.status='payment_confirmed')
     or not exists(select 1 from public.get_my_payments() as payment where payment.status='confirmed')
     or exists(select 1 from public.get_my_flight_ticketing_v1()) then
    raise exception 'RT-04 payment-confirmed/supplier-state separation regression';
  end if;
end
$payment_only_read$;

reset role;

-- Actual customer RPC state projections for the canonical My Trips states.
do $my_trips_setup$
declare
  v_owner constant uuid:='77400000-0000-4000-8000-000000000001';
  v_booking uuid;
begin
  v_booking:=pg_temp.rt04_confirmed_booking(v_owner,'78400000-0000-4000-8000-000000000001','rt04mytripsproc001','[{"travelerKey":"adt-1"}]'::jsonb);
  perform pg_temp.rt04_prepare_ticketing(v_owner,v_booking,'rt04mytripsproc001',true);
  perform * from public.complete_flight_supplier_ticketing_v1(
    v_owner,v_booking,'hst_req_rt04mytripsproc001',pg_catalog.repeat('2',64),
    'PROCESSING','[]'::jsonb,pg_catalog.repeat('3',64),'{}'::jsonb
  );
end
$my_trips_setup$;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub','77400000-0000-4000-8000-000000000001',true);

do $my_trips_read$
begin
  if not exists(select 1 from public.get_my_bookings() as booking where booking.status='confirmed')
     or not exists(select 1 from public.get_my_payments() as payment where payment.status='confirmed')
     or not exists(
       select 1 from public.get_my_flight_ticketing_v1() as ticketing
        where ticketing.ticketing_state='PROCESSING'
          and ticketing.ticket_count=0
          and not ticketing.artifact_available
          and ticketing.issued_at is null
     ) then
    raise exception 'RT-04 database-backed My Trips PROCESSING projection regression';
  end if;
end
$my_trips_read$;

reset role;

select
  (select count(*) from app_private.flight_supplier_ticketing_executions where execution_state='FAILED' and owner_id='77100000-0000-4000-8000-000000000001') as pre_send_failed,
  (select count(*) from app_private.flight_supplier_ticketing_executions where execution_state='REJECTED' and owner_id='77100000-0000-4000-8000-000000000002') as definite_rejected,
  (select count(*) from app_private.flight_supplier_ticketing_executions where execution_state='UNKNOWN' and reconciliation_required and owner_id in ('77100000-0000-4000-8000-000000000003','77100000-0000-4000-8000-000000000004')) as unknown_cases,
  (select count(*) from app_private.flight_ticket_records where owner_id='77200000-0000-4000-8000-000000000001') as complete_coverage_tickets,
  (select status from public.bookings where user_id='77200000-0000-4000-8000-000000000001') as complete_coverage_booking,
  (select status from public.payments where user_id='77200000-0000-4000-8000-000000000001') as payment_firewall,
  (select count(*) from public.get_my_flight_ticket_records_v1((select booking_ref from public.bookings where user_id='77300000-0000-4000-8000-000000000002'))) as owner_a_visible_owner_b_tickets;

rollback;
