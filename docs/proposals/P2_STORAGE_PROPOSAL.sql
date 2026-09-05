-- REVIEW PROPOSAL ONLY. NOT in supabase/migrations. Not applied or runtime-validated.
-- Separate approval, role review and local database validation required before deployment.
-- Deliberately ends in ROLLBACK. No historical migration or existing policy is replaced.
begin;
create table app_private.p2_saved_travelers (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=1024
    and data ?& array['firstName','lastName'] and data-array['firstName','lastName']='{}'::jsonb
    and jsonb_typeof(data->'firstName')='string' and jsonb_typeof(data->'lastName')='string'
    and char_length(data->>'firstName') between 1 and 80 and char_length(data->>'lastName') between 1 and 80),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table app_private.p2_favorites (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=512
    and data ?& array['kind','canonicalId'] and data-array['kind','canonicalId']='{}'::jsonb
    and data->>'kind' in ('hotel','package','offer') and data->>'canonicalId' ~ '^[A-Za-z0-9_-]{1,128}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table app_private.p2_preferences (
  id uuid primary key, owner_id uuid not null unique references auth.users(id) on delete cascade,
  data jsonb not null check(jsonb_typeof(data)='object' and data ? 'locale'
    and data-'locale'='{}'::jsonb and data->>'locale' in ('ar','en')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table app_private.p2_partners (
  owner_id uuid primary key references auth.users(id) on delete restrict,
  kyc_state text not null default 'NOT_SUBMITTED' check(kyc_state in ('NOT_SUBMITTED','PENDING','VERIFIED','REJECTED')),
  updated_at timestamptz not null default now()
);
-- Read model only: no browser or P2 service can credit commission or execute payouts.
create table app_private.p2_commission_entries (
  id uuid primary key, owner_id uuid not null references app_private.p2_partners(owner_id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  currency text not null check(currency ~ '^[A-Z]{3}$'), amount numeric(20,2) not null check(amount>=0),
  state text not null check(state in ('PENDING','EARNED','REVERSED')),
  source_event_id uuid not null unique, created_at timestamptz not null default now()
);
create table app_private.p2_payouts (
  id uuid primary key, owner_id uuid not null references app_private.p2_partners(owner_id) on delete restrict,
  currency text not null check(currency ~ '^[A-Z]{3}$'), amount numeric(20,2) not null check(amount>0),
  state text not null check(state in ('PENDING','PROCESSING','PAID','FAILED','UNKNOWN')),
  source_event_id uuid not null unique, created_at timestamptz not null default now()
);
create table app_private.p2_catalog (
  id uuid primary key, type text not null check(type in ('package','offer')),
  title text not null check(char_length(title) between 1 and 120),
  summary text not null check(char_length(summary) between 1 and 1000),
  state text not null default 'draft' check(state in ('draft','published')),
  updated_at timestamptz not null default now()
);
create table app_private.p2_notification_outbox (
  event_id uuid primary key, booking_id uuid not null references public.bookings(id) on delete restrict,
  recipient_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check(event_type in ('payment_pending','payment_confirmed','supplier_confirmed','ticket_issued','failed_reconciliation')),
  state text not null default 'NOT_CONFIGURED' check(state in ('NOT_CONFIGURED','PENDING','SENDING','DELIVERED','FAILED','UNKNOWN')),
  attempts integer not null default 0 check(attempts>=0), next_attempt_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index p2_travelers_owner_idx on app_private.p2_saved_travelers(owner_id,id);
create index p2_favorites_owner_idx on app_private.p2_favorites(owner_id,id);
create unique index p2_favorites_unique on app_private.p2_favorites(owner_id,(data->>'kind'),(data->>'canonicalId'));
create index p2_commission_owner_idx on app_private.p2_commission_entries(owner_id,created_at desc);
create index p2_commission_booking_idx on app_private.p2_commission_entries(booking_id);
create index p2_payout_owner_idx on app_private.p2_payouts(owner_id,created_at desc);
create index p2_catalog_state_idx on app_private.p2_catalog(state,updated_at desc);
create index p2_outbox_booking_idx on app_private.p2_notification_outbox(booking_id);
create index p2_outbox_recipient_idx on app_private.p2_notification_outbox(recipient_id);
create index p2_outbox_pending_idx on app_private.p2_notification_outbox(next_attempt_at) where state='PENDING';

-- No object is exposed directly to PostgREST clients; server adapter adds explicit
-- owner and stored-role predicates. Owner SELECT policies are defense in depth only.
do $proposal$
declare t text;
begin
  foreach t in array array['p2_saved_travelers','p2_favorites','p2_preferences','p2_partners',
    'p2_commission_entries','p2_payouts','p2_catalog','p2_notification_outbox'] loop
    execute format('alter table app_private.%I enable row level security',t);
    execute format('revoke all on app_private.%I from public,anon,authenticated,service_role',t);
    if t not in ('p2_catalog','p2_notification_outbox') then
      execute format('create policy %I on app_private.%I for select to authenticated using(owner_id=(select auth.uid()))',t||'_owner_read',t);
    end if;
  end loop;
end $proposal$;
-- No grants for financial ledger producers, KYC writers or notification workers proposed
-- without a reviewed authority contract. No arbitrary recipient or financial write RPC.
rollback;
