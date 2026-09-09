-- HAJIZ Flight Selection Durability V1 canonical migration.
-- Converted from the approved review contract at 035eb43b219603509887a0833fcf88c53d09ed55.
-- Fresh install and exact canonical replay are accepted; catalog drift fails closed.

do $preflight$
declare
  item record;
  relation pg_catalog.regclass;
  actual_columns text[];
  actual_constraints text[];
  signature text;
  relation_owner oid;
  relation_kind "char";
  rls_enabled boolean;
  force_rls boolean;
  current_owner oid := (select oid from pg_catalog.pg_roles where rolname = current_user);
begin
  if pg_catalog.to_regnamespace('app_private') is null then raise exception 'required app_private schema is missing'; end if;
  if pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then raise exception 'required pgcrypto digest function is missing'; end if;
  for item in select * from (values
    ('app_private.flight_search_selections','hajiz:flight-selection-durability:search-table:v1',array['alternative_id:text:true:<NO_DEFAULT>','payload_digest:text:true:<NO_DEFAULT>','internal_offer_id:text:true:<NO_DEFAULT>','provider:text:true:<NO_DEFAULT>','provider_offer_ref:text:true:<NO_DEFAULT>','itinerary_snapshot:jsonb:true:<NO_DEFAULT>','fare_snapshot:jsonb:true:<NO_DEFAULT>','previous_customer_price_snapshot:jsonb:true:<NO_DEFAULT>','passenger_composition:jsonb:true:<NO_DEFAULT>','expires_at:timestamp with time zone:true:<NO_DEFAULT>','created_at:timestamp with time zone:true:transaction_timestamp()']::text[]),
    ('app_private.flight_priced_selections','hajiz:flight-selection-durability:priced-table:v1',array['priced_selection_id:text:true:<NO_DEFAULT>','payload_digest:text:true:<NO_DEFAULT>','alternative_id:text:true:<NO_DEFAULT>','internal_offer_id:text:true:<NO_DEFAULT>','provider:text:true:<NO_DEFAULT>','provider_offer_ref:text:true:<NO_DEFAULT>','customer_price_snapshot:jsonb:true:<NO_DEFAULT>','itinerary_snapshot:jsonb:true:<NO_DEFAULT>','fare_snapshot:jsonb:true:<NO_DEFAULT>','passenger_composition:jsonb:true:<NO_DEFAULT>','expires_at:timestamp with time zone:true:<NO_DEFAULT>','created_at:timestamp with time zone:true:transaction_timestamp()']::text[])
  ) as expected(name,canonical_signature,columns) loop
    relation := pg_catalog.to_regclass(item.name);
    if relation is not null then
      select c.relowner,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_catalog.obj_description(c.oid,'pg_class')
        into relation_owner,relation_kind,rls_enabled,force_rls,signature from pg_catalog.pg_class c where c.oid=relation;
      select pg_catalog.array_agg(pg_catalog.format('%s:%s:%s:%s',a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),case when a.attnotnull then 'true' else 'false' end,pg_catalog.coalesce(pg_catalog.pg_get_expr(d.adbin,d.adrelid,false),'<NO_DEFAULT>')) order by a.attnum)
        into actual_columns from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=relation and a.attnum>0 and not a.attisdropped;
      select pg_catalog.array_agg(c.conname||':'||c.contype order by c.conname) into actual_constraints from pg_catalog.pg_constraint c where c.conrelid=relation;
      if relation_owner is distinct from current_owner or relation_kind<>'r' or signature is distinct from item.canonical_signature
         or actual_columns is distinct from item.columns or not rls_enabled or force_rls then
        raise exception 'flight selection table % has non-canonical catalog structure',item.name;
      end if;
      if item.name like '%search%' and actual_constraints is distinct from array['flight_search_selections_alternative_id_check:c','flight_search_selections_customer_price_snapshot_check:c','flight_search_selections_fare_snapshot_check:c','flight_search_selections_internal_offer_id_check:c','flight_search_selections_itinerary_snapshot_check:c','flight_search_selections_passenger_composition_check:c','flight_search_selections_payload_digest_check:c','flight_search_selections_pkey:p','flight_search_selections_provider_check:c','flight_search_selections_provider_offer_ref_check:c','flight_search_selections_validity_check:c']::text[] then raise exception 'search table constraint set drift'; end if;
      if item.name like '%priced%' and actual_constraints is distinct from array['flight_priced_selections_alternative_id_check:c','flight_priced_selections_customer_price_snapshot_check:c','flight_priced_selections_fare_snapshot_check:c','flight_priced_selections_internal_offer_id_check:c','flight_priced_selections_itinerary_snapshot_check:c','flight_priced_selections_passenger_composition_check:c','flight_priced_selections_payload_digest_check:c','flight_priced_selections_pkey:p','flight_priced_selections_priced_id_check:c','flight_priced_selections_provider_check:c','flight_priced_selections_provider_offer_ref_check:c','flight_priced_selections_validity_check:c']::text[] then raise exception 'priced table constraint set drift'; end if;
      if exists (
        select 1 from pg_catalog.pg_constraint c where c.conrelid=relation
        and pg_catalog.obj_description(c.oid,'pg_constraint') is distinct from
          'hajiz:flight-selection-durability:constraint:'||c.conname||':v1'
      ) then raise exception 'table % has a missing or drifted constraint signature',item.name; end if;
    end if;
  end loop;
end
$preflight$;

