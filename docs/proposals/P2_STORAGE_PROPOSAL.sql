-- HAJIZ P2 STORAGE REMEDIATION — REVIEW PROPOSAL ONLY.
-- NOT in supabase/migrations. NOT applied or runtime-validated.
-- Canonical architecture: private tables + same-owner SECURITY DEFINER RPCs;
-- service_role receives EXECUTE only, never direct table privileges.
-- RLS is defense in depth; NO FORCE is deliberate and ownership is guarded.
begin;

-- M-01 PRECONDITION: reject same-name relations unless they carry the exact
-- canonical signature and owner. No object is dropped or blindly replaced.
do $guard$
declare item record; relation regclass; relation_owner oid; relation_kind "char"; signature text;
  current_owner oid := (select oid from pg_catalog.pg_roles where rolname=current_user);
begin
  for item in select * from (values
    ('app_private.p2_saved_travelers','hajiz:p2:saved_travelers:v2'),
    ('app_private.p2_favorites','hajiz:p2:favorites:v2'),
    ('app_private.p2_preferences','hajiz:p2:preferences:v2'),
    ('app_private.p2_partners','hajiz:p2:partners:v2'),
    ('app_private.p2_kyc_transition_audit','hajiz:p2:kyc_transition_audit:v2'),
    ('app_private.p2_commission_entries','hajiz:p2:commission_entries:v2'),
    ('app_private.p2_payouts','hajiz:p2:payouts:v2'),
    ('app_private.p2_catalog','hajiz:p2:catalog:v2'),
    ('app_private.p2_notification_outbox','hajiz:p2:notification_outbox:v2')
  ) as objects(name,canonical_signature) loop
    relation:=pg_catalog.to_regclass(item.name);
    if relation is not null then
      select relowner,relkind,pg_catalog.obj_description(oid,'pg_class') into relation_owner,relation_kind,signature from pg_catalog.pg_class where oid=relation;
      if relation_owner is distinct from current_owner or relation_kind<>'r' or signature is distinct from item.canonical_signature then
        raise exception 'P2 relation % exists with non-canonical ownership or signature',item.name;
      end if;
    end if;
  end loop;
end $guard$;

do $migration$ begin
  if pg_catalog.to_regclass('app_private.p2_saved_travelers') is null then
    create table app_private.p2_saved_travelers(
      id uuid primary key default gen_random_uuid(),
      owner_id uuid not null references auth.users(id) on delete cascade,
      data jsonb not null,
      created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
      constraint p2_saved_travelers_data_check check(
        pg_catalog.jsonb_typeof(data)='object' and pg_catalog.pg_column_size(data)<=1024
        and data ?& array['firstName','lastName'] and data-array['firstName','lastName']='{}'::jsonb
        and pg_catalog.jsonb_typeof(data->'firstName')='string' and pg_catalog.jsonb_typeof(data->'lastName')='string'
        and char_length(data->>'firstName') between 1 and 80 and char_length(data->>'lastName') between 1 and 80
        and data->>'firstName' !~ '[[:cntrl:]]' and data->>'lastName' !~ '[[:cntrl:]]')
    );
    comment on table app_private.p2_saved_travelers is 'hajiz:p2:saved_travelers:v2';
  end if;
end $migration$;

do $migration$ begin
  if pg_catalog.to_regclass('app_private.p2_favorites') is null then
    create table app_private.p2_favorites(
      id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
      data jsonb not null, created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
      constraint p2_favorites_data_check check(
        pg_catalog.jsonb_typeof(data)='object' and pg_catalog.pg_column_size(data)<=512
        and data ?& array['kind','canonicalId'] and data-array['kind','canonicalId']='{}'::jsonb
        and data->>'kind' in ('hotel','package','offer') and data->>'canonicalId' ~ '^[A-Za-z0-9_-]{1,128}$'),
      constraint p2_favorites_owner_identity_unique unique(owner_id,(data->>'kind'),(data->>'canonicalId'))
    );
    comment on table app_private.p2_favorites is 'hajiz:p2:favorites:v2';
  end if;
end $migration$;

do $migration$ begin
  if pg_catalog.to_regclass('app_private.p2_preferences') is null then
    create table app_private.p2_preferences(
      owner_id uuid primary key references auth.users(id) on delete cascade, data jsonb not null,
      created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
      constraint p2_preferences_data_check check(pg_catalog.jsonb_typeof(data)='object' and data ? 'locale' and data-'locale'='{}'::jsonb and data->>'locale' in ('ar','en'))
    );
    comment on table app_private.p2_preferences is 'hajiz:p2:preferences:v2';
  end if;
end $migration$;

do $migration$ begin
  if pg_catalog.to_regclass('app_private.p2_partners') is null then
    create table app_private.p2_partners(
      owner_id uuid primary key references auth.users(id) on delete restrict,
      kyc_state text not null default 'NOT_SUBMITTED', created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
      constraint p2_partners_kyc_state_check check(kyc_state in ('NOT_SUBMITTED','PENDING','VERIFIED','REJECTED'))
    );
    comment on table app_private.p2_partners is 'hajiz:p2:partners:v2';
  end if;
end $migration$;

