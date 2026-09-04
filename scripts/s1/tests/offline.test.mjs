// Offline source/guard checks. Does not import the runner or open a database/network connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { sections, budget, rpc } from '../lib/plan.mjs';
import { render } from '../lib/report.mjs';
import { validateLegacySupabaseKey } from '../lib/legacy-key-validator.mjs';
import { diagnostic, sanitizeMessage } from '../lib/diagnostics.mjs';
import { requestHeaders } from '../lib/auth.mjs';
const base=fileURLToPath(new URL('..',import.meta.url));
const read=p=>readFileSync(join(base,p),'utf8');
const jwt=payload=>['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify(payload),'utf8').toString('base64url'),'synthetic-signature'].join('.');
test('legacy Supabase key validator uses only exact ref and role claims',()=>{
  const project='pdnuswmljownjzjzpoop';
  const anon=jwt({iss:'supabase',ref:project,role:'anon'});
  const service=jwt({iss:'supabase',ref:project,role:'service_role'});
  assert.equal(validateLegacySupabaseKey(anon,project,'anon'),true);
  assert.equal(validateLegacySupabaseKey(service,project,'service_role'),true);
  assert.equal(validateLegacySupabaseKey(jwt({iss:'supabase',ref:'wrong-project',role:'anon'}),project,'anon'),false);
  assert.equal(validateLegacySupabaseKey(anon,project,'service_role'),false);
  assert.equal(validateLegacySupabaseKey(service,project,'anon'),false);
  for(const malformed of ['', 'one.two', 'one.two.three.four', 'x.%.z', 'sb_publishable_synthetic', 'sb_secret_synthetic']) {
    assert.equal(validateLegacySupabaseKey(malformed,project,'anon'),false);
  }
});
test('PowerShell helper sets exact auth environment names without backslashes',()=>{
  const src=read('set-auth-env.ps1');
  assert.match(src,/\$s1bName = 'HAJIZ_STAGING_' \+ \$s1bPart \+ '_KEY'/);
  assert.doesNotMatch(src,/HAJIZ\\_STAGING|SERVICE\\_ROLE/);
  assert.deepEqual(['ANON','SERVICE_ROLE'].map(part=>'HAJIZ_STAGING_'+part+'_KEY'),[
    'HAJIZ_STAGING_ANON_KEY','HAJIZ_STAGING_SERVICE_ROLE_KEY'
  ]);
});
test('preflight stages precede fixture creation and stop through one outer catch',()=>{
  const runner=read('run-s1b.mjs'),connection=read('lib/connection.mjs'),auth=read('lib/auth.mjs');
  for(const [src,ordered] of [[connection,['ENVIRONMENT_VALIDATION','CA_LOAD']],[runner,['LOCAL_ARTIFACT_VALIDATION','POSTGRES_CONNECT','POSTGRES_READ_PROBE','RUNTIME_PREFLIGHT','AUTH_IDENTITY_CREATION','FIXTURE_CREATION']],[auth,['AUTH_ADMIN_PROBE','AUTH_PUBLIC_PROBE','STORAGE_PROBE','REST_AUTHENTICATED_A_PROBE']]]){
    let at=-1;for(const stage of ordered){const next=src.indexOf(`'${stage}'`,at+1);assert.ok(next>at,stage);at=next;}
  }
  assert.ok(runner.indexOf('await preflightHttpProbes(markStage)')<runner.indexOf("markStage('RUNTIME_PREFLIGHT')"));
  assert.ok(runner.indexOf("markStage('AUTH_IDENTITY_CREATION')")<runner.indexOf("createActor(ctx,label)"));
  assert.ok(runner.indexOf('authenticatedRestProbe(')<runner.indexOf("markStage('FIXTURE_CREATION')"));
});
test('safe diagnostics preserve codes and redact secrets, URLs and headers',()=>{
  const e=new Error('connect postgresql://user:password@host/db Authorization: Bearer eyJabc.def.ghi sb_secret_hidden');e.code='28P01';e.name='DatabaseError';
  const d=diagnostic(e,{stage:'POSTGRES_CONNECT',subsystem:'postgres',networkConnected:false});
  assert.equal(d.safeCode,'28P01');assert.equal(d.targetCategory,'HAJIZ STAGING');assert.equal(d.networkConnectionEstablished,false);
  assert.doesNotMatch(JSON.stringify(d),/password|eyJabc|sb_secret_hidden|Bearer/);
  assert.doesNotMatch(sanitizeMessage('https://example.test/path?token=secret'),/token=secret/);
});
test('runner reads only exact current S1-B credential environment names',()=>{
  const src=read('lib/connection.mjs')+read('lib/auth.mjs');
  for(const name of ['HAJIZ_STAGING_DATABASE_URL','HAJIZ_STAGING_ANON_KEY','HAJIZ_STAGING_SERVICE_ROLE_KEY','HAJIZ_STAGING_PUBLISHABLE_KEY'])assert.ok(src.includes(name));
  assert.doesNotMatch(src,/HAJIZ\\_STAGING|SERVICE\\_ROLE/);
});
test('REST public gateway uses publishable apikey with independent Authorization',()=>{
  const saved={...process.env};
  try{
    process.env.HAJIZ_STAGING_PUBLISHABLE_KEY='sb_publishable_synthetic_project_key';
    process.env.HAJIZ_STAGING_SERVICE_ROLE_KEY='synthetic-service-secret';
    const publicHeaders=requestHeaders();
    assert.equal(publicHeaders.apikey,'sb_publishable_synthetic_project_key');
    assert.equal('Authorization' in publicHeaders,false);
    const userHeaders=requestHeaders({token:'synthetic-user-jwt'});
    assert.equal(userHeaders.apikey,'sb_publishable_synthetic_project_key');
    assert.equal(userHeaders.Authorization,'Bearer synthetic-user-jwt');
    assert.notEqual(publicHeaders.apikey,process.env.HAJIZ_STAGING_SERVICE_ROLE_KEY);
    assert.throws(()=>requestHeaders({headers:{apikey:'override'}}),/Gate blocked/);
  }finally{process.env= saved;}
});
test('missing or malformed publishable key blocks before network; authenticated REST failure remains hard',()=>{
  const connection=read('lib/connection.mjs'),auth=read('lib/auth.mjs');
  assert.match(connection,/PUBLISHABLE_KEY_MISSING_INVALID/);
  assert.match(connection,/\^sb_publishable_/);
  assert.match(auth,/if\(!r\.ok\)probeFailure\('REST_AUTHENTICATED_A_PROBE_FAILED',r\)/);
  assert.match(auth,/HTTP \$\{response\.status\}/);
});
test('PostgREST root is never a public-key probe; schema-authenticated safe RPC is concrete',()=>{
  const auth=read('lib/auth.mjs'),runner=read('run-s1b.mjs');
  assert.doesNotMatch(auth,/http\('\/rest\/v1\/'\s*,/);
  assert.match(auth,/http\('\/rest\/v1\/rpc\/get_my_bookings'/);
  assert.match(runner,/REST_PUBLIC_PROBE',status:'NOT_APPLICABLE_BY_SCHEMA'/);
  assert.match(runner,/C1_REVOKES_ANON_TABLE_ACCESS_AND_GRANTS_NO_ANON_RPC/);
  assert.ok(runner.indexOf('createActor(ctx,label)')<runner.indexOf('authenticatedRestProbe('));
});
test('publishable PowerShell helper uses exact variable name and hidden input',()=>{
  const src=read('set-publishable-env.ps1');
  assert.match(src,/'HAJIZ_STAGING_PUBLISHABLE_KEY'/);assert.match(src,/Read-Host .* -AsSecureString/);
  assert.doesNotMatch(src,/HAJIZ\\_STAGING/);
});
test('all mandatory sections implemented with assertions',()=>{
  const src=read('tests/runtime.mjs');for(const name of sections)assert.ok(src.includes(`section('${name}'`),name);
});
test('TLS and exact target guard enabled; URL read only from environment',()=>{
  const src=read('lib/connection.mjs');assert.match(src,/rejectUnauthorized: true/);assert.match(src,/checkServerIdentity\(HOST, cert\)/);assert.match(src,/process\.env\.HAJIZ_STAGING_DATABASE_URL/);assert.match(src,/u\.hostname !== HOST/);assert.match(src,/u\.port !== '5432'/);
});
test('physical sessions and observed lock barrier precede commit',()=>{
  const src=read('lib/competition.mjs');assert.match(src,/connect\(ctx.config,'A'\)/);assert.match(src,/connect\(ctx.config,'B'\)/);assert.ok(src.indexOf("if(!lock)")<src.indexOf('await commit(a,ctx)'));assert.match(src,/pg_blocking_pids/);
});
test('cleanup does not issue immutable HAJIZ delete statements',()=>{
  const src=read('lib/inventory.mjs');for(const table of ['payment_audit','payment_provider_events','payment_receipts'])assert.ok(!src.includes('DELETE FROM public.'+table));assert.match(src,/MINIMUM_DEPENDENCY_CLOSURE/);assert.match(src,/RESIDUE_PROVIDER_NOT_MOCK/);
});
test('no schema-changing execution SQL',()=>{
  for(const p of ['run-s1b.mjs','tests/runtime.mjs',...readdirSync(join(base,'lib')).filter(p=>p.endsWith('.mjs')).map(p=>'lib/'+p)]){
    const src=read(p);assert.doesNotMatch(src,/\.query\(\s*[`'"]\s*(CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i,p);
    assert.doesNotMatch(src,/rejectUnauthorized\s*:\s*false/);assert.doesNotMatch(src,/session_replication_role/);
  }
});
test('partial results cannot PASS and residue not equated with cleanup failure',()=>{
  const ctx={run:'synthetic',results:{},journal:{fixtures:[],cleanup:'NOT RUN'}};render(ctx);assert.equal(ctx.verdict,'BLOCKED');
  ctx.results=Object.fromEntries(sections.map(s=>[s,{status:'PASS'}]));ctx.journal.cleanup='PASS';ctx.journal.ledger=[{id:'synthetic'}];const report=render(ctx);assert.equal(ctx.verdict,'PASS');assert.match(report,/IMMUTABLE SYNTHETIC RESIDUE: YES/);
});
test('declared budget finite and mandatory RPCs registered',()=>{
  for(const n of Object.values(budget))assert.ok(Number.isInteger(n)&&n>=0);for(const n of ['b13prepare','b13mark','b13complete','b13fail','b14prepare','b14mark','b14complete','b14fail'])assert.ok(rpc[n]);
});
test('expiry fixture is expired against the same authoritative transaction clock and saves evidence before assertion',()=>{
  const src=read('tests/runtime.mjs');
  assert.match(src,/expires_at=transaction_timestamp\(\)-interval '1 second'/);
  assert.match(src,/expires_at<=transaction_timestamp\(\) AS expired_by_function_clock/);
  assert.doesNotMatch(src,/fixture\(ctx,c,'expired'[\s\S]{0,250}expires_at=clock_timestamp\(\)-interval/);
  assert.ok(src.indexOf("test:'Expiry setup'")<src.indexOf("'EXPIRED_FIXTURE_NOT_EXPIRED_BY_FUNCTION_CLOCK'"));
  assert.ok(src.indexOf("test:'Expiry future caller time'")<src.indexOf("'EXPIRED_CONFIRMATION_FAILS_CLOSED'"));
  assert.match(src,/\{9:'2099-01-01T00:00:00Z'\}/);
});
test('dedicated expiry runner is rollback-only and checks every scoped residue table',()=>{
  const src=read('run-expiry-only.mjs');
  assert.match(src,/await c\.query\('BEGIN'\)/);assert.match(src,/await c\.query\('ROLLBACK'\)/);
  assert.doesNotMatch(src,/\bCOMMIT\b/);
  for(const name of ['public.bookings','public.payments','app_private.flight_booking_intents','app_private.flight_payment_initiations','public.payment_provider_events','public.payment_audit','public.payment_receipts','storage.objects'])assert.ok(src.includes(name),name);
  assert.ok(src.indexOf("step:'PRE_CONFIRMATION_TIMING'")<src.indexOf("'EXPIRED_FIXTURE_NOT_EXPIRED_BY_FUNCTION_CLOCK'"));
  assert.ok(src.indexOf("step:'FUTURE_CALLER_TIME_CONFIRMATION'")<src.indexOf("'EXPIRED_CONFIRMATION_FAILS_CLOSED'"));
});
test('expiry residue verifier never compares public hbi token to UUID initiation FK',()=>{
  const src=read('run-expiry-only.mjs');
  assert.match(src,/SELECT id FROM app_private\.flight_booking_intents WHERE booking_intent_id=\$1/);
  assert.match(src,/flight_payment_initiations WHERE booking_intent_id=\$1::uuid OR payment_id=\$2'\s*,\s*\[f\.internalIntentId,f\.payment\]/);
  assert.doesNotMatch(src,/flight_payment_initiations WHERE booking_intent_id=\$1[^']*'\s*,\s*\[f\.intent/);
  assert.match(src,/publicIntentToken:f\.intent,internalIntentId:f\.internalIntentId/);
});
