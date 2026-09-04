import { randomBytes } from 'node:crypto';
import { PROJECT, blocked, assert } from './plan.mjs';
const origin = `https://${PROJECT}.supabase.co`;
// Only fixed Staging origin. apikey identifies the application; Authorization identifies
// an authenticated user. New publishable keys must never be placed in Bearer auth.
export function requestHeaders({ admin = false, token, headers = {} } = {}) {
  if(Object.keys(headers).some(k=>['apikey','authorization'].includes(k.toLowerCase())))blocked('SECURITY_HEADER_OVERRIDE_PROHIBITED');
  const apiKey=process.env[admin?'HAJIZ_STAGING_SERVICE_ROLE_KEY':'HAJIZ_STAGING_PUBLISHABLE_KEY'];
  const result={'Content-Type':'application/json',...headers,apikey:apiKey};
  if(admin||token)result.Authorization=`Bearer ${token??process.env.HAJIZ_STAGING_SERVICE_ROLE_KEY}`;
  return result;
}
// Never log request/response bodies, tokens, or raw errors.
export async function http(path, { admin = false, token, method = 'POST', body, headers = {} } = {}) {
  if (!path.startsWith('/auth/v1/') && !path.startsWith('/rest/v1/') && !path.startsWith('/storage/v1/')) blocked('HTTP_PATH_NOT_ALLOWED');
  const r = await fetch(origin + path, { method, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: requestHeaders({admin,token,headers}), body: body === undefined ? undefined : JSON.stringify(body) });
  let data; try { data = await r.json(); } catch { data = null; }
  return { ok: r.ok, status: r.status, data };
}
function probeFailure(label, response) {
  const e=new Error(typeof response.data?.message==='string'?response.data.message:typeof response.data?.msg==='string'?response.data.msg:`HTTP ${response.status}`);
  e.safeLabel=label;e.gate='BLOCKED';e.status=response.status;e.supabaseCode=response.data?.code??response.data?.error_code;
  throw e;
}
export async function preflightHttpProbes(markStage) {
  markStage('AUTH_ADMIN_PROBE');
  let r=await http('/auth/v1/admin/users?page=1&per_page=1',{admin:true,method:'GET'});
  if(!r.ok)probeFailure('AUTH_ADMIN_PROBE_FAILED',r);
  markStage('AUTH_PUBLIC_PROBE');
  r=await http('/auth/v1/settings',{method:'GET'});
  if(!r.ok)probeFailure('AUTH_PUBLIC_PROBE_FAILED',r);
  markStage('STORAGE_PROBE');
  r=await http('/storage/v1/bucket',{admin:true,method:'GET'});
  if(!r.ok)probeFailure('STORAGE_PROBE_FAILED',r);
}
export async function authenticatedRestProbe(actor, markStage) {
  markStage('REST_AUTHENTICATED_A_PROBE');
  const r=await http('/rest/v1/rpc/get_my_bookings',{token:actor.token,body:{}});
  if(!r.ok)probeFailure('REST_AUTHENTICATED_A_PROBE_FAILED',r);
  if(!Array.isArray(r.data)||r.data.length!==0)blocked('REST_AUTHENTICATED_A_PROBE_UNEXPECTED_DATA');
}
export async function createActor(ctx, label) {
  const email = `${ctx.run.toLowerCase()}-${label.toLowerCase()}@example.invalid`;
  ctx.journal.emails.push(email); ctx.save(); // Write intention before network request; recover by exact email.
  const password = randomBytes(36).toString('base64url');
  const r = await http('/auth/v1/admin/users', { admin: true, body: { email, password, email_confirm: true, app_metadata: { s1b_run: ctx.run, synthetic: true } } });
  if (!r.ok) blocked('AUTH_CREATE_FAILED');
  const id = r.data?.id ?? r.data?.user?.id;
  assert(typeof id === 'string', 'AUTH_UUID_REQUIRED');
  ctx.journal.actors.push({ id, label, email }); ctx.save();
  const login = await http('/auth/v1/token?grant_type=password', { body: { email, password } });
  if (!login.ok || !login.data?.access_token) blocked('AUTH_LOGIN_FAILED');
  const token = login.data.access_token;
  const who = await http('/auth/v1/user', { token, method: 'GET' });
  assert(who.ok && who.data?.id === id, 'AUTH_IDENTITY_VERIFIED');
  return { id, label, token };
}
export async function userRpc(actor, name, body = {}) {
  return http('/rest/v1/rpc/' + name, { token: actor?.token, body });
}
export async function mustRpc(actor, name, body) {
  const r = await userRpc(actor, name, body); assert(r.ok, 'AUTHENTICATED_RPC_' + name); return r.data;
}