do $migration$ begin
  if pg_catalog.to_regclass('app_private.p2_kyc_transition_audit') is null then
    create table app_private.p2_kyc_transition_audit(
      id uuid primary key default gen_random_uuid(), owner_id uuid not null references app_private.p2_partners(owner_id) on delete restrict,
      previous_state text not null, new_state text not null, actor_id uuid not null references auth.users(id) on delete restrict,
      actor_source text not null, source_event_id uuid not null unique, occurred_at timestamptz not null default pg_catalog.clock_timestamp(),
      constraint p2_kyc_audit_previous_check check(previous_state in ('NOT_SUBMITTED','PENDING','VERIFIED','REJECTED')),
      constraint p2_kyc_audit_new_check check(new_state in ('NOT_SUBMITTED','PENDING','VERIFIED','REJECTED')),
      constraint p2_kyc_audit_source_check check(actor_source in ('OWNER_SUBMISSION','ADMIN_REVIEW')),
      constraint p2_kyc_audit_transition_check check(
        (previous_state='NOT_SUBMITTED' and new_state='PENDING' and actor_source='OWNER_SUBMISSION') or
        (previous_state='REJECTED' and new_state='PENDING' and actor_source='OWNER_SUBMISSION') or
        (previous_state='PENDING' and new_state in ('VERIFIED','REJECTED') and actor_source='ADMIN_REVIEW'))
    );
    comment on table app_private.p2_kyc_transition_audit is 'hajiz:p2:kyc_transition_audit:v2';
  end if;
end $migration$;

do $migration$ begin
  if pg_catalog.to_regclass('app_private.p2_commission_entries') is null then
    create table app_private.p2_commission_entries(
      id uuid primary key default gen_random_uuid(), owner_id uuid not null references app_private.p2_partners(owner_id) on delete restrict,
      booking_id uuid not null references public.bookings(id) on delete restrict, currency text not null, amount numeric(20,2) not null, state text not null,
      source_event_id uuid not null unique, reversal_of_id uuid references app_private.p2_commission_entries(id) on delete restrict,
      created_at timestamptz not null default pg_catalog.now(),
      constraint p2_commission_currency_check check(currency ~ '^[A-Z]{3}$'), constraint p2_commission_amount_check check(amount>0),
      constraint p2_commission_state_check check(state in ('PENDING','EARNED','REVERSED')),
      constraint p2_commission_reversal_check check((state='REVERSED')=(reversal_of_id is not null))
    );
    comment on table app_private.p2_commission_entries is 'hajiz:p2:commission_entries:v2';
  end if;
end $migration$;

do $migration$ begin
  if pg_catalog.to_regclass('app_private.p2_payouts') is null then
    create table app_private.p2_payouts(
      id uuid primary key default gen_random_uuid(), owner_id uuid not null references app_private.p2_partners(owner_id) on delete restrict,
      currency text not null, amount numeric(20,2) not null, state text not null, source_event_id uuid not null unique,
      created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
      constraint p2_payout_currency_check check(currency ~ '^[A-Z]{3}$'), constraint p2_payout_amount_check check(amount>0),
      constraint p2_payout_state_check check(state in ('PENDING','PROCESSING','PAID','FAILED','UNKNOWN'))
    );
    comment on table app_private.p2_payouts is 'hajiz:p2:payouts:v2';
  end if;
end $migration$;

do $migration$ begin
  if pg_catalog.to_regclass('app_private.p2_catalog') is null then
    create table app_private.p2_catalog(
      id uuid primary key default gen_random_uuid(), type text not null, title text not null, summary text not null,
      state text not null default 'draft', version bigint not null default 1,
      created_at timestamptz not null default pg_catalog.now(), created_by uuid not null references auth.users(id) on delete restrict,
      updated_at timestamptz not null default pg_catalog.now(), updated_by uuid not null references auth.users(id) on delete restrict,
      published_at timestamptz, published_by uuid references auth.users(id) on delete restrict,
      constraint p2_catalog_type_check check(type in ('package','offer')),
      constraint p2_catalog_title_check check(char_length(title) between 1 and 120 and title !~ '[[:cntrl:]]'),
      constraint p2_catalog_summary_check check(char_length(summary) between 1 and 1000 and summary !~ '[[:cntrl:]]'),
      constraint p2_catalog_state_check check(state in ('draft','published')), constraint p2_catalog_version_check check(version>0),
      constraint p2_catalog_publish_shape_check check((state='draft' and published_at is null and published_by is null) or (state='published' and published_at is not null and published_by is not null))
    );
    comment on table app_private.p2_catalog is 'hajiz:p2:catalog:v2';
  end if;
end $migration$;

