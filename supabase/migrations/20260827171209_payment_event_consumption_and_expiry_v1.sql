-- HAJIZ payment event consumption and expiry remediation V1.
-- Additive definition replacement only. Do not replay superseded migrations.

create or replace function app_private.enforce_payment_transition()
returns trigger language plpgsql set search_path=pg_catalog, public
as $$ begin
  if new.status is distinct from old.status and not (
    (old.status='awaiting' and old.method<>'bankak' and new.status='confirmed') or
    (old.status='awaiting' and new.status in ('under_review','expired')) or
    (old.status='awaiting' and old.method<>'bankak' and new.status='rejected') or
    (old.status='under_review' and new.status in ('confirmed','rejected','expired')) or
    (old.status='confirmed' and new.status='refunded')
  ) then raise exception 'invalid payment transition: % -> %',old.status,new.status; end if;
  return new;
end $$;
revoke all on function app_private.enforce_payment_transition() from public,anon,authenticated;

create or replace function public.apply_payment_event(p_payment_id uuid,p_target public.payment_status,p_provider text,p_provider_event_id text,p_provider_status text,p_amount numeric,p_currency text,p_verified boolean,p_payload_digest text,p_occurred_at timestamptz,p_raw_payload jsonb default null)
returns boolean language plpgsql security definer set search_path = pg_catalog, public
as $$ declare v public.payments%rowtype; begin
  select * into strict v from public.payments where id=p_payment_id for update;
  if not p_verified or p_amount is distinct from v.amount or p_currency is distinct from v.currency then raise exception 'unverified or economics mismatch'; end if;
  if not (
    (v.method<>'bankak' and v.status='awaiting' and p_target='confirmed' and v.expires_at>now()) or
    (v.method<>'bankak' and v.status='awaiting' and p_target='rejected') or
    (v.status in ('awaiting','under_review') and p_target='expired') or
    (v.status='confirmed' and p_target='refunded')
  ) then return false; end if;
  insert into public.payment_provider_events(payment_id,provider,provider_event_id,event_type,provider_status,amount,currency,verified,payload_digest,raw_payload,occurred_at)
  values(p_payment_id,p_provider,p_provider_event_id,p_target::text,p_provider_status,p_amount,p_currency,p_verified,p_payload_digest,p_raw_payload,p_occurred_at)
  on conflict(provider,provider_event_id) do nothing;
  if not found then return false; end if;
  update public.payments set status=p_target,confirmed_at=case when p_target='confirmed' then now() else confirmed_at end,refunded_at=case when p_target='refunded' then now() else refunded_at end,updated_at=now() where id=p_payment_id;
  if p_target='confirmed' then update public.bookings set status='payment_confirmed',updated_at=now() where id=v.booking_id and status='pending_payment'; end if;
  insert into public.payment_audit(aggregate_type,aggregate_id,event_type,actor_type,before_state,after_state,event_digest)
  values('payment',p_payment_id,'provider_event','webhook',v.status::text,p_target::text,p_payload_digest);
  return true;
end $$;
revoke all on function public.apply_payment_event(uuid,public.payment_status,text,text,text,numeric,text,boolean,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_event(uuid,public.payment_status,text,text,text,numeric,text,boolean,text,timestamptz,jsonb) to service_role;
