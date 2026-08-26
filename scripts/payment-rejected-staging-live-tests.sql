-- Staging-only trusted SQL gate. Run only on pdnuswmljownjzjzpoop.
-- Synthetic fixed IDs are isolated inside a transaction that is always rolled back.
begin;

do $$ begin
  if has_function_privilege('anon', 'public.apply_payment_event(uuid,public.payment_status,text,text,text,numeric,text,boolean,text,timestamptz,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.apply_payment_event(uuid,public.payment_status,text,text,text,numeric,text,boolean,text,timestamptz,jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.apply_payment_event(uuid,public.payment_status,text,text,text,numeric,text,boolean,text,timestamptz,jsonb)', 'execute')
  then raise exception 'unsafe apply_payment_event grants'; end if;
end $$;

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','f2000000-0000-4000-8000-000000000001','authenticated','authenticated','wave2-payment-rejected@invalid.example','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());

insert into public.offers (id,supplier_offer_ref,selling_amount,net_cost,currency,expires_at)
values ('f2000000-0000-4000-8000-000000000002','W2-REJECTED-GATE-OFFER',125,100,'USD',now()+interval '1 hour');

insert into public.bookings (id,user_id,offer_id,booking_ref,status,net_cost,sold_price,currency,agent_profit,commission,pay_method,traveler_snapshot) values
('f2000000-0000-4000-8000-000000000011','f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','W2-REJECT-OK','pending_payment',100,125,'USD',25,0,'card','{"synthetic":true}'),
('f2000000-0000-4000-8000-000000000012','f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','W2-REJECT-BANKAK','pending_payment',100,125,'USD',25,0,'bankak','{"synthetic":true}'),
('f2000000-0000-4000-8000-000000000013','f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','W2-REJECT-REVIEW','pending_payment',100,125,'USD',25,0,'card','{"synthetic":true}'),
('f2000000-0000-4000-8000-000000000014','f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','W2-REJECT-MISMATCH','pending_payment',100,125,'USD',25,0,'card','{"synthetic":true}'),
('f2000000-0000-4000-8000-000000000015','f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','W2-REJECT-UNVERIFIED','pending_payment',100,125,'USD',25,0,'card','{"synthetic":true}');

insert into public.payments (id,booking_id,user_id,idempotency_key,payment_reference,method,status,amount,currency,amount_sdg,fx_rate_sdg,provider) values
('f2000000-0000-4000-8000-000000000021','f2000000-0000-4000-8000-000000000011','f2000000-0000-4000-8000-000000000001','w2-reject-ok','W2-PAY-OK','card','awaiting',125,'USD',null,null,'mock_psp'),
('f2000000-0000-4000-8000-000000000022','f2000000-0000-4000-8000-000000000012','f2000000-0000-4000-8000-000000000001','w2-reject-bankak','W2-PAY-BANKAK','bankak','awaiting',125,'USD',75000,600,'manual_transfer'),
('f2000000-0000-4000-8000-000000000023','f2000000-0000-4000-8000-000000000013','f2000000-0000-4000-8000-000000000001','w2-reject-review','W2-PAY-REVIEW','card','under_review',125,'USD',null,null,'mock_psp'),
('f2000000-0000-4000-8000-000000000024','f2000000-0000-4000-8000-000000000014','f2000000-0000-4000-8000-000000000001','w2-reject-mismatch','W2-PAY-MISMATCH','card','awaiting',125,'USD',null,null,'mock_psp'),
('f2000000-0000-4000-8000-000000000025','f2000000-0000-4000-8000-000000000015','f2000000-0000-4000-8000-000000000001','w2-reject-unverified','W2-PAY-UNVERIFIED','card','awaiting',125,'USD',null,null,'mock_psp');

set local role service_role;
select public.apply_payment_event('f2000000-0000-4000-8000-000000000021','rejected','mock_psp','w2-event-ok','declined',125,'USD',true,'w2-digest-ok',now(),'{"synthetic":true}');
select public.apply_payment_event('f2000000-0000-4000-8000-000000000021','rejected','mock_psp','w2-event-ok','declined',125,'USD',true,'w2-digest-ok',now(),'{"synthetic":true}');
select public.apply_payment_event('f2000000-0000-4000-8000-000000000022','rejected','mock_psp','w2-event-bankak','declined',125,'USD',true,'w2-digest-bankak',now(),null);
select public.apply_payment_event('f2000000-0000-4000-8000-000000000023','rejected','mock_psp','w2-event-review','declined',125,'USD',true,'w2-digest-review',now(),null);
reset role;

do $$ begin
  begin
    perform public.apply_payment_event('f2000000-0000-4000-8000-000000000024','rejected','mock_psp','w2-event-mismatch','declined',124,'USD',true,'w2-digest-mismatch',now(),null);
    raise exception 'amount mismatch was accepted';
  exception when others then if sqlerrm='amount mismatch was accepted' then raise; end if; end;
  begin
    perform public.apply_payment_event('f2000000-0000-4000-8000-000000000025','rejected','mock_psp','w2-event-unverified','declined',125,'USD',false,'w2-digest-unverified',now(),null);
    raise exception 'unverified event was accepted';
  exception when others then if sqlerrm='unverified event was accepted' then raise; end if; end;

  if (select status from public.payments where id='f2000000-0000-4000-8000-000000000021')<>'rejected' then raise exception 'trusted rejection failed'; end if;
  if (select status from public.payments where id='f2000000-0000-4000-8000-000000000022')<>'awaiting' then raise exception 'Bankak transitioned'; end if;
  if (select status from public.payments where id='f2000000-0000-4000-8000-000000000023')<>'under_review' then raise exception 'under_review transitioned'; end if;
  if exists(select 1 from public.payments where id in ('f2000000-0000-4000-8000-000000000024','f2000000-0000-4000-8000-000000000025') and status<>'awaiting') then raise exception 'invalid event changed state'; end if;
  if exists(select 1 from public.bookings where id in ('f2000000-0000-4000-8000-000000000011','f2000000-0000-4000-8000-000000000012','f2000000-0000-4000-8000-000000000013','f2000000-0000-4000-8000-000000000014','f2000000-0000-4000-8000-000000000015') and status<>'pending_payment') then raise exception 'booking transitioned'; end if;
  if (select count(*) from public.payment_provider_events where provider_event_id='w2-event-ok')<>1 then raise exception 'provider replay duplicated'; end if;
  if (select count(*) from public.payment_audit where aggregate_id='f2000000-0000-4000-8000-000000000021' and after_state='rejected')<>1 then raise exception 'audit replay duplicated'; end if;
  if exists(select 1 from public.payment_provider_events where provider_event_id in ('w2-event-mismatch','w2-event-unverified')) then raise exception 'invalid event persisted'; end if;
end $$;

select 'PASS' as result, 7 as scenarios,
  (select count(*) from public.payment_provider_events where provider_event_id like 'w2-event-%') as staged_events,
  (select count(*) from public.payment_audit where aggregate_id='f2000000-0000-4000-8000-000000000021' and after_state='rejected') as rejection_audits;
rollback;