do $migration$ begin
  if pg_catalog.to_regclass('app_private.p2_notification_outbox') is null then
    create table app_private.p2_notification_outbox(
      event_id uuid primary key, booking_id uuid not null references public.bookings(id) on delete restrict,
      recipient_id uuid not null references auth.users(id) on delete restrict, event_type text not null,
      source_event_id uuid, domain_key text not null, state text not null default 'NOT_CONFIGURED', attempts integer not null default 0,
      next_attempt_at timestamptz, created_at timestamptz not null default pg_catalog.now(), updated_at timestamptz not null default pg_catalog.now(),
      constraint p2_outbox_event_type_check check(event_type in ('payment_pending','payment_confirmed','supplier_confirmed','ticket_issued','failed_reconciliation')),
      constraint p2_outbox_source_shape_check check((event_type='failed_reconciliation')=(source_event_id is not null)),
      constraint p2_outbox_domain_key_check check(char_length(domain_key) between 1 and 100 and domain_key !~ '[[:cntrl:]]'),
      constraint p2_outbox_state_check check(state in ('NOT_CONFIGURED','PENDING','SENDING','DELIVERED','FAILED','UNKNOWN')),
      constraint p2_outbox_attempts_check check(attempts>=0), constraint p2_outbox_domain_unique unique(booking_id,event_type,domain_key)
    );
    comment on table app_private.p2_notification_outbox is 'hajiz:p2:notification_outbox:v2';
  end if;
end $migration$;

-- Exact column fingerprint detects same-version drift before privileges exist.
do $guard$
declare item record; actual text[];
begin
  for item in select * from (values
    ('app_private.p2_saved_travelers',array['id:uuid:true','owner_id:uuid:true','data:jsonb:true','created_at:timestamp with time zone:true','updated_at:timestamp with time zone:true']),
    ('app_private.p2_favorites',array['id:uuid:true','owner_id:uuid:true','data:jsonb:true','created_at:timestamp with time zone:true','updated_at:timestamp with time zone:true']),
    ('app_private.p2_preferences',array['owner_id:uuid:true','data:jsonb:true','created_at:timestamp with time zone:true','updated_at:timestamp with time zone:true']),
    ('app_private.p2_partners',array['owner_id:uuid:true','kyc_state:text:true','created_at:timestamp with time zone:true','updated_at:timestamp with time zone:true']),
    ('app_private.p2_kyc_transition_audit',array['id:uuid:true','owner_id:uuid:true','previous_state:text:true','new_state:text:true','actor_id:uuid:true','actor_source:text:true','source_event_id:uuid:true','occurred_at:timestamp with time zone:true']),
    ('app_private.p2_commission_entries',array['id:uuid:true','owner_id:uuid:true','booking_id:uuid:true','currency:text:true','amount:numeric(20,2):true','state:text:true','source_event_id:uuid:true','reversal_of_id:uuid:false','created_at:timestamp with time zone:true']),
    ('app_private.p2_payouts',array['id:uuid:true','owner_id:uuid:true','currency:text:true','amount:numeric(20,2):true','state:text:true','source_event_id:uuid:true','created_at:timestamp with time zone:true','updated_at:timestamp with time zone:true']),
    ('app_private.p2_catalog',array['id:uuid:true','type:text:true','title:text:true','summary:text:true','state:text:true','version:bigint:true','created_at:timestamp with time zone:true','created_by:uuid:true','updated_at:timestamp with time zone:true','updated_by:uuid:true','published_at:timestamp with time zone:false','published_by:uuid:false']),
    ('app_private.p2_notification_outbox',array['event_id:uuid:true','booking_id:uuid:true','recipient_id:uuid:true','event_type:text:true','source_event_id:uuid:false','domain_key:text:true','state:text:true','attempts:integer:true','next_attempt_at:timestamp with time zone:false','created_at:timestamp with time zone:true','updated_at:timestamp with time zone:true'])
  ) as expected(table_name,columns) loop
    select pg_catalog.array_agg(pg_catalog.format('%s:%s:%s',a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull) order by a.attnum)
      into actual from pg_catalog.pg_attribute a where a.attrelid=item.table_name::regclass and a.attnum>0 and not a.attisdropped;
    if actual is distinct from item.columns then raise exception 'P2 table % has non-canonical columns',item.table_name; end if;
  end loop;
end $guard$;