-- PostgreSQL 17.6 canonical pg_get_constraintdef fingerprints. These values
-- were derived from isolated scratch tables created from the canonical DDL.
do $exact_constraints_preflight$
declare item record; constraint_oid oid; actual_kind "char"; actual_hash text; signature text;
begin
  for item in select * from (values
    ('app_private.flight_search_selections','flight_search_selections_pkey','p','e061295e5a2aca140e0283a20495f6b39bc06ebcdb714ed50d4b265b84a2562b'),
    ('app_private.flight_search_selections','flight_search_selections_alternative_id_check','c','920bddaf8364a890546376e361c46b99e1de3481f16504d052ea1e5d3bae165d'),
    ('app_private.flight_search_selections','flight_search_selections_payload_digest_check','c','f52978615287b1c0249b5cb2c5251a5defbd0890d696c1074c1d5fd29275bfd0'),
    ('app_private.flight_search_selections','flight_search_selections_internal_offer_id_check','c','2bf7488ac04df5ddc2f8cd82cd516db00efdcada002d85416a257e948dfc7c29'),
    ('app_private.flight_search_selections','flight_search_selections_provider_check','c','109a679658abc2b55c6489def778ae27f74a8c766f3daec68959b145b73e35f3'),
    ('app_private.flight_search_selections','flight_search_selections_provider_offer_ref_check','c','6c120b4f1b9141b3aae432424166b7340f62a3d27a6a9d76955c8fd3cd8e2da1'),
    ('app_private.flight_search_selections','flight_search_selections_itinerary_snapshot_check','c','1b6aa85d541e52860c47c3b0ddf72ff21c1cd3a7de5a0ab5efd227be9c346661'),
    ('app_private.flight_search_selections','flight_search_selections_fare_snapshot_check','c','572896018bbbb5211f194e367140664c6f76e86f053d787c949925619a00aea2'),
    ('app_private.flight_search_selections','flight_search_selections_customer_price_snapshot_check','c','a52af7ab318d669b12ed7887d8d43bc5ff45e98dca4ddd31e413217e85c227f7'),
    ('app_private.flight_search_selections','flight_search_selections_passenger_composition_check','c','f105ad85612be3e29b0190bccf4aae7d377da156702475372d8bb1cbd4576dc2'),
    ('app_private.flight_search_selections','flight_search_selections_validity_check','c','ca080a4fca12635bde3cf110b81f65e8689ef1563489ae7287e329d391af6ad7'),
    ('app_private.flight_priced_selections','flight_priced_selections_pkey','p','496dadeae65bc48c8a7827a89585466144a9f8bf0408e9b61a0aa34c11ada282'),
    ('app_private.flight_priced_selections','flight_priced_selections_priced_id_check','c','1c02fd5b5f14d6c473d33650b4c24a5e8ebdf7ac87d03a54aa82da1eead08906'),
    ('app_private.flight_priced_selections','flight_priced_selections_payload_digest_check','c','f52978615287b1c0249b5cb2c5251a5defbd0890d696c1074c1d5fd29275bfd0'),
    ('app_private.flight_priced_selections','flight_priced_selections_alternative_id_check','c','920bddaf8364a890546376e361c46b99e1de3481f16504d052ea1e5d3bae165d'),
    ('app_private.flight_priced_selections','flight_priced_selections_internal_offer_id_check','c','2bf7488ac04df5ddc2f8cd82cd516db00efdcada002d85416a257e948dfc7c29'),
    ('app_private.flight_priced_selections','flight_priced_selections_provider_check','c','109a679658abc2b55c6489def778ae27f74a8c766f3daec68959b145b73e35f3'),
    ('app_private.flight_priced_selections','flight_priced_selections_provider_offer_ref_check','c','6c120b4f1b9141b3aae432424166b7340f62a3d27a6a9d76955c8fd3cd8e2da1'),
    ('app_private.flight_priced_selections','flight_priced_selections_customer_price_snapshot_check','c','e60e6a054d55e6e36beb0da8ec2ae48a50c1e6780084e5aae1d8397c98383aa2'),
    ('app_private.flight_priced_selections','flight_priced_selections_itinerary_snapshot_check','c','1b6aa85d541e52860c47c3b0ddf72ff21c1cd3a7de5a0ab5efd227be9c346661'),
    ('app_private.flight_priced_selections','flight_priced_selections_fare_snapshot_check','c','572896018bbbb5211f194e367140664c6f76e86f053d787c949925619a00aea2'),
    ('app_private.flight_priced_selections','flight_priced_selections_passenger_composition_check','c','f105ad85612be3e29b0190bccf4aae7d377da156702475372d8bb1cbd4576dc2'),
    ('app_private.flight_priced_selections','flight_priced_selections_validity_check','c','ca080a4fca12635bde3cf110b81f65e8689ef1563489ae7287e329d391af6ad7')
  ) as expected(table_name,name,kind,definition_hash) loop
    if pg_catalog.to_regclass(item.table_name) is not null then
      select c.oid,c.contype,
        pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.pg_get_constraintdef(c.oid,false),'UTF8'),'sha256'),'hex'),
        pg_catalog.obj_description(c.oid,'pg_constraint')
        into constraint_oid,actual_kind,actual_hash,signature
        from pg_catalog.pg_constraint c
        where c.conrelid=item.table_name::pg_catalog.regclass and c.conname=item.name;
      if constraint_oid is null or actual_kind::text is distinct from item.kind
         or actual_hash is distinct from item.definition_hash
         or signature is distinct from 'hajiz:flight-selection-durability:constraint:'||item.name||':v1' then
        raise exception 'constraint % on % has non-canonical type, definition, or signature',item.name,item.table_name;
      end if;
    end if;
  end loop;
end
$exact_constraints_preflight$;

-- Validate every existing subordinate object before any mutation. Matching
-- signatures are required, and catalog/body structure is checked separately.
do $drift_preflight$
declare
  item record;
  obj oid;
  signature text;
  actual_definition text;
  actual_roles text[];
  actual_owner oid;
  actual_body_hash text;
  actual_volatility "char";
  actual_return text;
  actual_retset boolean;
  index_exact boolean;
  current_owner oid := (select oid from pg_catalog.pg_roles where rolname=current_user);
begin
  for item in select * from (values
    ('app_private.flight_search_selections_expires_idx','app_private.flight_search_selections','hajiz:flight-selection-durability:search-expiry-index:v1'),
    ('app_private.flight_priced_selections_expires_idx','app_private.flight_priced_selections','hajiz:flight-selection-durability:priced-expiry-index:v1')
  ) as expected(name,table_name,canonical_signature) loop
    obj:=pg_catalog.to_regclass(item.name);
    if obj is not null then
      select pg_catalog.obj_description(i.indexrelid,'pg_class'),
        i.indrelid=item.table_name::pg_catalog.regclass
        and i.indisvalid and i.indisready and i.indislive
        and not i.indisunique and not i.indisprimary and not i.indisreplident
        and not i.indnullsnotdistinct
        and i.indnkeyatts=1 and i.indnatts=1
        and i.indpred is null and i.indexprs is null
        and am.amname='btree' and a.attname='expires_at' and i.indkey[0]=a.attnum
        and i.indoption[0]=0 and i.indcollation[0]=0
        and opc.opcmethod=ic.relam and opc.opcdefault and opc.opcintype=a.atttypid
        and ic.relowner=tc.relowner
        into signature,index_exact
        from pg_catalog.pg_index i
        join pg_catalog.pg_class ic on ic.oid=i.indexrelid
        join pg_catalog.pg_class tc on tc.oid=i.indrelid
        join pg_catalog.pg_am am on am.oid=ic.relam
        join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=i.indkey[0]
        join pg_catalog.pg_opclass opc on opc.oid=i.indclass[0]
        where i.indexrelid=obj;
      if signature is distinct from item.canonical_signature or index_exact is distinct from true then
        raise exception 'expiry index % has non-canonical structure',item.name;
      end if;
    end if;
  end loop;

  for item in select * from (values
    ('app_private.flight_search_selections','flight_search_selections_direct_access_denied','hajiz:flight-selection-durability:search-deny-policy:v1'),
    ('app_private.flight_priced_selections','flight_priced_selections_direct_access_denied','hajiz:flight-selection-durability:priced-deny-policy:v1')
  ) as expected(table_name,name,canonical_signature) loop
    if pg_catalog.to_regclass(item.table_name) is not null
       and exists(select 1 from pg_catalog.pg_policy p where p.polrelid=item.table_name::pg_catalog.regclass and p.polname=item.name) then
      select pg_catalog.obj_description(p.oid,'pg_policy'),
        array(select r.rolname from pg_catalog.unnest(p.polroles) x(role_oid) join pg_catalog.pg_roles r on r.oid=x.role_oid order by r.rolname),
        pg_catalog.pg_get_expr(p.polqual,p.polrelid)||':'||pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)
        into signature,actual_roles,actual_definition from pg_catalog.pg_policy p
        where p.polrelid=item.table_name::pg_catalog.regclass and p.polname=item.name and p.polcmd='*' and p.polpermissive;
      if signature is distinct from item.canonical_signature
         or actual_roles is distinct from array['anon','authenticated']::text[]
         or pg_catalog.regexp_replace(actual_definition,'[()[:space:]]','','g') <> 'false:false' then
        raise exception 'deny policy % has non-canonical structure',item.name;
      end if;
    end if;
  end loop;

  for item in select * from (values
    ('public.remember_flight_search_selections_v1(jsonb)','hajiz:flight-selection-durability:remember-search-rpc:v1','66db8708fdd0f890d085a06e405dac9cb7722647b274aef8d3703e5fd9cfb42a','v','TABLE(alternative_id text, replayed boolean)'),
    ('public.get_flight_search_selection_v1(text)','hajiz:flight-selection-durability:get-search-rpc:v1','1cfb9d4fac9c497e45ebe4913dc4176cfe0514b39b5a4f0fe2f2dbdd8cf614d0','s','TABLE(alternative_id text, internal_offer_id text, provider text, provider_offer_ref text, itinerary_snapshot jsonb, fare_snapshot jsonb, previous_customer_price_snapshot jsonb, passenger_composition jsonb, expires_at timestamp with time zone, payload_digest text)'),
    ('public.create_or_get_flight_priced_selection_v1(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)','hajiz:flight-selection-durability:create-priced-rpc:v1','282c1249556a54a1c7fc762938e6898c6d448d124a0b485c2c29deebafe9d842','v','TABLE(priced_selection_id text, replayed boolean)'),
    ('public.get_flight_priced_selection_v1(text)','hajiz:flight-selection-durability:get-priced-rpc:v1','1b0f98407d1975fd650a93b6f02dd7112da417b33d461eb2bd4278db99ba0c01','s','TABLE(priced_selection_id text, alternative_id text, internal_offer_id text, provider text, provider_offer_ref text, customer_price_snapshot jsonb, itinerary_snapshot jsonb, fare_snapshot jsonb, passenger_composition jsonb, expires_at timestamp with time zone, payload_digest text)')
  ) as expected(name,canonical_signature,body_hash,volatility,result_contract) loop
    obj:=pg_catalog.to_regprocedure(item.name);
    if obj is not null then
      select p.proowner,pg_catalog.obj_description(p.oid,'pg_proc'),
        pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p.prosrc,'UTF8'),'sha256'),'hex'),
        p.provolatile,pg_catalog.pg_get_function_result(p.oid),p.proretset
        into actual_owner,signature,actual_body_hash,actual_volatility,actual_return,actual_retset
        from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid=p.prolang
        where p.oid=obj and l.lanname='plpgsql' and p.prokind='f' and p.prosecdef
          and p.proconfig=array['search_path=']::text[];
      if actual_owner is distinct from current_owner or signature is distinct from item.canonical_signature
         or actual_body_hash is distinct from item.body_hash
         or actual_volatility::text is distinct from item.volatility
         or actual_return is distinct from item.result_contract
         or actual_retset is distinct from true then
        raise exception 'RPC % has non-canonical metadata or body',item.name;
      end if;
    end if;
  end loop;
