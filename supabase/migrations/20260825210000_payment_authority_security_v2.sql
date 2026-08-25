-- HAJIZ Payment Authority Security Gate V2. Apply to HAJIZ Staging only.

create table app_private.checkout_return_origins (
  origin text primary key,
  environment text not null check (environment in ('local', 'staging', 'production')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  check (origin = lower(origin)),
  check (origin ~ '^https://[a-z0-9.-]+(:[0-9]{1,5})?$' or
         (environment = 'local' and origin ~ '^http://(localhost|127[.]0[.]0[.]1)(:[0-9]{1,5})?$'))
);
revoke all on app_private.checkout_return_origins from public, anon, authenticated;

insert into app_private.checkout_return_origins(origin, environment)
values ('http://localhost:5173', 'local'), ('http://127.0.0.1:5173', 'local');

create or replace function app_private.is_allowed_checkout_return_url(p_url text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, app_private
as $$
  select p_url is null or exists (
    select 1
    from app_private.checkout_return_origins a
    where a.enabled
      and p_url = a.origin || coalesce(substring(p_url from char_length(a.origin) + 1), '')
      and (p_url = a.origin or substr(p_url, char_length(a.origin) + 1, 1) = '/')
      and p_url !~ '[[:space:]\\@%]'
      and p_url !~ '[?#]'
      and p_url ~ '^[A-Za-z][A-Za-z0-9+.-]*://[^/]+(/[A-Za-z0-9._~!$&()*+,;=:/-]*)?$'
  )
$$;
revoke all on function app_private.is_allowed_checkout_return_url(text) from public, anon, authenticated;

create or replace function public.create_checkout(p_offer_id uuid, p_traveler_token text, p_payment_method public.payment_method, p_idempotency_key text, p_return_url text default null)
returns table(booking_ref text, payment_id uuid, payment_method public.payment_method, selling_amount numeric, source_currency text, payment_status public.payment_status, expires_at timestamptz, amount_sdg numeric, payment_reference text, bank_account_display_name text, masked_account_number text)
language plpgsql security definer set search_path = pg_catalog, public, app_private
as $$
declare v_uid uuid := auth.uid(); v_offer public.offers%rowtype; v_traveler public.traveler_tokens%rowtype; v_fx public.fx_config%rowtype; v_booking public.bookings%rowtype; v_payment public.payments%rowtype;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 200 then raise exception 'invalid idempotency key'; end if;
  if not app_private.is_allowed_checkout_return_url(p_return_url) then raise exception 'return_url is not allow-listed'; end if;
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

create or replace function app_private.enforce_payment_economics_immutable()
returns trigger language plpgsql set search_path = pg_catalog
as $$ begin
  if row(old.booking_id,old.user_id,old.idempotency_key,old.payment_reference,old.method,old.amount,old.currency,old.amount_sdg,old.fx_rate_sdg,old.provider)
     is distinct from row(new.booking_id,new.user_id,new.idempotency_key,new.payment_reference,new.method,new.amount,new.currency,new.amount_sdg,new.fx_rate_sdg,new.provider)
  then raise exception 'payment economics and authority fields are immutable'; end if;
  return new;
end $$;
revoke all on function app_private.enforce_payment_economics_immutable() from public, anon, authenticated;
create trigger payments_economics_immutable before update on public.payments for each row execute function app_private.enforce_payment_economics_immutable();

create or replace function app_private.enforce_booking_economics_immutable()
returns trigger language plpgsql set search_path = pg_catalog
as $$ begin
  if row(old.user_id,old.offer_id,old.booking_ref,old.net_cost,old.sold_price,old.currency,old.fx_rate_sdg,old.agent_profit,old.commission,old.pay_method,old.traveler_snapshot)
     is distinct from row(new.user_id,new.offer_id,new.booking_ref,new.net_cost,new.sold_price,new.currency,new.fx_rate_sdg,new.agent_profit,new.commission,new.pay_method,new.traveler_snapshot)
  then raise exception 'booking economics and ownership fields are immutable'; end if;
  return new;
end $$;
revoke all on function app_private.enforce_booking_economics_immutable() from public, anon, authenticated;
create trigger bookings_economics_immutable before update on public.bookings for each row execute function app_private.enforce_booking_economics_immutable();

revoke all on all functions in schema app_private from public, anon, authenticated;

create or replace function app_private.can_upload_bankak_receipt(p_payment_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.payments p
    where p.id = p_payment_id
      and p.user_id = auth.uid()
      and p.method = 'bankak'
      and p.status = 'awaiting'
      and p.expires_at > now()
  )
$$;
revoke all on function app_private.can_upload_bankak_receipt(uuid) from public, anon, authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.can_upload_bankak_receipt(uuid) to authenticated;

drop policy receipts_insert_exact_path on storage.objects;
create policy receipts_insert_exact_path on storage.objects for insert to authenticated
with check (
  bucket_id='receipts' and
  (storage.foldername(name))[1]=(select auth.uid())::text and
  array_length(storage.foldername(name),1)=2 and
  name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\\.(jpg|jpeg|png|pdf)$') and
  lower(coalesce(metadata->>'mimetype','')) in ('image/jpeg','image/png','application/pdf') and
  app_private.can_upload_bankak_receipt(((storage.foldername(name))[2])::uuid)
);

create or replace function public.apply_payment_event(p_payment_id uuid,p_target public.payment_status,p_provider text,p_provider_event_id text,p_provider_status text,p_amount numeric,p_currency text,p_verified boolean,p_payload_digest text,p_occurred_at timestamptz,p_raw_payload jsonb default null)
returns boolean language plpgsql security definer set search_path = pg_catalog, public
as $$ declare v public.payments%rowtype; begin
  select * into strict v from public.payments where id=p_payment_id for update;
  insert into public.payment_provider_events(payment_id,provider,provider_event_id,event_type,provider_status,amount,currency,verified,payload_digest,raw_payload,occurred_at)
  values(p_payment_id,p_provider,p_provider_event_id,p_target::text,p_provider_status,p_amount,p_currency,p_verified,p_payload_digest,p_raw_payload,p_occurred_at)
  on conflict(provider,provider_event_id) do nothing;
  if not found then return false; end if;
  if not p_verified or p_amount is distinct from v.amount or p_currency is distinct from v.currency then raise exception 'unverified or economics mismatch'; end if;
  if not ((v.method<>'bankak' and v.status='awaiting' and p_target='confirmed') or (v.status in ('awaiting','under_review') and p_target='expired') or (v.status='confirmed' and p_target='refunded')) then return false; end if;
  update public.payments set status=p_target,confirmed_at=case when p_target='confirmed' then now() else confirmed_at end,refunded_at=case when p_target='refunded' then now() else refunded_at end,updated_at=now() where id=p_payment_id;
  if p_target='confirmed' then update public.bookings set status='payment_confirmed',updated_at=now() where id=v.booking_id and status='pending_payment'; end if;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,before_state,after_state,event_digest) values('payment',p_payment_id,'provider_event','webhook',v.status::text,p_target::text,p_payload_digest);
  return true;
end $$;
revoke all on function public.apply_payment_event(uuid,public.payment_status,text,text,text,numeric,text,boolean,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_event(uuid,public.payment_status,text,text,text,numeric,text,boolean,text,timestamptz,jsonb) to service_role;