-- Every named constraint has a catalog kind and canonical signature guard.
do $guard$
declare item record; target regclass; constraint_oid oid; actual_kind "char"; signature text;
begin
  for item in select * from (values
    ('app_private.p2_saved_travelers','p2_saved_travelers_pkey','p'),('app_private.p2_saved_travelers','p2_saved_travelers_owner_id_fkey','f'),('app_private.p2_saved_travelers','p2_saved_travelers_data_check','c'),
    ('app_private.p2_favorites','p2_favorites_pkey','p'),('app_private.p2_favorites','p2_favorites_owner_id_fkey','f'),('app_private.p2_favorites','p2_favorites_data_check','c'),('app_private.p2_favorites','p2_favorites_owner_identity_unique','u'),
    ('app_private.p2_preferences','p2_preferences_pkey','p'),('app_private.p2_preferences','p2_preferences_owner_id_fkey','f'),('app_private.p2_preferences','p2_preferences_data_check','c'),
    ('app_private.p2_partners','p2_partners_pkey','p'),('app_private.p2_partners','p2_partners_owner_id_fkey','f'),('app_private.p2_partners','p2_partners_kyc_state_check','c'),
    ('app_private.p2_kyc_transition_audit','p2_kyc_transition_audit_pkey','p'),('app_private.p2_kyc_transition_audit','p2_kyc_transition_audit_owner_id_fkey','f'),('app_private.p2_kyc_transition_audit','p2_kyc_transition_audit_actor_id_fkey','f'),('app_private.p2_kyc_transition_audit','p2_kyc_transition_audit_source_event_id_key','u'),('app_private.p2_kyc_transition_audit','p2_kyc_audit_previous_check','c'),('app_private.p2_kyc_transition_audit','p2_kyc_audit_new_check','c'),('app_private.p2_kyc_transition_audit','p2_kyc_audit_source_check','c'),('app_private.p2_kyc_transition_audit','p2_kyc_audit_transition_check','c'),
    ('app_private.p2_commission_entries','p2_commission_entries_pkey','p'),('app_private.p2_commission_entries','p2_commission_entries_owner_id_fkey','f'),('app_private.p2_commission_entries','p2_commission_entries_booking_id_fkey','f'),('app_private.p2_commission_entries','p2_commission_entries_source_event_id_key','u'),('app_private.p2_commission_entries','p2_commission_entries_reversal_of_id_fkey','f'),('app_private.p2_commission_entries','p2_commission_currency_check','c'),('app_private.p2_commission_entries','p2_commission_amount_check','c'),('app_private.p2_commission_entries','p2_commission_state_check','c'),('app_private.p2_commission_entries','p2_commission_reversal_check','c'),
    ('app_private.p2_payouts','p2_payouts_pkey','p'),('app_private.p2_payouts','p2_payouts_owner_id_fkey','f'),('app_private.p2_payouts','p2_payouts_source_event_id_key','u'),('app_private.p2_payouts','p2_payout_currency_check','c'),('app_private.p2_payouts','p2_payout_amount_check','c'),('app_private.p2_payouts','p2_payout_state_check','c'),
    ('app_private.p2_catalog','p2_catalog_pkey','p'),('app_private.p2_catalog','p2_catalog_created_by_fkey','f'),('app_private.p2_catalog','p2_catalog_updated_by_fkey','f'),('app_private.p2_catalog','p2_catalog_published_by_fkey','f'),('app_private.p2_catalog','p2_catalog_type_check','c'),('app_private.p2_catalog','p2_catalog_title_check','c'),('app_private.p2_catalog','p2_catalog_summary_check','c'),('app_private.p2_catalog','p2_catalog_state_check','c'),('app_private.p2_catalog','p2_catalog_version_check','c'),('app_private.p2_catalog','p2_catalog_publish_shape_check','c'),
    ('app_private.p2_notification_outbox','p2_notification_outbox_pkey','p'),('app_private.p2_notification_outbox','p2_notification_outbox_booking_id_fkey','f'),('app_private.p2_notification_outbox','p2_notification_outbox_recipient_id_fkey','f'),('app_private.p2_notification_outbox','p2_outbox_event_type_check','c'),('app_private.p2_notification_outbox','p2_outbox_source_shape_check','c'),('app_private.p2_notification_outbox','p2_outbox_domain_key_check','c'),('app_private.p2_notification_outbox','p2_outbox_state_check','c'),('app_private.p2_notification_outbox','p2_outbox_attempts_check','c'),('app_private.p2_notification_outbox','p2_outbox_domain_unique','u')
  ) as expected(table_name,name,kind) loop
    target:=item.table_name::regclass;
    select oid,contype,pg_catalog.obj_description(oid,'pg_constraint') into constraint_oid,actual_kind,signature from pg_catalog.pg_constraint where conrelid=target and conname=item.name;
    if constraint_oid is null or actual_kind::text is distinct from item.kind then raise exception 'P2 constraint % on % is missing or drifted',item.name,item.table_name; end if;
    if signature is null then execute pg_catalog.format('comment on constraint %I on %s is %L',item.name,item.table_name,'hajiz:p2:'||item.name||':v2');
    elsif signature is distinct from 'hajiz:p2:'||item.name||':v2' then raise exception 'P2 constraint % has non-canonical signature',item.name; end if;
  end loop;
end $guard$;

