-- HAJIZ payment authority V1. Staging rehearsal migration.
-- Designed for an empty HAJIZ Staging project; do not apply to production without reconciliation.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create type public.payment_method as enum ('card', 'apple_pay', 'google_pay', 'bankak');
create type public.payment_status as enum ('awaiting', 'under_review', 'confirmed', 'rejected', 'expired', 'refunded');
create type public.booking_status as enum ('pending_payment', 'payment_confirmed', 'processing', 'confirmed', 'ticketed', 'completed');
create type public.staff_role as enum ('customer', 'finance', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 32),
  role public.staff_role not null default 'customer',
  commission_rate numeric(7,6) not null default 0 check (commission_rate between 0 and 1),
  finance_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fx_config (
  id bigint generated always as identity primary key,
  source_currency text not null check (source_currency ~ '^[A-Z]{3}$'),
  target_currency text not null check (target_currency ~ '^[A-Z]{3}$'),
  rate numeric(20,8) not null check (rate > 0),
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (valid_until is null or valid_until > valid_from)
);
create unique index fx_config_one_active_pair on public.fx_config(source_currency, target_currency) where active;

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  supplier_offer_ref text not null unique,
  selling_amount numeric(20,2) not null check (selling_amount > 0),
  net_cost numeric(20,2) not null check (net_cost >= 0 and net_cost <= selling_amount),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  enabled boolean not null default true,
  expires_at timestamptz not null,
  supplier_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.traveler_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  traveler_snapshot jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  offer_id uuid not null references public.offers(id),
  booking_ref text not null unique,
  status public.booking_status not null default 'pending_payment',
  net_cost numeric(20,2) not null check (net_cost >= 0),
  sold_price numeric(20,2) not null check (sold_price > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  fx_rate_sdg numeric(20,8),
  agent_profit numeric(20,2) not null,
  commission numeric(20,2) not null default 0,
  pay_method public.payment_method not null,
  traveler_snapshot jsonb not null,
  supplier_status text,
  supplier_reference text,
  supplier_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id),
  user_id uuid not null references auth.users(id),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  payment_reference text not null unique,
  method public.payment_method not null,
  status public.payment_status not null default 'awaiting',
  amount numeric(20,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_sdg numeric(20,2),
  fx_rate_sdg numeric(20,8),
  provider text,
  provider_metadata jsonb not null default '{}'::jsonb,
  bank_account_display_name text,
  masked_account_number text,
  reviewer_id uuid references auth.users(id),
  review_reason text,
  reviewed_at timestamptz,
  expires_at timestamptz,
  confirmed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, idempotency_key),
  check ((method = 'bankak' and amount_sdg is not null and fx_rate_sdg is not null) or
         (method <> 'bankak' and amount_sdg is null and fx_rate_sdg is null))
);

create table public.payment_provider_events (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.payments(id),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  provider_status text not null,
  amount numeric(20,2),
  currency text,
  verified boolean not null,
  payload_digest text not null,
  raw_payload jsonb,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id),
  user_id uuid not null references auth.users(id),
  object_name text not null unique,
  byte_size bigint not null check (byte_size between 1 and 10485760),
  detected_mime text not null check (detected_mime in ('image/jpeg','image/png','application/pdf')),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  submitted_at timestamptz not null default now(),
  inspected_at timestamptz not null,
  request_context jsonb not null default '{}'::jsonb
);

