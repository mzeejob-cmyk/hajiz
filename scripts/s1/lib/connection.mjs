import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { checkServerIdentity } from 'node:tls';
import { PROJECT, HOST, CA, blocked, rpc } from './plan.mjs';
import { validateLegacySupabaseKey } from './legacy-key-validator.mjs';
const require = createRequire(import.meta.url);
export function configuration(markStage = () => {}) {
  markStage('ENVIRONMENT_VALIDATION');
  if (process.env.NODE_ENV === 'production' || process.env.NODE_OPTIONS || process.env.NODE_DEBUG || process.env.NODE_DEBUG_NATIVE || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') blocked('UNSAFE_PROCESS_CONFIGURATION');
  let u;
  try { u = new URL(process.env.HAJIZ_STAGING_DATABASE_URL); } catch (cause) { const e=new Error('Database environment value is missing or invalid',{cause});e.safeLabel='DATABASE_ENV_MISSING_INVALID';e.gate='BLOCKED';throw e; }
  if (!['postgres:', 'postgresql:'].includes(u.protocol) || u.hostname !== HOST || u.port !== '5432' || u.pathname !== '/postgres' || decodeURIComponent(u.username) !== `postgres.${PROJECT}` || !u.password || u.search || u.hash) blocked('STAGING_TARGET_MISMATCH');
  if (!process.env.HAJIZ_STAGING_ANON_KEY || !process.env.HAJIZ_STAGING_SERVICE_ROLE_KEY || !process.env.HAJIZ_STAGING_PUBLISHABLE_KEY) blocked('AUTH_ENV_MISSING');
  // Legacy key identity is bound only by its documented payload ref and role.
  // iss and aud are intentionally not used to infer the Supabase project.
  for (const [name, role] of [['HAJIZ_STAGING_ANON_KEY','anon'],['HAJIZ_STAGING_SERVICE_ROLE_KEY','service_role']]) {
    if (!validateLegacySupabaseKey(process.env[name], PROJECT, role)) blocked('AUTH_KEY_PROJECT_ROLE_MISMATCH');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(process.env.HAJIZ_STAGING_PUBLISHABLE_KEY)) blocked('PUBLISHABLE_KEY_MISSING_INVALID');
  markStage('CA_LOAD');
  let ca;
  try { ca = readFileSync(CA, 'utf8'); } catch (cause) { const e=new Error('Approved CA file could not be loaded',{cause});e.safeLabel='CA_LOAD_FAILED';e.gate='BLOCKED';throw e; }
  return { host: HOST, port: 5432, database: 'postgres', user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    ssl: { ca, rejectUnauthorized: true, servername: HOST, checkServerIdentity: (_, cert) => checkServerIdentity(HOST, cert) },
    connectionTimeoutMillis: 15000, statement_timeout: 20000, query_timeout: 25000, idle_in_transaction_session_timeout: 45000 };
}
export async function connect(config, label) {
  let Client;
  try {
    if(require('../node_modules/pg/package.json').version!=='8.23.0')blocked('PG_VERSION_MISMATCH');
    ({ Client } = require('../node_modules/pg'));
  } catch { blocked('PG_DEPENDENCY_MISSING_OR_VERSION_MISMATCH'); }
  const c = new Client({ ...config, application_name: 'hajiz-s1b-' + label });
  c.on('error', () => { c.s1bBroken = true; });
  try { await c.connect(); if (!c.connection.stream.authorized) blocked('TLS_NOT_VERIFIED'); } catch (error) { try { await c.end(); } catch {} if(error?.safeLabel)throw error; error.safeLabel='DATABASE_CONNECTION_FAILED';error.gate='BLOCKED';throw error; }
  return c;
}
export async function call(c, name, args) {
  if (!Object.values(rpc).includes(name)) blocked('RPC_NOT_ALLOWLISTED');
  return (await c.query(`SELECT * FROM public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')})`, args)).rows;
}
export async function negative(c, action, codes = ['22023','23505','P0002','P0001','42501']) {
  await c.query('SAVEPOINT negative_case');
  let code;
  try { await action(); } catch (e) { code = e.code; }
  await c.query('ROLLBACK TO SAVEPOINT negative_case');
  await c.query('RELEASE SAVEPOINT negative_case');
  if (!codes.includes(code)) blocked('NEGATIVE_CASE_NOT_PROVEN');
  return code;
}