-- Guarded indexes validate signature, target, validity, uniqueness, and keys.
do $guard$
declare item record; idx regclass; signature text; definition text; target oid; valid boolean; unique_index boolean;
begin
  for item in select * from (values
    ('app_private.p2_travelers_owner_idx','create index p2_travelers_owner_idx on app_private.p2_saved_travelers(owner_id,created_at desc)','app_private.p2_saved_travelers',false,'owner_id, created_at DESC'),
    ('app_private.p2_favorites_owner_idx','create index p2_favorites_owner_idx on app_private.p2_favorites(owner_id,created_at desc)','app_private.p2_favorites',false,'owner_id, created_at DESC'),
    ('app_private.p2_kyc_owner_time_idx','create index p2_kyc_owner_time_idx on app_private.p2_kyc_transition_audit(owner_id,occurred_at desc)','app_private.p2_kyc_transition_audit',false,'owner_id, occurred_at DESC'),
    ('app_private.p2_commission_owner_idx','create index p2_commission_owner_idx on app_private.p2_commission_entries(owner_id,created_at desc)','app_private.p2_commission_entries',false,'owner_id, created_at DESC'),
    ('app_private.p2_commission_booking_idx','create index p2_commission_booking_idx on app_private.p2_commission_entries(booking_id)','app_private.p2_commission_entries',false,'booking_id'),
    ('app_private.p2_payout_owner_idx','create index p2_payout_owner_idx on app_private.p2_payouts(owner_id,created_at desc)','app_private.p2_payouts',false,'owner_id, created_at DESC'),
    ('app_private.p2_catalog_state_idx','create index p2_catalog_state_idx on app_private.p2_catalog(state,updated_at desc)','app_private.p2_catalog',false,'state, updated_at DESC'),
    ('app_private.p2_outbox_recipient_idx','create index p2_outbox_recipient_idx on app_private.p2_notification_outbox(recipient_id,created_at desc)','app_private.p2_notification_outbox',false,'recipient_id, created_at DESC'),
    ('app_private.p2_outbox_pending_idx','create index p2_outbox_pending_idx on app_private.p2_notification_outbox(next_attempt_at,event_id) where state=''PENDING''','app_private.p2_notification_outbox',false,'next_attempt_at, event_id')
  ) as expected(name,ddl,table_name,is_unique,key_text) loop
    idx:=pg_catalog.to_regclass(item.name);
    if idx is null then execute item.ddl; idx:=pg_catalog.to_regclass(item.name); execute pg_catalog.format('comment on index %s is %L',idx,'hajiz:p2:'||split_part(item.name,'.',2)||':v2');
    else
      select i.indrelid,i.indisvalid,i.indisunique,pg_catalog.pg_get_indexdef(i.indexrelid),pg_catalog.obj_description(i.indexrelid,'pg_class') into target,valid,unique_index,definition,signature from pg_catalog.pg_index i where i.indexrelid=idx;
      if target is distinct from item.table_name::regclass::oid or not valid or unique_index is distinct from item.is_unique or position(item.key_text in definition)=0 or signature is distinct from 'hajiz:p2:'||split_part(item.name,'.',2)||':v2' then raise exception 'P2 index % is non-canonical',item.name; end if;
    end if;
  end loop;
end $guard$;

-- M-02: no role has direct table access. Deny policies are defense in depth.
do $security$
declare item record; signature text; policy_roles text[]; policy_command "char"; policy_using text; policy_check text;
begin
  for item in select * from (values
    ('app_private.p2_saved_travelers','p2_saved_travelers_direct_access_denied'),('app_private.p2_favorites','p2_favorites_direct_access_denied'),
    ('app_private.p2_preferences','p2_preferences_direct_access_denied'),('app_private.p2_partners','p2_partners_direct_access_denied'),
    ('app_private.p2_kyc_transition_audit','p2_kyc_audit_direct_access_denied'),('app_private.p2_commission_entries','p2_commission_direct_access_denied'),
    ('app_private.p2_payouts','p2_payouts_direct_access_denied'),('app_private.p2_catalog','p2_catalog_direct_access_denied'),
    ('app_private.p2_notification_outbox','p2_outbox_direct_access_denied')
  ) as expected(table_name,policy_name) loop
    execute pg_catalog.format('alter table %s enable row level security',item.table_name);
    execute pg_catalog.format('alter table %s no force row level security',item.table_name);
    execute pg_catalog.format('revoke all on table %s from public,anon,authenticated,service_role',item.table_name);
    select p.polcmd,pg_catalog.array_agg(r.rolname order by r.rolname),pg_catalog.pg_get_expr(p.polqual,p.polrelid),pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid),pg_catalog.obj_description(p.oid,'pg_policy')
      into policy_command,policy_roles,policy_using,policy_check,signature
      from pg_catalog.pg_policy p cross join lateral unnest(p.polroles) as policy_role(oid) join pg_catalog.pg_roles r on r.oid=policy_role.oid
      where p.polrelid=item.table_name::regclass and p.polname=item.policy_name
      group by p.oid,p.polcmd,p.polqual,p.polwithcheck,p.polrelid;
    if not found then
      execute pg_catalog.format('create policy %I on %s for all to anon,authenticated using(false) with check(false)',item.policy_name,item.table_name);
      execute pg_catalog.format('comment on policy %I on %s is %L',item.policy_name,item.table_name,'hajiz:p2:'||item.policy_name||':v2');
    elsif policy_command<>'*' or policy_roles is distinct from array['anon','authenticated']::text[]
      or pg_catalog.regexp_replace(coalesce(policy_using,''),'[()[:space:]]','','g')<>'false'
      or pg_catalog.regexp_replace(coalesce(policy_check,''),'[()[:space:]]','','g')<>'false'
      or signature is distinct from 'hajiz:p2:'||item.policy_name||':v2' then raise exception 'P2 policy % on % is non-canonical',item.policy_name,item.table_name;
    end if;
  end loop;
end $security$;

-- Function precondition: CREATE OR REPLACE is allowed only when absent or signed.
do $guard$
declare item record; fn regprocedure; signature text; fn_owner oid;
  current_owner oid := (select oid from pg_catalog.pg_roles where rolname=current_user);