create table public.payment_audit (
  id bigint generated always as identity primary key,
  aggregate_type text not null check (aggregate_type in ('booking','payment','receipt','provider_event','supplier')),
  aggregate_id uuid not null,
  event_type text not null,
  actor_type text not null check (actor_type in ('customer','finance','admin','service','webhook','supplier')),
  actor_id uuid,
  request_id text,
  idempotency_key text,
  before_state text,
  after_state text,
  reason text,
  event_digest text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index bookings_user_created_idx on public.bookings(user_id, created_at desc);
create index payments_user_created_idx on public.payments(user_id, created_at desc);
create index audit_aggregate_idx on public.payment_audit(aggregate_type, aggregate_id, created_at);

alter table public.profiles enable row level security;
alter table public.fx_config enable row level security;
alter table public.offers enable row level security;
alter table public.traveler_tokens enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.payment_provider_events enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.payment_audit enable row level security;

create policy profiles_owner_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy bookings_owner_defense_in_depth on public.bookings for select to authenticated using ((select auth.uid()) = user_id);
create policy payments_owner_defense_in_depth on public.payments for select to authenticated using ((select auth.uid()) = user_id);
create policy receipts_owner_defense_in_depth on public.payment_receipts for select to authenticated using ((select auth.uid()) = user_id);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.profiles to authenticated;

create or replace function app_private.is_staff(required_roles public.staff_role[])
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$ select exists(select 1 from public.profiles p where p.id = auth.uid() and p.finance_enabled and p.role = any(required_roles)) $$;
revoke all on function app_private.is_staff(public.staff_role[]) from public, anon;
grant execute on function app_private.is_staff(public.staff_role[]) to authenticated;

create or replace function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$ begin insert into public.profiles(id, display_name) values(new.id, nullif(new.raw_user_meta_data->>'display_name','')) on conflict(id) do nothing; return new; end $$;
revoke all on function app_private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function app_private.handle_new_user();

create or replace function public.update_my_profile(p_display_name text, p_phone text)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$ begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
  update public.profiles set display_name=p_display_name, phone=p_phone, updated_at=now() where id=auth.uid();
end $$;
revoke all on function public.update_my_profile(text,text) from public, anon;
grant execute on function public.update_my_profile(text,text) to authenticated;

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
  insert into public.bookings(user_id,offer_id,booking_ref,net_cost,sold_price,currency,fx_rate_sdg,agent_profit,commission,pay_method,traveler_snapshot)
  values(v_uid,v_offer.id,'HJZ-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),v_offer.net_cost,v_offer.selling_amount,v_offer.currency,case when p_payment_method='bankak' then v_fx.rate end,v_offer.selling_amount-v_offer.net_cost,0,p_payment_method,v_traveler.traveler_snapshot) returning * into v_booking;
  insert into public.payments(booking_id,user_id,idempotency_key,payment_reference,method,amount,currency,amount_sdg,fx_rate_sdg,provider,bank_account_display_name,masked_account_number,expires_at)
  values(v_booking.id,v_uid,p_idempotency_key,'PAY-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),p_payment_method,v_offer.selling_amount,v_offer.currency,case when p_payment_method='bankak' then round(v_offer.selling_amount*v_fx.rate,2) end,case when p_payment_method='bankak' then v_fx.rate end,case when p_payment_method='bankak' then 'manual_transfer' end,case when p_payment_method='bankak' then 'HAJIZ Bankak' end,case when p_payment_method='bankak' then '****0000' end,case when p_payment_method='bankak' then now()+interval '24 hours' else now()+interval '30 minutes' end) returning * into v_payment;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,actor_id,idempotency_key,after_state) values('payment',v_payment.id,'checkout_created','customer',v_uid,p_idempotency_key,'awaiting');
  return query select v_booking.booking_ref,v_payment.id,v_payment.method,v_payment.amount,v_payment.currency,v_payment.status,v_payment.expires_at,v_payment.amount_sdg,v_payment.payment_reference,v_payment.bank_account_display_name,v_payment.masked_account_number;
exception when no_data_found then raise exception 'trusted offer, traveler token, or FX configuration unavailable';
end $$;
revoke all on function public.create_checkout(uuid,text,public.payment_method,text,text) from public, anon;
grant execute on function public.create_checkout(uuid,text,public.payment_method,text,text) to authenticated;

create or replace function public.get_my_bookings()
returns table(booking_ref text,status public.booking_status,sold_price numeric,currency text,pay_method public.payment_method,created_at timestamptz)
language sql stable security definer set search_path = pg_catalog, public
as $$ select b.booking_ref,b.status,b.sold_price,b.currency,b.pay_method,b.created_at from public.bookings b where b.user_id=auth.uid() order by b.created_at desc $$;
revoke all on function public.get_my_bookings() from public, anon; grant execute on function public.get_my_bookings() to authenticated;

create or replace function public.get_my_payments()
returns table(payment_id uuid,booking_ref text,method public.payment_method,status public.payment_status,amount numeric,currency text,amount_sdg numeric,payment_reference text,expires_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path = pg_catalog, public
as $$ select p.id,b.booking_ref,p.method,p.status,p.amount,p.currency,p.amount_sdg,p.payment_reference,p.expires_at,p.created_at from public.payments p join public.bookings b on b.id=p.booking_id where p.user_id=auth.uid() order by p.created_at desc $$;
revoke all on function public.get_my_payments() from public, anon; grant execute on function public.get_my_payments() to authenticated;

create or replace function public.review_bankak_payment(p_payment_id uuid,p_decision public.payment_status,p_reason text)
returns void language plpgsql security definer set search_path = pg_catalog, public, app_private
as $$ declare v_old public.payment_status; v_booking uuid; begin
  if not app_private.is_staff(array['finance','admin']::public.staff_role[]) then raise exception 'finance/admin required' using errcode='42501'; end if;
  if p_decision not in ('confirmed','rejected') then raise exception 'invalid review decision'; end if;
  select status,booking_id into strict v_old,v_booking from public.payments where id=p_payment_id and method='bankak' and status='under_review' and (expires_at is null or expires_at>now()) for update;
  update public.payments set status=p_decision,reviewer_id=auth.uid(),review_reason=p_reason,reviewed_at=now(),confirmed_at=case when p_decision='confirmed' then now() end,updated_at=now() where id=p_payment_id;
  if p_decision='confirmed' then update public.bookings set status='payment_confirmed',updated_at=now() where id=v_booking and status='pending_payment'; end if;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,actor_id,before_state,after_state,reason) values('payment',p_payment_id,'bankak_review',(select role::text from public.profiles where id=auth.uid()),auth.uid(),v_old::text,p_decision::text,p_reason);
end $$;
revoke all on function public.review_bankak_payment(uuid,public.payment_status,text) from public, anon;
grant execute on function public.review_bankak_payment(uuid,public.payment_status,text) to authenticated;

create or replace function public.register_inspected_receipt(p_payment_id uuid,p_object_name text,p_byte_size bigint,p_detected_mime text,p_sha256 text,p_request_context jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = pg_catalog, public, storage
as $$ declare v_payment public.payments%rowtype; begin
  select * into strict v_payment from public.payments where id=p_payment_id and method='bankak' and status='awaiting' and expires_at>now() for update;
  if p_object_name <> v_payment.user_id::text||'/'||v_payment.id::text||'/'||regexp_replace(split_part(p_object_name,'/',3),'[^A-Za-z0-9._-]','','g') then raise exception 'invalid receipt path'; end if;
  if not exists(select 1 from storage.objects where bucket_id='receipts' and name=p_object_name) then raise exception 'receipt object missing'; end if;
  insert into public.payment_receipts(payment_id,user_id,object_name,byte_size,detected_mime,sha256,inspected_at,request_context) values(p_payment_id,v_payment.user_id,p_object_name,p_byte_size,p_detected_mime,p_sha256,now(),coalesce(p_request_context,'{}'));
  update public.payments set status='under_review',updated_at=now() where id=p_payment_id;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,before_state,after_state,event_digest) values('receipt',p_payment_id,'receipt_inspected','service','awaiting','under_review',p_sha256);
end $$;
revoke all on function public.register_inspected_receipt(uuid,text,bigint,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.register_inspected_receipt(uuid,text,bigint,text,text,jsonb) to service_role;

create or replace function public.apply_payment_event(p_payment_id uuid,p_target public.payment_status,p_provider text,p_provider_event_id text,p_provider_status text,p_amount numeric,p_currency text,p_verified boolean,p_payload_digest text,p_occurred_at timestamptz,p_raw_payload jsonb default null)
returns boolean language plpgsql security definer set search_path = pg_catalog, public
as $$ declare v public.payments%rowtype; begin
  select * into strict v from public.payments where id=p_payment_id for update;
  insert into public.payment_provider_events(payment_id,provider,provider_event_id,event_type,provider_status,amount,currency,verified,payload_digest,raw_payload,occurred_at) values(p_payment_id,p_provider,p_provider_event_id,p_target::text,p_provider_status,p_amount,p_currency,p_verified,p_payload_digest,p_raw_payload) on conflict(provider,provider_event_id) do nothing;
  if not found then return false; end if;
  if not p_verified or p_amount is distinct from v.amount or p_currency is distinct from v.currency then raise exception 'unverified or economics mismatch'; end if;
  if not ((v.method<>'bankak' and v.status='awaiting' and p_target='confirmed') or (v.status in ('awaiting','under_review') and p_target='expired') or (v.status='confirmed' and p_target='refunded')) then return false; end if;
  update public.payments set status=p_target,confirmed_at=case when p_target='confirmed' then now() else confirmed_at end,refunded_at=case when p_target='refunded' then now() else refunded_at end,updated_at=now() where id=p_payment_id;
  if p_target='confirmed' then update public.bookings set status='payment_confirmed',updated_at=now() where id=v.booking_id and status='pending_payment'; end if;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,before_state,after_state,event_digest) values('payment',p_payment_id,'provider_event','webhook',v.status::text,p_target::text,p_payload_digest); return true;
end $$;
revoke all on function public.apply_payment_event(uuid,public.payment_status,text,text,text,numeric,text,boolean,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_event(uuid,public.payment_status,text,text,text,numeric,text,boolean,text,timestamptz,jsonb) to service_role;

create or replace function public.apply_booking_transition(p_booking_id uuid,p_target public.booking_status,p_supplier_reference text default null,p_supplier_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$ declare v public.bookings%rowtype; begin select * into strict v from public.bookings where id=p_booking_id for update;
  if not ((v.status='payment_confirmed' and p_target='processing') or (v.status='processing' and p_target='confirmed') or (v.status='confirmed' and p_target='ticketed') or (v.status='ticketed' and p_target='completed')) then raise exception 'invalid booking transition'; end if;
  update public.bookings set status=p_target,supplier_reference=coalesce(p_supplier_reference,supplier_reference),supplier_metadata=coalesce(p_supplier_metadata,'{}'),updated_at=now() where id=p_booking_id;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,before_state,after_state,metadata) values('booking',p_booking_id,'supplier_transition','supplier',v.status::text,p_target::text,coalesce(p_supplier_metadata,'{}'));
end $$;
revoke all on function public.apply_booking_transition(uuid,public.booking_status,text,jsonb) from public, anon, authenticated;
grant execute on function public.apply_booking_transition(uuid,public.booking_status,text,jsonb) to service_role;

create or replace function app_private.enforce_payment_transition() returns trigger language plpgsql set search_path=pg_catalog, public as $$ begin
  if new.status is distinct from old.status and not ((old.status='awaiting' and new.status in ('under_review','confirmed','expired')) or (old.status='under_review' and new.status in ('confirmed','rejected','expired')) or (old.status='confirmed' and new.status='refunded')) then raise exception 'invalid payment transition: % -> %',old.status,new.status; end if; return new;
end $$;
create or replace function app_private.enforce_booking_transition() returns trigger language plpgsql set search_path=pg_catalog, public as $$ begin
  if new.status is distinct from old.status and not ((old.status='pending_payment' and new.status='payment_confirmed') or (old.status='payment_confirmed' and new.status='processing') or (old.status='processing' and new.status='confirmed') or (old.status='confirmed' and new.status='ticketed') or (old.status='ticketed' and new.status='completed')) then raise exception 'invalid booking transition: % -> %',old.status,new.status; end if; return new;
end $$;
revoke all on function app_private.enforce_payment_transition() from public,anon,authenticated;
revoke all on function app_private.enforce_booking_transition() from public,anon,authenticated;
create trigger payments_state_machine before update of status on public.payments for each row execute function app_private.enforce_payment_transition();
create trigger bookings_state_machine before update of status on public.bookings for each row execute function app_private.enforce_booking_transition();

create or replace function app_private.reject_immutable_mutation() returns trigger language plpgsql set search_path=pg_catalog as $$ begin raise exception 'append-only table'; end $$;
revoke all on function app_private.reject_immutable_mutation() from public, anon, authenticated;
create trigger payment_audit_immutable before update or delete on public.payment_audit for each row execute function app_private.reject_immutable_mutation();
create trigger provider_events_immutable before update or delete on public.payment_provider_events for each row execute function app_private.reject_immutable_mutation();
create trigger receipts_immutable before update or delete on public.payment_receipts for each row execute function app_private.reject_immutable_mutation();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('receipts','receipts',false,10485760,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

create policy receipts_insert_exact_path on storage.objects for insert to authenticated
with check (
  bucket_id='receipts' and
  (storage.foldername(name))[1]=(select auth.uid())::text and
  array_length(storage.foldername(name),1)=2 and
  name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\\.(jpg|jpeg|png|pdf)$') and
  lower(coalesce(metadata->>'mimetype','')) in ('image/jpeg','image/png','application/pdf') and
  exists(select 1 from public.payments p where p.id::text=(storage.foldername(name))[2] and p.user_id=(select auth.uid()) and p.method='bankak' and p.status='awaiting' and p.expires_at>now())
);
revoke all on storage.objects from anon;
revoke select,update,delete on storage.objects from authenticated;
grant insert on storage.objects to authenticated;

revoke all on all functions in schema app_private from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant usage on type public.payment_method, public.payment_status, public.booking_status, public.staff_role to authenticated;

comment on schema app_private is 'Unexposed HAJIZ server authority functions. Never grant schema usage to browser roles.';