end
$drift_preflight$;

do $migration$
begin
  if pg_catalog.to_regclass('app_private.flight_search_selections') is null then
    execute $ddl$create table app_private.flight_search_selections (
  alternative_id text not null,
  payload_digest text not null,
  internal_offer_id text not null,
  provider text not null,
  provider_offer_ref text not null,
  itinerary_snapshot jsonb not null,
  fare_snapshot jsonb not null,
  previous_customer_price_snapshot jsonb not null,
  passenger_composition jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint flight_search_selections_pkey primary key (alternative_id),
  constraint flight_search_selections_alternative_id_check
    check (alternative_id ~ '^hca_v2_[0-9a-f]{32}$'),
  constraint flight_search_selections_payload_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint flight_search_selections_internal_offer_id_check
    check (pg_catalog.char_length(internal_offer_id) between 1 and 255),
  constraint flight_search_selections_provider_check
    check (provider ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint flight_search_selections_provider_offer_ref_check
    check (pg_catalog.char_length(provider_offer_ref) between 1 and 512),
  constraint flight_search_selections_itinerary_snapshot_check
    check (pg_catalog.jsonb_typeof(itinerary_snapshot) = 'object' and pg_catalog.octet_length(itinerary_snapshot::text) <= 16384),
  constraint flight_search_selections_fare_snapshot_check
    check (pg_catalog.jsonb_typeof(fare_snapshot) = 'object' and pg_catalog.octet_length(fare_snapshot::text) <= 8192),
  constraint flight_search_selections_customer_price_snapshot_check
    check (
      pg_catalog.jsonb_typeof(previous_customer_price_snapshot) = 'object'
      and pg_catalog.octet_length(previous_customer_price_snapshot::text) <= 4096
      and previous_customer_price_snapshot ?& array['amount','currency','validUntil']
      and previous_customer_price_snapshot - array['amount','currency','validUntil'] = '{}'::jsonb
      and pg_catalog.jsonb_typeof(previous_customer_price_snapshot->'amount') = 'string'
      and pg_catalog.char_length(previous_customer_price_snapshot->>'amount') <= 40
      and previous_customer_price_snapshot->>'amount' ~ '^(0|[1-9][0-9]*)(\.[0-9]{1,8})?$'
      and (previous_customer_price_snapshot->>'amount')::numeric > 0
      and pg_catalog.jsonb_typeof(previous_customer_price_snapshot->'currency') = 'string'
      and previous_customer_price_snapshot->>'currency' in ('USD','AED','SDG')
      and pg_catalog.jsonb_typeof(previous_customer_price_snapshot->'validUntil') = 'string'
      and previous_customer_price_snapshot->>'validUntil' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
      and (previous_customer_price_snapshot->>'validUntil')::timestamptz > created_at
      and expires_at <= (previous_customer_price_snapshot->>'validUntil')::timestamptz
    ),
  constraint flight_search_selections_passenger_composition_check
    check (
      pg_catalog.jsonb_typeof(passenger_composition) = 'object'
      and pg_catalog.octet_length(passenger_composition::text) <= 1024
      and passenger_composition ?& array['ADT','CHD','INF']
      and passenger_composition - array['ADT','CHD','INF'] = '{}'::jsonb
      and pg_catalog.jsonb_typeof(passenger_composition->'ADT') = 'number'
      and pg_catalog.jsonb_typeof(passenger_composition->'CHD') = 'number'
      and pg_catalog.jsonb_typeof(passenger_composition->'INF') = 'number'
      and passenger_composition->>'ADT' ~ '^(0|[1-9][0-9]*)$'
      and (passenger_composition->>'ADT')::numeric >= 1
      and passenger_composition->>'CHD' ~ '^(0|[1-9][0-9]*)$'
      and passenger_composition->>'INF' ~ '^(0|[1-9][0-9]*)$'
    ),
  constraint flight_search_selections_validity_check check (expires_at > created_at)
);

comment on table app_private.flight_search_selections is
  'hajiz:flight-selection-durability:search-table:v1';$ddl$;
  end if;
end
$migration$;

do $migration$
begin
  if pg_catalog.to_regclass('app_private.flight_search_selections_expires_idx') is null then
    execute $ddl$create index flight_search_selections_expires_idx
  on app_private.flight_search_selections (expires_at);
comment on index app_private.flight_search_selections_expires_idx is
  'hajiz:flight-selection-durability:search-expiry-index:v1'$ddl$;
  end if;
end
$migration$;

do $migration$
begin
  if pg_catalog.to_regclass('app_private.flight_priced_selections') is null then
    execute $ddl$create table app_private.flight_priced_selections (
  priced_selection_id text not null,
  payload_digest text not null,
  alternative_id text not null,
  internal_offer_id text not null,
  provider text not null,
  provider_offer_ref text not null,
  customer_price_snapshot jsonb not null,
  itinerary_snapshot jsonb not null,
  fare_snapshot jsonb not null,
  passenger_composition jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint flight_priced_selections_pkey primary key (priced_selection_id),
  constraint flight_priced_selections_priced_id_check
    check (priced_selection_id ~ '^hpr_v1_[0-9a-f]{40}$'),
  constraint flight_priced_selections_payload_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint flight_priced_selections_alternative_id_check
    check (alternative_id ~ '^hca_v2_[0-9a-f]{32}$'),
  constraint flight_priced_selections_internal_offer_id_check
    check (pg_catalog.char_length(internal_offer_id) between 1 and 255),
  constraint flight_priced_selections_provider_check
    check (provider ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint flight_priced_selections_provider_offer_ref_check
    check (pg_catalog.char_length(provider_offer_ref) between 1 and 512),
  constraint flight_priced_selections_customer_price_snapshot_check
    check (
      pg_catalog.jsonb_typeof(customer_price_snapshot) = 'object'
      and pg_catalog.octet_length(customer_price_snapshot::text) <= 4096
      and customer_price_snapshot ?& array['amount','currency','validUntil']
      and customer_price_snapshot - array['amount','currency','validUntil'] = '{}'::jsonb
      and pg_catalog.jsonb_typeof(customer_price_snapshot->'amount') = 'string'
      and pg_catalog.char_length(customer_price_snapshot->>'amount') <= 40
      and customer_price_snapshot->>'amount' ~ '^(0|[1-9][0-9]*)(\.[0-9]{1,8})?$'
      and (customer_price_snapshot->>'amount')::numeric > 0
      and pg_catalog.jsonb_typeof(customer_price_snapshot->'currency') = 'string'
      and customer_price_snapshot->>'currency' in ('USD','AED','SDG')
      and pg_catalog.jsonb_typeof(customer_price_snapshot->'validUntil') = 'string'
      and customer_price_snapshot->>'validUntil' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
      and (customer_price_snapshot->>'validUntil')::timestamptz > created_at
      and expires_at = (customer_price_snapshot->>'validUntil')::timestamptz
    ),
  constraint flight_priced_selections_itinerary_snapshot_check
    check (pg_catalog.jsonb_typeof(itinerary_snapshot) = 'object' and pg_catalog.octet_length(itinerary_snapshot::text) <= 16384),
  constraint flight_priced_selections_fare_snapshot_check
    check (pg_catalog.jsonb_typeof(fare_snapshot) = 'object' and pg_catalog.octet_length(fare_snapshot::text) <= 8192),
  constraint flight_priced_selections_passenger_composition_check
    check (
      pg_catalog.jsonb_typeof(passenger_composition) = 'object'
      and pg_catalog.octet_length(passenger_composition::text) <= 1024
      and passenger_composition ?& array['ADT','CHD','INF']
      and passenger_composition - array['ADT','CHD','INF'] = '{}'::jsonb
      and pg_catalog.jsonb_typeof(passenger_composition->'ADT') = 'number'
      and pg_catalog.jsonb_typeof(passenger_composition->'CHD') = 'number'
      and pg_catalog.jsonb_typeof(passenger_composition->'INF') = 'number'
      and passenger_composition->>'ADT' ~ '^(0|[1-9][0-9]*)$'
      and (passenger_composition->>'ADT')::numeric >= 1
      and passenger_composition->>'CHD' ~ '^(0|[1-9][0-9]*)$'
      and passenger_composition->>'INF' ~ '^(0|[1-9][0-9]*)$'
    ),
  constraint flight_priced_selections_validity_check check (expires_at > created_at)
);

comment on table app_private.flight_priced_selections is
  'hajiz:flight-selection-durability:priced-table:v1';$ddl$;
  end if;
end
$migration$;

do $migration$
begin
  if pg_catalog.to_regclass('app_private.flight_priced_selections_expires_idx') is null then
    execute $ddl$create index flight_priced_selections_expires_idx
  on app_private.flight_priced_selections (expires_at);
comment on index app_private.flight_priced_selections_expires_idx is
  'hajiz:flight-selection-durability:priced-expiry-index:v1'$ddl$;
  end if;
end
$migration$;


-- Stable signatures are necessary but never sufficient: structural checks follow below.
do $signatures$
declare item record; target pg_catalog.regclass; existing text;
begin
  for item in select * from (values
    ('flight_search_selections_pkey','app_private.flight_search_selections'),
    ('flight_search_selections_alternative_id_check','app_private.flight_search_selections'),
    ('flight_search_selections_payload_digest_check','app_private.flight_search_selections'),
    ('flight_search_selections_internal_offer_id_check','app_private.flight_search_selections'),
    ('flight_search_selections_provider_check','app_private.flight_search_selections'),
    ('flight_search_selections_provider_offer_ref_check','app_private.flight_search_selections'),
    ('flight_search_selections_itinerary_snapshot_check','app_private.flight_search_selections'),
    ('flight_search_selections_fare_snapshot_check','app_private.flight_search_selections'),
    ('flight_search_selections_customer_price_snapshot_check','app_private.flight_search_selections'),
    ('flight_search_selections_passenger_composition_check','app_private.flight_search_selections'),
    ('flight_search_selections_validity_check','app_private.flight_search_selections'),
    ('flight_priced_selections_pkey','app_private.flight_priced_selections'),
    ('flight_priced_selections_priced_id_check','app_private.flight_priced_selections'),
    ('flight_priced_selections_payload_digest_check','app_private.flight_priced_selections'),
    ('flight_priced_selections_alternative_id_check','app_private.flight_priced_selections'),
    ('flight_priced_selections_internal_offer_id_check','app_private.flight_priced_selections'),
    ('flight_priced_selections_provider_check','app_private.flight_priced_selections'),
    ('flight_priced_selections_provider_offer_ref_check','app_private.flight_priced_selections'),
    ('flight_priced_selections_customer_price_snapshot_check','app_private.flight_priced_selections'),
    ('flight_priced_selections_itinerary_snapshot_check','app_private.flight_priced_selections'),
    ('flight_priced_selections_fare_snapshot_check','app_private.flight_priced_selections'),
    ('flight_priced_selections_passenger_composition_check','app_private.flight_priced_selections'),
    ('flight_priced_selections_validity_check','app_private.flight_priced_selections')
  ) as expected(name,table_name) loop
    target:=item.table_name::pg_catalog.regclass;
    select pg_catalog.obj_description(c.oid,'pg_constraint') into existing from pg_catalog.pg_constraint c where c.conrelid=target and c.conname=item.name;
    if existing is null then execute pg_catalog.format('comment on constraint %I on %s is %L',item.name,item.table_name,'hajiz:flight-selection-durability:constraint:'||item.name||':v1');
    elsif existing is distinct from 'hajiz:flight-selection-durability:constraint:'||item.name||':v1' then raise exception 'constraint % has non-canonical signature',item.name; end if;
  end loop;
end
$signatures$;
alter table app_private.flight_search_selections enable row level security;
alter table app_private.flight_search_selections no force row level security;
alter table app_private.flight_priced_selections enable row level security;
alter table app_private.flight_priced_selections no force row level security;

do $migration$
begin
  if not exists (select 1 from pg_catalog.pg_policy where polrelid='app_private.flight_search_selections'::pg_catalog.regclass and polname='flight_search_selections_direct_access_denied') then
    execute $ddl$create policy flight_search_selections_direct_access_denied
  on app_private.flight_search_selections for all to anon, authenticated
  using (false) with check (false);
comment on policy flight_search_selections_direct_access_denied
  on app_private.flight_search_selections is
  'hajiz:flight-selection-durability:search-deny-policy:v1'$ddl$;
  end if;
end
$migration$;

do $migration$
begin
  if not exists (select 1 from pg_catalog.pg_policy where polrelid='app_private.flight_priced_selections'::pg_catalog.regclass and polname='flight_priced_selections_direct_access_denied') then
    execute $ddl$create policy flight_priced_selections_direct_access_denied
  on app_private.flight_priced_selections for all to anon, authenticated
  using (false) with check (false);
comment on policy flight_priced_selections_direct_access_denied
  on app_private.flight_priced_selections is
  'hajiz:flight-selection-durability:priced-deny-policy:v1'$ddl$;
  end if;
end
$migration$;

revoke all on table app_private.flight_search_selections
  from public, anon, authenticated, service_role;
revoke all on table app_private.flight_priced_selections
  from public, anon, authenticated, service_role;

do $migration$
begin
  if pg_catalog.to_regprocedure('public.remember_flight_search_selections_v1(jsonb)') is null then
    execute $ddl$create function public.remember_flight_search_selections_v1(p_batch jsonb)
returns table(alternative_id text, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item jsonb;
  v_id text;
  v_internal_offer_id text;
  v_provider text;
  v_provider_offer_ref text;
  v_itinerary jsonb;
  v_fare jsonb;
  v_price jsonb;
  v_passengers jsonb;
  v_expires_at timestamptz;
  v_digest text;
  v_existing_digest text;
  v_inserted boolean;
begin
  if p_batch is null
     or pg_catalog.jsonb_typeof(p_batch) <> 'array'
     or pg_catalog.jsonb_array_length(p_batch) < 1
     or pg_catalog.jsonb_array_length(p_batch) > 500 then
    raise exception 'invalid search selection batch' using errcode = 'FSD10';
  end if;

  -- Stable ordering prevents competing batches from taking row locks in
  -- contradictory order. Any exception rolls back the complete RPC statement.
  for v_item in
    select item
    from pg_catalog.jsonb_array_elements(p_batch) as batch(item)
    order by item->>'alternativeId'
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object'
       or not (v_item ?& array['alternativeId','internalOfferId','provider','providerOfferRef','itinerary','fare','previousCustomerPrice','passengerComposition','expiresAt'])
       or v_item - array['alternativeId','internalOfferId','provider','providerOfferRef','itinerary','fare','previousCustomerPrice','passengerComposition','expiresAt'] <> '{}'::jsonb then
      raise exception 'invalid search selection entry' using errcode = 'FSD11';
    end if;

    v_id := v_item->>'alternativeId';
    v_internal_offer_id := v_item->>'internalOfferId';
    v_provider := v_item->>'provider';
    v_provider_offer_ref := v_item->>'providerOfferRef';
    v_itinerary := v_item->'itinerary';
    v_fare := v_item->'fare';
    v_price := v_item->'previousCustomerPrice';
    v_passengers := v_item->'passengerComposition';

    if pg_catalog.jsonb_typeof(v_item->'expiresAt') <> 'string'
       or v_item->>'expiresAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
      raise exception 'invalid search selection expiry' using errcode = 'FSD11';
    end if;
    if not pg_catalog.pg_input_is_valid(v_item->>'expiresAt', 'timestamptz') then
      raise exception 'invalid search selection expiry' using errcode = 'FSD11';
    end if;
    v_expires_at := (v_item->>'expiresAt')::timestamptz;

    if pg_catalog.jsonb_typeof(v_price) <> 'object'
       or not (v_price ?& array['amount','currency','validUntil'])
       or v_price - array['amount','currency','validUntil'] <> '{}'::jsonb
       or pg_catalog.jsonb_typeof(v_price->'amount') <> 'string'
       or pg_catalog.char_length(v_price->>'amount') > 40
       or v_price->>'amount' !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,8})?$'
       or pg_catalog.jsonb_typeof(v_price->'currency') <> 'string'
       or v_price->>'currency' not in ('USD','AED','SDG')
       or pg_catalog.jsonb_typeof(v_price->'validUntil') <> 'string'
       or v_price->>'validUntil' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
      raise exception 'invalid search customer price' using errcode = 'FSD11';
    end if;
    if (v_price->>'amount')::numeric <= 0
       or not pg_catalog.pg_input_is_valid(v_price->>'validUntil', 'timestamptz') then
      raise exception 'invalid search customer price' using errcode = 'FSD11';
    end if;

    if v_expires_at is null
       or v_expires_at <= pg_catalog.transaction_timestamp()
       or (v_price->>'validUntil')::timestamptz <= pg_catalog.transaction_timestamp()
       or v_expires_at > (v_price->>'validUntil')::timestamptz then
      raise exception 'search selection is expired' using errcode = 'FSD02';
    end if;

    v_digest := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        'flight-search-selection-payload/v1', v_id, v_internal_offer_id,
        v_provider, v_provider_offer_ref, v_itinerary, v_fare, v_price,
        v_passengers, pg_catalog.to_char(v_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      )::text, 'UTF8'), 'sha256'), 'hex');

    insert into app_private.flight_search_selections(
      alternative_id, payload_digest, internal_offer_id, provider,
      provider_offer_ref, itinerary_snapshot, fare_snapshot,
      previous_customer_price_snapshot, passenger_composition, expires_at
    ) values (
      v_id, v_digest, v_internal_offer_id, v_provider, v_provider_offer_ref,
      v_itinerary, v_fare, v_price, v_passengers, v_expires_at
    ) on conflict (alternative_id) do nothing
    returning true into v_inserted;

    if not pg_catalog.coalesce(v_inserted, false) then
      select row.payload_digest into strict v_existing_digest
      from app_private.flight_search_selections as row
      where row.alternative_id = v_id
      for share;
      if v_existing_digest is distinct from v_digest then
        raise exception 'search selection identity conflict' using errcode = 'FSD04';
      end if;
    end if;

    alternative_id := v_id;
    replayed := not pg_catalog.coalesce(v_inserted, false);
    return next;
    v_inserted := false;
  end loop;