begin
  for item in select * from (values
    ('public.p2_collection_v1(uuid,text,text,uuid,jsonb)','hajiz:p2:function:p2_collection_v1:v2'),
    ('public.get_p2_admin_payments_v1(uuid)','hajiz:p2:function:get_p2_admin_payments_v1:v2'),
    ('public.get_p2_partner_v1(uuid)','hajiz:p2:function:get_p2_partner_v1:v2'),
    ('public.p2_catalog_v1(uuid,text,uuid,text,text,text,bigint)','hajiz:p2:function:p2_catalog_v1:v2'),
    ('public.enqueue_p2_notification_v1(uuid,uuid,text,uuid)','hajiz:p2:function:enqueue_p2_notification_v1:v2'),
    ('public.transition_p2_partner_kyc_v1(uuid,text,uuid,text,uuid)','hajiz:p2:function:transition_p2_partner_kyc_v1:v2'),
    ('public.get_p2_ticket_artifact_authority_v1(uuid,uuid)','hajiz:p2:function:get_p2_ticket_artifact_authority_v1:v2')
  ) as expected(function_name,canonical_signature) loop
    fn:=pg_catalog.to_regprocedure(item.function_name);
    if fn is not null then
      select proowner,pg_catalog.obj_description(oid,'pg_proc') into fn_owner,signature from pg_catalog.pg_proc where oid=fn;
      if fn_owner is distinct from current_owner or signature is distinct from item.canonical_signature then raise exception 'P2 function % exists with non-canonical ownership or signature',item.function_name; end if;
    end if;
  end loop;
end $guard$;

create or replace function public.p2_collection_v1(p_owner_id uuid,p_collection text,p_operation text,p_record_id uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare result jsonb; affected uuid;
begin
  if p_owner_id is null or p_collection not in ('travelers','favorites','preferences') or p_operation not in ('list','save','delete') then raise exception 'invalid P2 collection request' using errcode='22023'; end if;
  if p_operation='list' then
    if p_collection='travelers' then select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'data',data) order by created_at),'[]'::jsonb) into result from app_private.p2_saved_travelers where owner_id=p_owner_id;
    elsif p_collection='favorites' then select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'data',data) order by created_at),'[]'::jsonb) into result from app_private.p2_favorites where owner_id=p_owner_id;
    else select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',owner_id,'data',data)),'[]'::jsonb) into result from app_private.p2_preferences where owner_id=p_owner_id; end if;
    return result;
  end if;
  if p_collection<>'preferences' and p_record_id is null then raise exception 'record id required' using errcode='22023'; end if;
  if p_operation='delete' then
    if p_collection='travelers' then delete from app_private.p2_saved_travelers where id=p_record_id and owner_id=p_owner_id returning id into affected;
    elsif p_collection='favorites' then delete from app_private.p2_favorites where id=p_record_id and owner_id=p_owner_id returning id into affected;
    else delete from app_private.p2_preferences where owner_id=p_owner_id returning owner_id into affected; end if;
    if affected is null then raise exception 'P2 record not found' using errcode='P0002'; end if;
    return pg_catalog.jsonb_build_object('deleted',true);
  end if;
  if p_collection='travelers' then
    insert into app_private.p2_saved_travelers(id,owner_id,data) values(p_record_id,p_owner_id,p_data)
    on conflict(id) do update set data=excluded.data,updated_at=pg_catalog.now() where p2_saved_travelers.owner_id=p_owner_id returning pg_catalog.jsonb_build_object('id',id,'data',data) into result;
  elsif p_collection='favorites' then
    insert into app_private.p2_favorites(id,owner_id,data) values(p_record_id,p_owner_id,p_data)
    on conflict(id) do update set data=excluded.data,updated_at=pg_catalog.now() where p2_favorites.owner_id=p_owner_id returning pg_catalog.jsonb_build_object('id',id,'data',data) into result;
  else
    insert into app_private.p2_preferences(owner_id,data) values(p_owner_id,p_data)
    on conflict(owner_id) do update set data=excluded.data,updated_at=pg_catalog.now() returning pg_catalog.jsonb_build_object('id',owner_id,'data',data) into result;
  end if;
  if result is null then raise exception 'P2 record owner conflict' using errcode='P0002'; end if;
  return result;
end $function$;

create or replace function public.get_p2_admin_payments_v1(p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('booking_ref',b.booking_ref,'booking_status',b.status,'payment_status',p.status,'method',p.method,'amount',p.amount,'currency',p.currency) order by p.created_at desc),'[]'::jsonb)
    into result from (select * from public.payments order by created_at desc limit 100) p join public.bookings b on b.id=p.booking_id;
  return result;
end $function$;

create or replace function public.get_p2_partner_v1(p_owner_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare result jsonb;
begin
  select pg_catalog.jsonb_build_object('owner_id',partner.owner_id,'kyc_state',partner.kyc_state,
    'commissions',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'currency',currency,'amount',amount,'state',state) order by created_at desc),'[]'::jsonb) from (select * from app_private.p2_commission_entries where owner_id=p_owner_id order by created_at desc limit 100) c),
    'payouts',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'currency',currency,'amount',amount,'state',state) order by created_at desc),'[]'::jsonb) from (select * from app_private.p2_payouts where owner_id=p_owner_id order by created_at desc limit 100) p))
    into result from app_private.p2_partners partner where partner.owner_id=p_owner_id;
  if result is null then raise exception 'PARTNER_NOT_FOUND' using errcode='P0002'; end if;
  return result;
end $function$;

