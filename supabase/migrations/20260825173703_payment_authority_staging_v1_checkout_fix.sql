create or replace function public.create_checkout(p_offer_id uuid, p_traveler_token text, p_payment_method public.payment_method, p_idempotency_key text, p_return_url text default null)
returns table(booking_ref text, payment_id uuid, payment_method public.payment_method, selling_amount numeric, source_currency text, payment_status public.payment_status, expires_at timestamptz, amount_sdg numeric, payment_reference text, bank_account_display_name text, masked_account_number text)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_uid uuid := auth.uid(); v_offer public.offers%rowtype; v_traveler public.traveler_tokens%rowtype; v_fx public.fx_config%rowtype; v_booking public.bookings%rowtype; v_payment public.payments%rowtype;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 200 then raise exception 'invalid idempotency key'; end if;
  if p_return_url is not null and p_return_url !~ '^https://[^[:space:]]+$' then raise exception 'return_url must use https'; end if;
  select p.* into v_payment from public.payments p where p.user_id=v_uid and p.idempotency_key=p_idempotency_key;
  if found then select b.* into v_booking from public.bookings b where b.id=v_payment.booking_id; return query select v_booking.booking_ref,v_payment.id,v_payment.method,v_payment.amount,v_payment.currency,v_payment.status,v_payment.expires_at,v_payment.amount_sdg,v_payment.payment_reference,v_payment.bank_account_display_name,v_payment.masked_account_number; return; end if;
  select o.* into strict v_offer from public.offers o where o.id=p_offer_id and o.enabled and o.expires_at>now() for share;
  select t.* into strict v_traveler from public.traveler_tokens t where t.token_hash=encode(extensions.digest(p_traveler_token,'sha256'),'hex') and t.user_id=v_uid and t.expires_at>now() for update;
  if p_payment_method='bankak' then select f.* into strict v_fx from public.fx_config f where f.source_currency=v_offer.currency and f.target_currency='SDG' and f.active and f.valid_from<=now() and (f.valid_until is null or f.valid_until>now()) for share; end if;
  insert into public.bookings(user_id,offer_id,booking_ref,net_cost,sold_price,currency,fx_rate_sdg,agent_profit,commission,pay_method,traveler_snapshot) values(v_uid,v_offer.id,'HJZ-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),v_offer.net_cost,v_offer.selling_amount,v_offer.currency,case when p_payment_method='bankak' then v_fx.rate end,v_offer.selling_amount-v_offer.net_cost,0,p_payment_method,v_traveler.traveler_snapshot) returning * into v_booking;
  insert into public.payments(booking_id,user_id,idempotency_key,payment_reference,method,amount,currency,amount_sdg,fx_rate_sdg,provider,bank_account_display_name,masked_account_number,expires_at) values(v_booking.id,v_uid,p_idempotency_key,'PAY-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),p_payment_method,v_offer.selling_amount,v_offer.currency,case when p_payment_method='bankak' then round(v_offer.selling_amount*v_fx.rate,2) end,case when p_payment_method='bankak' then v_fx.rate end,case when p_payment_method='bankak' then 'manual_transfer' end,case when p_payment_method='bankak' then 'HAJIZ Bankak' end,case when p_payment_method='bankak' then '****0000' end,case when p_payment_method='bankak' then now()+interval '24 hours' else now()+interval '30 minutes' end) returning * into v_payment;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,actor_id,idempotency_key,after_state) values('payment',v_payment.id,'checkout_created','customer',v_uid,p_idempotency_key,'awaiting');
  return query select v_booking.booking_ref,v_payment.id,v_payment.method,v_payment.amount,v_payment.currency,v_payment.status,v_payment.expires_at,v_payment.amount_sdg,v_payment.payment_reference,v_payment.bank_account_display_name,v_payment.masked_account_number;
exception when no_data_found then raise exception 'trusted offer, traveler token, or FX configuration unavailable';
end $$;
revoke all on function public.create_checkout(uuid,text,public.payment_method,text,text) from public, anon;
grant execute on function public.create_checkout(uuid,text,public.payment_method,text,text) to authenticated;
