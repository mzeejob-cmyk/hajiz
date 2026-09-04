import { budget, immutable, blocked, assert } from './plan.mjs';
import { http } from './auth.mjs';
import { negative, call } from './connection.mjs';
import { rpc } from './plan.mjs';
// Each selector is bounded to UUIDs/email addresses journaled before fixture creation.
export const selectors = {
  'auth.users': ['id,email', 'email=ANY($1::text[])', 'emails'],
  'public.profiles': ['id', 'id=ANY($1::uuid[])', 'owners'],
  'public.offers': ['id,supplier_provider,enabled', 'id=$1::uuid', 'offer'],
  'public.bookings': ['id,user_id,offer_id,status,supplier_provider', 'user_id=ANY($1::uuid[])', 'owners'],
  'public.payments': ['id,user_id,booking_id,reviewer_id,status', 'user_id=ANY($1::uuid[])', 'owners'],
  'public.payment_provider_events': ['id,payment_id', 'payment_id IN (SELECT id FROM public.payments WHERE user_id=ANY($1::uuid[]))', 'owners'],
  'public.payment_receipts': ['id,payment_id,user_id', 'user_id=ANY($1::uuid[])', 'owners'],
  'public.payment_audit': ['id,aggregate_id,actor_id,event_type', 'aggregate_id IN (SELECT id FROM public.payments WHERE user_id=ANY($1::uuid[]) UNION SELECT id FROM public.bookings WHERE user_id=ANY($1::uuid[])) OR actor_id=ANY($1::uuid[])', 'owners'],
  'app_private.flight_booking_intents': ['id,owner_id', 'owner_id=ANY($1::uuid[])', 'owners'],
  'app_private.flight_payment_initiations': ['id,owner_id,booking_id,payment_id,booking_intent_id', 'owner_id=ANY($1::uuid[])', 'owners'],
  'app_private.flight_supplier_booking_executions': ['id,owner_id,booking_id,payment_id,booking_intent_id,operation_id,provider,execution_state', 'owner_id=ANY($1::uuid[])', 'owners'],
  'app_private.flight_supplier_ticketing_executions': ['id,owner_id,booking_id,supplier_execution_id,operation_id,provider,execution_state', 'owner_id=ANY($1::uuid[])', 'owners'],
  'app_private.flight_ticket_records': ['id,owner_id,booking_id,ticketing_execution_id,provider', 'owner_id=ANY($1::uuid[])', 'owners'],
  'app_private.supplier_operations': ['id,booking_id,offer_id,provider,status', 'booking_id IN (SELECT id FROM public.bookings WHERE user_id=ANY($1::uuid[]))', 'owners']
};
export async function inventory(c, j) {
  const found = (await c.query('SELECT id,email FROM auth.users WHERE email=ANY($1::text[])', [j.emails])).rows;
  const owners = found.map(r => r.id);
  const data = {};
  for (const [table, [cols, where, param]] of Object.entries(selectors)) {
    if(table==='public.payment_audit') {
      const aggregates=j.fixtures.flatMap(f=>[f.booking,f.payment]);
      data[table]=(await c.query(`SELECT ${cols} FROM public.payment_audit WHERE aggregate_id=ANY($1::uuid[]) OR actor_id=ANY($2::uuid[])`,[aggregates,owners])).rows;
    } else data[table] = (await c.query(`SELECT ${cols} FROM ${table} WHERE ${where}`, [param === 'owners' ? owners : param === 'emails' ? j.emails : j.offer])).rows;
  }
  return data;
}
export async function budgetCheck(c, ctx) {
  const data = await inventory(c, ctx.journal);
  for (const t of immutable) if (data[t].length > budget[t]) blocked('IMMUTABLE_BUDGET_EXCEEDED_' + t);
  for (const t of ['auth.users','public.bookings','public.payments','public.offers']) if (data[t].length > budget[t]) blocked('FIXTURE_BUDGET_EXCEEDED_' + t);
  return data;
}
export async function commit(c, ctx) {
  try { await budgetCheck(c, ctx); await c.query('COMMIT'); } catch (e) { await c.query('ROLLBACK'); throw e; }
}
export async function cleanup(ctx, c) {
  assert(ctx.journal.emails.every(email=>['a','b','finance'].some(label=>email===`${ctx.run.toLowerCase()}-${label}@example.invalid`)),'JOURNAL_EMAIL_SCOPE');
  // Snapshot before deletion: ledger must not lose audit linkage when a deletable aggregate is removed.
  const before = await inventory(c, ctx.journal);
  for(const b of before['public.bookings'])assert(b.supplier_provider==='mock'&&b.offer_id===ctx.journal.offer,'CLEANUP_BOOKING_SCOPE');
  const offerProof=(await c.query('SELECT supplier_metadata FROM public.offers WHERE id=$1',[ctx.journal.offer])).rows;
  if(offerProof.length)assert(offerProof[0].supplier_metadata?.s1bRun===ctx.run,'CLEANUP_OFFER_SCOPE');
  for(const path of ctx.journal.storage){const [owner,payment,file,...extra]=path.split('/');assert(!extra.length&&before['auth.users'].some(u=>u.id===owner)&&ctx.journal.fixtures.some(f=>f.payment===payment&&f.owner===owner)&&file.startsWith(ctx.run)&&/^[A-Za-z0-9_.-]+\.png$/.test(file),'STORAGE_CLEANUP_SCOPE');}
  ctx.journal.beforeCleanup = before; ctx.save();
  // Delete synthetic object bytes through Storage API, not SQL metadata-only deletion.
  if(ctx.journal.storage.length) {
    const r=await http('/storage/v1/object/receipts',{admin:true,method:'DELETE',body:{prefixes:ctx.journal.storage}});
    assert(r.ok,'STORAGE_CLEANUP_FAILED');
    const remains=(await c.query('SELECT id FROM storage.objects WHERE bucket_id=$1 AND name=ANY($2::text[])',['receipts',ctx.journal.storage])).rows;
    assert(remains.length===0,'STORAGE_RESIDUE');
  }
  for (const actor of ctx.actors ?? []) await http('/auth/v1/logout?scope=global', { token: actor.token, body: {} });
  // Quarantine owned synthetic accounts; never change an existing/non-run account.
  for (const user of before['auth.users']) {
    assert(ctx.journal.emails.includes(user.email), 'CLEANUP_OWNER_SCOPE');
    const r = await http('/auth/v1/admin/users/' + user.id, { admin: true, method: 'PUT', body: { ban_duration: '876000h' } });
    assert(r.ok, 'AUTH_QUARANTINE_FAILED');
  }
  const owners = before['auth.users'].map(r => r.id);
  await c.query('BEGIN');
  try {
    // Never change economics, ownership, supplier identity, audit rows, or constraints.
    await c.query('UPDATE public.offers SET enabled=false WHERE id=$1::uuid AND supplier_provider=$2', [ctx.journal.offer, 'mock']);
    // Remove only actual run-owned deletable children, in FK order.
    const order = ['app_private.flight_ticket_records','app_private.flight_supplier_ticketing_executions','app_private.flight_supplier_booking_executions','app_private.supplier_operations','app_private.flight_payment_initiations','app_private.flight_booking_intents'];
    for (const table of order) {
      const [,where] = selectors[table];
      await c.query(`DELETE FROM ${table} WHERE ${where}`, [owners]);
    }
    // Payments referenced by immutable events/receipts must remain; their parents remain transitively.
    await c.query(`DELETE FROM public.payments p WHERE p.user_id=ANY($1::uuid[])
      AND NOT EXISTS(SELECT 1 FROM public.payment_provider_events e WHERE e.payment_id=p.id)
      AND NOT EXISTS(SELECT 1 FROM public.payment_receipts r WHERE r.payment_id=p.id)`, [owners]);
    await c.query(`DELETE FROM public.bookings b WHERE b.user_id=ANY($1::uuid[])
      AND NOT EXISTS(SELECT 1 FROM public.payments p WHERE p.booking_id=b.id)`, [owners]);
    await c.query(`DELETE FROM public.offers o WHERE o.id=$1::uuid
      AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.offer_id=o.id)`, [ctx.journal.offer]);
    await c.query('DELETE FROM public.profiles WHERE id=ANY($1::uuid[])', [owners]);
    // These are synthetic users created by this run, already banned and signed out.
    // Ordinary scoped DELETEs only; any protection refusing them aborts cleanup.
    await c.query('DELETE FROM auth.refresh_tokens WHERE user_id::text=ANY($1::text[])', [owners]);
    await c.query('DELETE FROM auth.sessions WHERE user_id=ANY($1::uuid[])', [owners]);
    await c.query('DELETE FROM auth.identities WHERE user_id=ANY($1::uuid[])', [owners]);
    await c.query("DELETE FROM auth.audit_log_entries WHERE payload->>'actor_id'=ANY($1::text[]) OR payload->>'actor_username'=ANY($2::text[])",[owners,ctx.journal.emails]);
    await commit(c, ctx);
  } catch (e) { await c.query('ROLLBACK'); throw e; }
  // Auth cleanup uses official Admin API, never direct writes to Auth internals.
  const after = await inventory(c, ctx.journal);
  for (const user of after['auth.users']) {
    const needed = after['public.payments'].some(p => p.user_id === user.id || p.reviewer_id === user.id) || after['public.bookings'].some(b => b.user_id === user.id) || after['public.payment_receipts'].some(r => r.user_id === user.id);
    if (!needed) { const r = await http('/auth/v1/admin/users/' + user.id, { admin: true, method: 'DELETE' }); assert(r.ok, 'AUTH_DELETE_FAILED'); }
  }
  // Admin deletion can itself append an Auth operational log for the synthetic user.
  await c.query("DELETE FROM auth.audit_log_entries WHERE payload->>'actor_id'=ANY($1::text[]) OR payload->>'actor_username'=ANY($2::text[])",[owners,ctx.journal.emails]);
  const final = await inventory(c, ctx.journal);
  // Prove retained rows cannot re-enter the real B13/B14 execution authority.
  await c.query('BEGIN');
  try {
    for(const b of final['public.bookings']) {
      await negative(c,()=>call(c,rpc.b13prepare,[b.user_id,b.id,'hsb_req_'+ctx.run+'_cleanup','a'.repeat(64)]),['P0002']);
      await negative(c,()=>call(c,rpc.b14prepare,[b.user_id,b.id,'hst_req_'+ctx.run+'_cleanup','a'.repeat(64)]),['P0002']);
    }
  } finally {await c.query('ROLLBACK');}
  for(const table of ['auth.refresh_tokens','auth.sessions','auth.identities']) {
    const col=table==='auth.refresh_tokens'?'user_id::text=ANY($1::text[])':'user_id=ANY($1::uuid[])';
    assert((await c.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${col}`,[owners])).rows[0].n===0,'AUTH_CHILD_RESIDUE');
  }
  assert((await c.query("SELECT count(*)::int AS n FROM auth.audit_log_entries WHERE payload->>'actor_id'=ANY($1::text[]) OR payload->>'actor_username'=ANY($2::text[])",[owners,ctx.journal.emails])).rows[0].n===0,'AUTH_AUDIT_RESIDUE');
  const ledger = [];
  const edge = (table, id) => id == null ? [] : [{ table, id: String(id) }];
  for (const [table, rows] of Object.entries(final)) for (const row of rows) {
    let parents = [], reason;
    if (table === 'public.payment_provider_events') { parents = edge('public.payments', row.payment_id); reason = 'provider_events_immutable'; }
    else if (table === 'public.payment_receipts') { parents = [...edge('public.payments',row.payment_id),...edge('auth.users',row.user_id)]; reason='receipts_immutable'; }
    else if (table === 'public.payment_audit') { reason='payment_audit_immutable; aggregate/actor identifiers are logical references, not retention FKs'; }
    else if (table === 'public.payments') { parents=[...edge('public.bookings',row.booking_id),...edge('auth.users',row.user_id),...edge('auth.users',row.reviewer_id)]; reason='required FK parent of immutable event/receipt'; }
    else if (table === 'public.bookings') { parents=[...edge('auth.users',row.user_id),...edge('public.offers',row.offer_id)]; reason='required FK parent of retained payment'; }
    else if (table === 'public.offers' || table === 'auth.users') reason='required FK parent in immutable-row dependency closure';
    else blocked('DELETABLE_RESIDUE_' + table);
    ledger.push({ runId:ctx.run,table,id:String(row.id),owner:row.user_id??row.owner_id??row.actor_id??null,aggregateId:row.aggregate_id??null,parents,children:[],reason,
      tests:ctx.journal.fixtures.filter(f => [row.aggregate_id,row.payment_id,row.booking_id,row.id].includes(f.payment) || [row.aggregate_id,row.booking_id,row.id].includes(f.booking)).map(f=>f.label),
      supplierExecutionEligibility:'NO',productionRelevance:'NONE',containsRealPII:'NO' });
  }
  for (const row of ledger) row.children=ledger.filter(child=>child.parents.some(p=>p.table===row.table&&p.id===row.id)).map(child=>({table:child.table,id:child.id}));
  for(let i=0;i<4;i++)for(const row of ledger) if(!row.tests.length)row.tests=[...new Set(ledger.filter(child=>child.parents.some(p=>p.table===row.table&&p.id===row.id)).flatMap(child=>child.tests))];
  for (const row of ledger) if (!immutable.includes(row.table)) assert(row.children.length>0,'MINIMUM_DEPENDENCY_CLOSURE');
  for (const b of final['public.bookings']) assert(b.supplier_provider==='mock','RESIDUE_PROVIDER_NOT_MOCK');
  for (const o of final['public.offers']) assert(o.supplier_provider==='mock'&&!o.enabled,'RESIDUE_OFFER_NOT_DISABLED');
  for (const [table, rows] of Object.entries(final)) assert(rows.length <= budget[table], 'FINAL_RESIDUE_BUDGET');
  ctx.journal.ledger = ledger; ctx.journal.cleanup = 'PASS'; ctx.save();
  return ledger;
}