create or replace function public.p2_catalog_v1(p_actor_id uuid,p_operation text,p_record_id uuid,p_type text,p_title text,p_summary text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare result jsonb; row app_private.p2_catalog%rowtype;
begin
  if p_operation='published' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c)-array['created_by','updated_by','published_by'] order by updated_at desc),'[]'::jsonb) into result from (select * from app_private.p2_catalog where state='published' order by updated_at desc limit 100) c; return result;
  end if;
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_operation='drafts' then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c)-array['created_by','updated_by','published_by'] order by updated_at desc),'[]'::jsonb) into result from (select * from app_private.p2_catalog where state='draft' order by updated_at desc limit 100) c; return result;
  elsif p_operation='save' then
    if p_record_id is null or p_type not in ('package','offer') or p_expected_version is null or p_expected_version<0 then raise exception 'invalid catalog request' using errcode='22023'; end if;
    if p_expected_version=0 then insert into app_private.p2_catalog(id,type,title,summary,created_by,updated_by) values(p_record_id,p_type,p_title,p_summary,p_actor_id,p_actor_id) on conflict(id) do nothing returning * into row;
    else update app_private.p2_catalog set type=p_type,title=p_title,summary=p_summary,updated_by=p_actor_id,updated_at=pg_catalog.now(),version=version+1 where id=p_record_id and state='draft' and version=p_expected_version returning * into row; end if;
  elsif p_operation='publish' then
    update app_private.p2_catalog set state='published',published_by=p_actor_id,published_at=pg_catalog.clock_timestamp(),updated_by=p_actor_id,updated_at=pg_catalog.now(),version=version+1 where id=p_record_id and state='draft' and version=p_expected_version returning * into row;
  else raise exception 'invalid catalog operation' using errcode='22023'; end if;
  if row.id is null then raise exception 'catalog stale version or write conflict' using errcode='40001'; end if;
  return pg_catalog.jsonb_build_object('state',row.state,'version',row.version);
end $function$;