end
$function$;

comment on function public.remember_flight_search_selections_v1(jsonb) is
  'hajiz:flight-selection-durability:remember-search-rpc:v1'$ddl$;
  end if;
end
$migration$;

do $migration$
begin
  if pg_catalog.to_regprocedure('public.get_flight_search_selection_v1(text)') is null then
    execute $ddl$create function public.get_flight_search_selection_v1(p_alternative_id text)
returns table(
  alternative_id text, internal_offer_id text, provider text,
  provider_offer_ref text, itinerary_snapshot jsonb, fare_snapshot jsonb,
  previous_customer_price_snapshot jsonb, passenger_composition jsonb,
  expires_at timestamptz, payload_digest text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_row app_private.flight_search_selections%rowtype;
begin
  if p_alternative_id !~ '^hca_v2_[0-9a-f]{32}$' then
    raise exception 'search selection not found' using errcode = 'FSD01';
  end if;
  select row.* into v_row
  from app_private.flight_search_selections as row
  where row.alternative_id = p_alternative_id;
  if not found then raise exception 'search selection not found' using errcode = 'FSD01'; end if;
  if v_row.expires_at <= pg_catalog.transaction_timestamp() then
    raise exception 'search selection expired' using errcode = 'FSD02';
  end if;
  return query select v_row.alternative_id, v_row.internal_offer_id, v_row.provider,
    v_row.provider_offer_ref, v_row.itinerary_snapshot, v_row.fare_snapshot,
    v_row.previous_customer_price_snapshot, v_row.passenger_composition,
    v_row.expires_at, v_row.payload_digest;
end
$function$;

comment on function public.get_flight_search_selection_v1(text) is
  'hajiz:flight-selection-durability:get-search-rpc:v1'$ddl$;
  end if;
end
$migration$;

do $migration$
begin
  if pg_catalog.to_regprocedure('public.create_or_get_flight_priced_selection_v1(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)') is null then
    execute $ddl$create function public.create_or_get_flight_priced_selection_v1(
  p_priced_selection_id text,
  p_alternative_id text,
  p_internal_offer_id text,
  p_provider text,
  p_provider_offer_ref text,
  p_customer_price_snapshot jsonb,
  p_itinerary_snapshot jsonb,
  p_fare_snapshot jsonb,
  p_passenger_composition jsonb,
  p_expires_at timestamptz
)
returns table(priced_selection_id text, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_digest text;
  v_existing_digest text;
  v_inserted boolean;
begin
  if p_expires_at is null then
    raise exception 'invalid priced selection expiry' using errcode = 'FSD11';
  end if;
  if p_customer_price_snapshot is null
     or pg_catalog.jsonb_typeof(p_customer_price_snapshot) <> 'object'
     or not (p_customer_price_snapshot ?& array['amount','currency','validUntil'])
     or p_customer_price_snapshot - array['amount','currency','validUntil'] <> '{}'::jsonb
     or pg_catalog.jsonb_typeof(p_customer_price_snapshot->'amount') <> 'string'
     or pg_catalog.char_length(p_customer_price_snapshot->>'amount') > 40
     or p_customer_price_snapshot->>'amount' !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,8})?$'
     or pg_catalog.jsonb_typeof(p_customer_price_snapshot->'currency') <> 'string'
     or p_customer_price_snapshot->>'currency' not in ('USD','AED','SDG')
     or pg_catalog.jsonb_typeof(p_customer_price_snapshot->'validUntil') <> 'string'
     or p_customer_price_snapshot->>'validUntil' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'invalid priced customer price' using errcode = 'FSD11';
  end if;
  if (p_customer_price_snapshot->>'amount')::numeric <= 0
     or not pg_catalog.pg_input_is_valid(p_customer_price_snapshot->>'validUntil', 'timestamptz') then
    raise exception 'invalid priced customer price' using errcode = 'FSD11';
  end if;
  if p_expires_at <= pg_catalog.transaction_timestamp()
     or (p_customer_price_snapshot->>'validUntil')::timestamptz <= pg_catalog.transaction_timestamp() then
    raise exception 'priced selection is expired' using errcode = 'FSD02';
  end if;
  if p_expires_at <> (p_customer_price_snapshot->>'validUntil')::timestamptz then
    raise exception 'priced selection expiry mismatch' using errcode = 'FSD11';
  end if;

  v_digest := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(
      'flight-priced-selection-payload/v1', p_priced_selection_id,
      p_alternative_id, p_internal_offer_id, p_provider, p_provider_offer_ref,
      p_customer_price_snapshot, p_itinerary_snapshot, p_fare_snapshot,
      p_passenger_composition,
      pg_catalog.to_char(p_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    )::text, 'UTF8'), 'sha256'), 'hex');

  insert into app_private.flight_priced_selections(
    priced_selection_id, payload_digest, alternative_id, internal_offer_id,
    provider, provider_offer_ref, customer_price_snapshot, itinerary_snapshot,
    fare_snapshot, passenger_composition, expires_at
  ) values (
    p_priced_selection_id, v_digest, p_alternative_id, p_internal_offer_id,
    p_provider, p_provider_offer_ref, p_customer_price_snapshot,
    p_itinerary_snapshot, p_fare_snapshot, p_passenger_composition, p_expires_at
  ) on conflict (priced_selection_id) do nothing
  returning true into v_inserted;

  if not pg_catalog.coalesce(v_inserted, false) then
    select row.payload_digest into strict v_existing_digest
    from app_private.flight_priced_selections as row
    where row.priced_selection_id = p_priced_selection_id
    for share;
    if v_existing_digest is distinct from v_digest then
      raise exception 'priced selection identity conflict' using errcode = 'FSD04';
    end if;
  end if;

  priced_selection_id := p_priced_selection_id;
  replayed := not pg_catalog.coalesce(v_inserted, false);
  return next;