create or replace function public.enqueue_p2_notification_v1(p_event_id uuid,p_booking_id uuid,p_event_type text,p_source_event_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare domain text; inserted uuid; prior app_private.p2_notification_outbox%rowtype;
begin
  if p_event_id is null or p_booking_id is null or p_event_type not in ('payment_pending','payment_confirmed','supplier_confirmed','ticket_issued','failed_reconciliation') then raise exception 'invalid notification event' using errcode='22023'; end if;
  if p_event_type='failed_reconciliation' then if p_source_event_id is null then raise exception 'source event required' using errcode='22023'; end if; domain:=p_event_type||':'||p_source_event_id::text;
  else if p_source_event_id is not null then raise exception 'source event forbidden' using errcode='22023'; end if; domain:=p_event_type; end if;
  insert into app_private.p2_notification_outbox(event_id,booking_id,recipient_id,event_type,source_event_id,domain_key)
    select p_event_id,b.id,b.user_id,p_event_type,p_source_event_id,domain from public.bookings b where b.id=p_booking_id
    on conflict(booking_id,event_type,domain_key) do nothing returning event_id into inserted;
  if inserted is not null then return pg_catalog.jsonb_build_object('state','NOT_CONFIGURED','replayed',false); end if;
  select * into prior from app_private.p2_notification_outbox where booking_id=p_booking_id and event_type=p_event_type and domain_key=domain for share;
  if prior.event_id is null then raise exception 'notification identity conflict' using errcode='23505'; end if;
  return pg_catalog.jsonb_build_object('state',prior.state,'replayed',true);
end $function$;

create or replace function public.transition_p2_partner_kyc_v1(p_owner_id uuid,p_new_state text,p_actor_id uuid,p_actor_source text,p_source_event_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare partner app_private.p2_partners%rowtype; prior app_private.p2_kyc_transition_audit%rowtype;
begin
  select * into prior from app_private.p2_kyc_transition_audit where source_event_id=p_source_event_id;
  if found then
    if prior.owner_id is distinct from p_owner_id or prior.new_state is distinct from p_new_state or prior.actor_id is distinct from p_actor_id or prior.actor_source is distinct from p_actor_source then raise exception 'KYC idempotency conflict' using errcode='23505'; end if;
    return pg_catalog.jsonb_build_object('state',prior.new_state,'replayed',true);
  end if;
  select * into strict partner from app_private.p2_partners where owner_id=p_owner_id for update;
  if p_actor_source='OWNER_SUBMISSION' then
    if p_actor_id<>p_owner_id or not ((partner.kyc_state='NOT_SUBMITTED' and p_new_state='PENDING') or (partner.kyc_state='REJECTED' and p_new_state='PENDING')) then raise exception 'invalid KYC owner transition' using errcode='42501'; end if;
  elsif p_actor_source='ADMIN_REVIEW' then
    if partner.kyc_state<>'PENDING' or p_new_state not in ('VERIFIED','REJECTED') or not exists(select 1 from public.profiles where id=p_actor_id and role='admin') then raise exception 'invalid KYC admin transition' using errcode='42501'; end if;
  else raise exception 'invalid KYC actor source' using errcode='42501'; end if;
  update app_private.p2_partners set kyc_state=p_new_state,updated_at=pg_catalog.clock_timestamp() where owner_id=p_owner_id;
  insert into app_private.p2_kyc_transition_audit(owner_id,previous_state,new_state,actor_id,actor_source,source_event_id) values(p_owner_id,partner.kyc_state,p_new_state,p_actor_id,p_actor_source,p_source_event_id);
  return pg_catalog.jsonb_build_object('state',p_new_state,'replayed',false);
end $function$;

create or replace function public.get_p2_ticket_artifact_authority_v1(p_owner_id uuid,p_ticket_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $function$
  select pg_catalog.to_jsonb(authority) from (
    select t.id,t.owner_id,t.artifact_ref,t.artifact_digest,t.artifact_media_type
    from app_private.flight_ticket_records t
    join app_private.flight_supplier_ticketing_executions e on e.id=t.ticketing_execution_id and e.booking_id=t.booking_id and e.owner_id=t.owner_id
    join public.bookings b on b.id=t.booking_id and b.user_id=t.owner_id
    where t.id=p_ticket_id and t.owner_id=p_owner_id and b.status='ticketed' and e.execution_state='ISSUED' and not e.reconciliation_required and t.artifact_availability='AVAILABLE'
  ) authority
$function$;

comment on function public.p2_collection_v1(uuid,text,text,uuid,jsonb) is 'hajiz:p2:function:p2_collection_v1:v2';
comment on function public.get_p2_admin_payments_v1(uuid) is 'hajiz:p2:function:get_p2_admin_payments_v1:v2';
comment on function public.get_p2_partner_v1(uuid) is 'hajiz:p2:function:get_p2_partner_v1:v2';
comment on function public.p2_catalog_v1(uuid,text,uuid,text,text,text,bigint) is 'hajiz:p2:function:p2_catalog_v1:v2';
comment on function public.enqueue_p2_notification_v1(uuid,uuid,text,uuid) is 'hajiz:p2:function:enqueue_p2_notification_v1:v2';
comment on function public.transition_p2_partner_kyc_v1(uuid,text,uuid,text,uuid) is 'hajiz:p2:function:transition_p2_partner_kyc_v1:v2';
comment on function public.get_p2_ticket_artifact_authority_v1(uuid,uuid) is 'hajiz:p2:function:get_p2_ticket_artifact_authority_v1:v2';

revoke all on function public.p2_collection_v1(uuid,text,text,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.get_p2_admin_payments_v1(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_p2_partner_v1(uuid) from public,anon,authenticated,service_role;
revoke all on function public.p2_catalog_v1(uuid,text,uuid,text,text,text,bigint) from public,anon,authenticated,service_role;
revoke all on function public.enqueue_p2_notification_v1(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.transition_p2_partner_kyc_v1(uuid,text,uuid,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_p2_ticket_artifact_authority_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.p2_collection_v1(uuid,text,text,uuid,jsonb) to service_role;
grant execute on function public.get_p2_admin_payments_v1(uuid) to service_role;
grant execute on function public.get_p2_partner_v1(uuid) to service_role;
grant execute on function public.p2_catalog_v1(uuid,text,uuid,text,text,text,bigint) to service_role;
grant execute on function public.enqueue_p2_notification_v1(uuid,uuid,text,uuid) to service_role;
grant execute on function public.transition_p2_partner_kyc_v1(uuid,text,uuid,text,uuid) to service_role;
grant execute on function public.get_p2_ticket_artifact_authority_v1(uuid,uuid) to service_role;

-- Same-owner guard documents intentional NO FORCE RLS and rejects hidden owner assumptions.
do $guard$
declare item record; table_owner oid; object_owner oid; fn regprocedure;
begin
  select relowner into strict table_owner from pg_catalog.pg_class where oid='app_private.p2_saved_travelers'::regclass;
  for item in select * from (values
    ('app_private.p2_favorites'),('app_private.p2_preferences'),('app_private.p2_partners'),('app_private.p2_kyc_transition_audit'),
    ('app_private.p2_commission_entries'),('app_private.p2_payouts'),('app_private.p2_catalog'),('app_private.p2_notification_outbox')
  ) as relations(name) loop
    select relowner into strict object_owner from pg_catalog.pg_class where oid=item.name::regclass;
    if object_owner is distinct from table_owner then raise exception 'P2 private tables must share one owner'; end if;
  end loop;
  for item in select * from (values
    ('public.p2_collection_v1(uuid,text,text,uuid,jsonb)'),('public.get_p2_admin_payments_v1(uuid)'),('public.get_p2_partner_v1(uuid)'),
    ('public.p2_catalog_v1(uuid,text,uuid,text,text,text,bigint)'),('public.enqueue_p2_notification_v1(uuid,uuid,text,uuid)'),
    ('public.transition_p2_partner_kyc_v1(uuid,text,uuid,text,uuid)'),('public.get_p2_ticket_artifact_authority_v1(uuid,uuid)')
  ) as functions(name) loop
    fn:=pg_catalog.to_regprocedure(item.name); select proowner into strict object_owner from pg_catalog.pg_proc where oid=fn;
    if object_owner is distinct from table_owner then raise exception 'P2 RPC % and private tables must share one owner',item.name; end if;
  end loop;
end $guard$;

-- No commission, payout, notification-delivery, KYC-provider, supplier, or
-- artifact-provider producer function/grant exists in this proposal.
rollback;