end
$function$;

comment on function public.create_or_get_flight_priced_selection_v1(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz) is
  'hajiz:flight-selection-durability:create-priced-rpc:v1'$ddl$;
  end if;
end
$migration$;

do $migration$
begin
  if pg_catalog.to_regprocedure('public.get_flight_priced_selection_v1(text)') is null then
    execute $ddl$create function public.get_flight_priced_selection_v1(p_priced_selection_id text)
returns table(
  priced_selection_id text, alternative_id text, internal_offer_id text,
  provider text, provider_offer_ref text, customer_price_snapshot jsonb,
  itinerary_snapshot jsonb, fare_snapshot jsonb, passenger_composition jsonb,
  expires_at timestamptz, payload_digest text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_row app_private.flight_priced_selections%rowtype;
begin
  if p_priced_selection_id !~ '^hpr_v1_[0-9a-f]{40}$' then
    raise exception 'priced selection not found' using errcode = 'FSD01';
  end if;
  select row.* into v_row
  from app_private.flight_priced_selections as row
  where row.priced_selection_id = p_priced_selection_id;
  if not found then raise exception 'priced selection not found' using errcode = 'FSD01'; end if;
  if v_row.expires_at <= pg_catalog.transaction_timestamp() then
    raise exception 'priced selection expired' using errcode = 'FSD02';
  end if;
  return query select v_row.priced_selection_id, v_row.alternative_id,
    v_row.internal_offer_id, v_row.provider, v_row.provider_offer_ref,
    v_row.customer_price_snapshot, v_row.itinerary_snapshot,
    v_row.fare_snapshot, v_row.passenger_composition, v_row.expires_at,
    v_row.payload_digest;
end
$function$;

comment on function public.get_flight_priced_selection_v1(text) is
  'hajiz:flight-selection-durability:get-priced-rpc:v1'$ddl$;
  end if;
end
$migration$;

revoke all on function public.remember_flight_search_selections_v1(jsonb)
  from public, anon, authenticated;
revoke all on function public.get_flight_search_selection_v1(text)
  from public, anon, authenticated;
revoke all on function public.create_or_get_flight_priced_selection_v1(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_flight_priced_selection_v1(text)
  from public, anon, authenticated;

grant execute on function public.remember_flight_search_selections_v1(jsonb)
  to service_role;
grant execute on function public.get_flight_search_selection_v1(text)
  to service_role;
grant execute on function public.create_or_get_flight_priced_selection_v1(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)
  to service_role;
grant execute on function public.get_flight_priced_selection_v1(text)
  to service_role;

-- Same-owner behavior is mandatory because these functions intentionally use
-- SECURITY DEFINER to cross private-table RLS without direct service_role grants.
do $owner_guard$
declare
  v_owner oid;
  v_other_owner oid;
  item text;
begin
  select relowner into strict v_owner
  from pg_catalog.pg_class
  where oid = 'app_private.flight_search_selections'::regclass;

  select relowner into strict v_other_owner
  from pg_catalog.pg_class
  where oid = 'app_private.flight_priced_selections'::regclass;
  if v_other_owner is distinct from v_owner then
    raise exception 'private selection tables must share one owner';
  end if;

  foreach item in array array[
    'public.remember_flight_search_selections_v1(jsonb)',
    'public.get_flight_search_selection_v1(text)',
    'public.create_or_get_flight_priced_selection_v1(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)',
    'public.get_flight_priced_selection_v1(text)'
  ] loop
    select proowner into strict v_other_owner
    from pg_catalog.pg_proc where oid = item::regprocedure;
    if v_other_owner is distinct from v_owner then
      raise exception 'RPC and private tables must share one owner: %', item;
    end if;
  end loop;
end
$owner_guard$;


-- Strong replay/drift validation for indexes, policies, constraints, RPC metadata/body and common ownership.
do $postflight$
declare
  item record; obj oid; signature text; owner_oid oid; common_owner oid; actual_body_hash text; actual_roles text[]; actual_def text;
  constraint_oid oid; actual_kind "char"; actual_hash text;
  actual_volatility "char"; actual_return text; actual_retset boolean; index_exact boolean;
begin
  select relowner into common_owner from pg_catalog.pg_class where oid='app_private.flight_search_selections'::pg_catalog.regclass;
  if common_owner is distinct from (select relowner from pg_catalog.pg_class where oid='app_private.flight_priced_selections'::pg_catalog.regclass) then raise exception 'table owner drift'; end if;
  for item in select * from (values
    ('app_private.flight_search_selections','flight_search_selections_pkey','p','e061295e5a2aca140e0283a20495f6b39bc06ebcdb714ed50d4b265b84a2562b'),
    ('app_private.flight_search_selections','flight_search_selections_alternative_id_check','c','920bddaf8364a890546376e361c46b99e1de3481f16504d052ea1e5d3bae165d'),
    ('app_private.flight_search_selections','flight_search_selections_payload_digest_check','c','f52978615287b1c0249b5cb2c5251a5defbd0890d696c1074c1d5fd29275bfd0'),
    ('app_private.flight_search_selections','flight_search_selections_internal_offer_id_check','c','2bf7488ac04df5ddc2f8cd82cd516db00efdcada002d85416a257e948dfc7c29'),
    ('app_private.flight_search_selections','flight_search_selections_provider_check','c','109a679658abc2b55c6489def778ae27f74a8c766f3daec68959b145b73e35f3'),
    ('app_private.flight_search_selections','flight_search_selections_provider_offer_ref_check','c','6c120b4f1b9141b3aae432424166b7340f62a3d27a6a9d76955c8fd3cd8e2da1'),
    ('app_private.flight_search_selections','flight_search_selections_itinerary_snapshot_check','c','1b6aa85d541e52860c47c3b0ddf72ff21c1cd3a7de5a0ab5efd227be9c346661'),
    ('app_private.flight_search_selections','flight_search_selections_fare_snapshot_check','c','572896018bbbb5211f194e367140664c6f76e86f053d787c949925619a00aea2'),
    ('app_private.flight_search_selections','flight_search_selections_customer_price_snapshot_check','c','a52af7ab318d669b12ed7887d8d43bc5ff45e98dca4ddd31e413217e85c227f7'),
    ('app_private.flight_search_selections','flight_search_selections_passenger_composition_check','c','f105ad85612be3e29b0190bccf4aae7d377da156702475372d8bb1cbd4576dc2'),
    ('app_private.flight_search_selections','flight_search_selections_validity_check','c','ca080a4fca12635bde3cf110b81f65e8689ef1563489ae7287e329d391af6ad7'),
    ('app_private.flight_priced_selections','flight_priced_selections_pkey','p','496dadeae65bc48c8a7827a89585466144a9f8bf0408e9b61a0aa34c11ada282'),
    ('app_private.flight_priced_selections','flight_priced_selections_priced_id_check','c','1c02fd5b5f14d6c473d33650b4c24a5e8ebdf7ac87d03a54aa82da1eead08906'),
    ('app_private.flight_priced_selections','flight_priced_selections_payload_digest_check','c','f52978615287b1c0249b5cb2c5251a5defbd0890d696c1074c1d5fd29275bfd0'),
    ('app_private.flight_priced_selections','flight_priced_selections_alternative_id_check','c','920bddaf8364a890546376e361c46b99e1de3481f16504d052ea1e5d3bae165d'),
    ('app_private.flight_priced_selections','flight_priced_selections_internal_offer_id_check','c','2bf7488ac04df5ddc2f8cd82cd516db00efdcada002d85416a257e948dfc7c29'),
    ('app_private.flight_priced_selections','flight_priced_selections_provider_check','c','109a679658abc2b55c6489def778ae27f74a8c766f3daec68959b145b73e35f3'),
    ('app_private.flight_priced_selections','flight_priced_selections_provider_offer_ref_check','c','6c120b4f1b9141b3aae432424166b7340f62a3d27a6a9d76955c8fd3cd8e2da1'),
    ('app_private.flight_priced_selections','flight_priced_selections_customer_price_snapshot_check','c','e60e6a054d55e6e36beb0da8ec2ae48a50c1e6780084e5aae1d8397c98383aa2'),
    ('app_private.flight_priced_selections','flight_priced_selections_itinerary_snapshot_check','c','1b6aa85d541e52860c47c3b0ddf72ff21c1cd3a7de5a0ab5efd227be9c346661'),
    ('app_private.flight_priced_selections','flight_priced_selections_fare_snapshot_check','c','572896018bbbb5211f194e367140664c6f76e86f053d787c949925619a00aea2'),
    ('app_private.flight_priced_selections','flight_priced_selections_passenger_composition_check','c','f105ad85612be3e29b0190bccf4aae7d377da156702475372d8bb1cbd4576dc2'),
    ('app_private.flight_priced_selections','flight_priced_selections_validity_check','c','ca080a4fca12635bde3cf110b81f65e8689ef1563489ae7287e329d391af6ad7')
  ) as expected(table_name,name,kind,definition_hash) loop
    select c.oid,c.contype,
      pg_catalog.encode(extensions.digest(pg_catalog.convert_to(pg_catalog.pg_get_constraintdef(c.oid,false),'UTF8'),'sha256'),'hex'),
      pg_catalog.obj_description(c.oid,'pg_constraint')
      into constraint_oid,actual_kind,actual_hash,signature
      from pg_catalog.pg_constraint c
      where c.conrelid=item.table_name::pg_catalog.regclass and c.conname=item.name;
    if constraint_oid is null or actual_kind::text is distinct from item.kind
       or actual_hash is distinct from item.definition_hash
       or signature is distinct from 'hajiz:flight-selection-durability:constraint:'||item.name||':v1' then
      raise exception 'constraint % on % has non-canonical type, definition, or signature',item.name,item.table_name;
    end if;
  end loop;
  for item in select * from (values
    ('app_private.flight_search_selections_expires_idx','app_private.flight_search_selections','hajiz:flight-selection-durability:search-expiry-index:v1'),
    ('app_private.flight_priced_selections_expires_idx','app_private.flight_priced_selections','hajiz:flight-selection-durability:priced-expiry-index:v1')
  ) as expected(name,table_name,canonical_signature) loop
    obj:=pg_catalog.to_regclass(item.name);
    select pg_catalog.obj_description(i.indexrelid,'pg_class'),
      i.indrelid=item.table_name::pg_catalog.regclass
      and i.indisvalid and i.indisready and i.indislive
      and not i.indisunique and not i.indisprimary and not i.indisreplident
      and not i.indnullsnotdistinct
      and i.indnkeyatts=1 and i.indnatts=1
      and i.indpred is null and i.indexprs is null
      and am.amname='btree' and a.attname='expires_at' and i.indkey[0]=a.attnum
      and i.indoption[0]=0 and i.indcollation[0]=0
      and opc.opcmethod=ic.relam and opc.opcdefault and opc.opcintype=a.atttypid
      and ic.relowner=tc.relowner
      into signature,index_exact
      from pg_catalog.pg_index i
      join pg_catalog.pg_class ic on ic.oid=i.indexrelid
      join pg_catalog.pg_class tc on tc.oid=i.indrelid
      join pg_catalog.pg_am am on am.oid=ic.relam
      join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=i.indkey[0]
      join pg_catalog.pg_opclass opc on opc.oid=i.indclass[0]
      where i.indexrelid=obj;
    if signature is distinct from item.canonical_signature or index_exact is distinct from true then raise exception 'expiry index % drift',item.name; end if;
  end loop;
  for item in select * from (values
    ('app_private.flight_search_selections','flight_search_selections_direct_access_denied','hajiz:flight-selection-durability:search-deny-policy:v1'),
    ('app_private.flight_priced_selections','flight_priced_selections_direct_access_denied','hajiz:flight-selection-durability:priced-deny-policy:v1')
  ) as expected(table_name,name,canonical_signature) loop
    select pg_catalog.obj_description(p.oid,'pg_policy'),array(select r.rolname from pg_catalog.unnest(p.polroles) x(role_oid) join pg_catalog.pg_roles r on r.oid=x.role_oid order by r.rolname),pg_catalog.pg_get_expr(p.polqual,p.polrelid)||':'||pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)
      into signature,actual_roles,actual_def from pg_catalog.pg_policy p where p.polrelid=item.table_name::pg_catalog.regclass and p.polname=item.name and p.polcmd='*' and p.polpermissive;
    if signature is distinct from item.canonical_signature or actual_roles is distinct from array['anon','authenticated']::text[] or pg_catalog.regexp_replace(actual_def,'[()[:space:]]','','g')<>'false:false' then raise exception 'deny policy % drift',item.name; end if;
  end loop;
  for item in select * from (values
    ('public.remember_flight_search_selections_v1(jsonb)','hajiz:flight-selection-durability:remember-search-rpc:v1','66db8708fdd0f890d085a06e405dac9cb7722647b274aef8d3703e5fd9cfb42a','v','TABLE(alternative_id text, replayed boolean)'),
    ('public.get_flight_search_selection_v1(text)','hajiz:flight-selection-durability:get-search-rpc:v1','1cfb9d4fac9c497e45ebe4913dc4176cfe0514b39b5a4f0fe2f2dbdd8cf614d0','s','TABLE(alternative_id text, internal_offer_id text, provider text, provider_offer_ref text, itinerary_snapshot jsonb, fare_snapshot jsonb, previous_customer_price_snapshot jsonb, passenger_composition jsonb, expires_at timestamp with time zone, payload_digest text)'),
    ('public.create_or_get_flight_priced_selection_v1(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)','hajiz:flight-selection-durability:create-priced-rpc:v1','282c1249556a54a1c7fc762938e6898c6d448d124a0b485c2c29deebafe9d842','v','TABLE(priced_selection_id text, replayed boolean)'),
    ('public.get_flight_priced_selection_v1(text)','hajiz:flight-selection-durability:get-priced-rpc:v1','1b0f98407d1975fd650a93b6f02dd7112da417b33d461eb2bd4278db99ba0c01','s','TABLE(priced_selection_id text, alternative_id text, internal_offer_id text, provider text, provider_offer_ref text, customer_price_snapshot jsonb, itinerary_snapshot jsonb, fare_snapshot jsonb, passenger_composition jsonb, expires_at timestamp with time zone, payload_digest text)')
  ) as expected(name,canonical_signature,body_hash,volatility,result_contract) loop
    obj:=pg_catalog.to_regprocedure(item.name);
    select p.proowner,pg_catalog.obj_description(p.oid,'pg_proc'),
      pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p.prosrc,'UTF8'),'sha256'),'hex'),
      p.provolatile,pg_catalog.pg_get_function_result(p.oid),p.proretset
      into owner_oid,signature,actual_body_hash,actual_volatility,actual_return,actual_retset
      from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid=p.prolang
      where p.oid=obj and l.lanname='plpgsql' and p.prokind='f' and p.prosecdef
        and p.proconfig=array['search_path=']::text[];
    if owner_oid is distinct from common_owner or signature is distinct from item.canonical_signature
       or actual_body_hash is distinct from item.body_hash
       or actual_volatility::text is distinct from item.volatility
       or actual_return is distinct from item.result_contract
       or actual_retset is distinct from true then
      raise exception 'RPC % catalog/body metadata drift',item.name;
    end if;
  end loop;
  if exists(select 1 from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(pg_catalog.coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a where c.oid='app_private.flight_search_selections'::pg_catalog.regclass and a.grantee=0 and a.privilege_type in ('SELECT','INSERT','UPDATE','DELETE')) or pg_catalog.has_table_privilege('anon','app_private.flight_search_selections','SELECT,INSERT,UPDATE,DELETE') or pg_catalog.has_table_privilege('authenticated','app_private.flight_search_selections','SELECT,INSERT,UPDATE,DELETE') or pg_catalog.has_table_privilege('service_role','app_private.flight_search_selections','SELECT,INSERT,UPDATE,DELETE') then raise exception 'search table direct privilege drift'; end if;
  if exists(select 1 from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(pg_catalog.coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a where c.oid='app_private.flight_priced_selections'::pg_catalog.regclass and a.grantee=0 and a.privilege_type in ('SELECT','INSERT','UPDATE','DELETE')) or pg_catalog.has_table_privilege('anon','app_private.flight_priced_selections','SELECT,INSERT,UPDATE,DELETE') or pg_catalog.has_table_privilege('authenticated','app_private.flight_priced_selections','SELECT,INSERT,UPDATE,DELETE') or pg_catalog.has_table_privilege('service_role','app_private.flight_priced_selections','SELECT,INSERT,UPDATE,DELETE') then raise exception 'priced table direct privilege drift'; end if;
end
$postflight$;
