'use strict';
// Local-only read-only gate. Never emit exceptions or connection configuration.
const out = { tls: false, pids: [null, null], intervals: [], tx: false,
  rollback: [false, false], post: [false, false] };
const clients = [];
let fault = false;
const yes = v => v ? 'YES' : 'NO';
const pass = v => v ? 'PASS' : 'FAIL';
function requireTrue(v) { if (!v) throw new Error('Gate blocked'); }
async function main() {
  let complete = false;
  let closed = true;
  let stage = 'LOCAL_SECURITY_CHECK';
  let category = 'NONE';
  try {
    requireTrue(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0');
    requireTrue(!process.env.NODE_DEBUG && !process.env.NODE_DEBUG_NATIVE);
    stage = 'LOAD_DRIVER';
    const { Client } = require('pg');
    const { readFileSync } = require('node:fs');
    const { checkServerIdentity } = require('node:tls');
    stage = 'VALIDATE_STAGING_URL';
    const u = new URL(process.env.HAJIZ_STAGING_DATABASE_URL);
    const host = 'aws-0-ap-northeast-1.pooler.supabase.com';
    requireTrue(['postgres:', 'postgresql:'].includes(u.protocol) &&
      u.hostname === host && u.port === '5432' && u.pathname === '/postgres' &&
      decodeURIComponent(u.username) === 'postgres.pdnuswmljownjzjzpoop' &&
      u.password && !u.search && !u.hash);
    stage = 'READ_CA';
    const ca = readFileSync('C:\\Users\\mzeep\\Downloads\\prod-ca-2021.crt', 'utf8');
    stage = 'CONFIGURE_CLIENTS';
    // Explicit fields prevent URL SSL parameters overriding the trusted CA.
    for (const label of ['A', 'B']) {
      const c = new Client({ host, port: 5432, database: 'postgres',
        user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
        ssl: { ca, rejectUnauthorized: true, servername: host,
          checkServerIdentity: (_name, cert) => checkServerIdentity(host, cert) },
        application_name: 'hajiz-s1c0-local-' + label,
        options: '-c default_transaction_read_only=on',
        connectionTimeoutMillis: 15000, statement_timeout: 15000,
        query_timeout: 20000, idle_in_transaction_session_timeout: 30000 });
      c.on('error', () => { fault = true; });
      clients.push(c);
    }
    // Minimal verified TLS/authentication probe before concurrency work.
    stage = 'CONNECT_A_TLS_AND_AUTH';
    await clients[0].connect();
    stage = 'VERIFY_TLS_A';
    requireTrue(clients[0].connection.stream.encrypted && clients[0].connection.stream.authorized);
    stage = 'READ_ONLY_PROBE_A';
    requireTrue((await clients[0].query('SELECT 1 AS ok')).rows[0].ok === 1);
    out.pids[0] = (await clients[0].query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    stage = 'CONNECT_B_TLS_AND_AUTH';
    await clients[1].connect();
    stage = 'VERIFY_TLS_B';
    requireTrue(clients[1].connection.stream.encrypted && clients[1].connection.stream.authorized);
    stage = 'READ_ONLY_PROBE_B';
    requireTrue((await clients[1].query('SELECT 1 AS ok')).rows[0].ok === 1);
    out.pids[1] = (await clients[1].query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    out.tls = true;
    requireTrue(out.pids.every(Number.isInteger) && out.pids[0] !== out.pids[1]);
    stage = 'TRANSACTION_AND_OVERLAP_PROOF';
    await Promise.all(clients.map(c => c.query('BEGIN READ ONLY')));
    const identity = `SELECT pg_backend_pid() AS pid,
      transaction_timestamp()::text AS tx,
      current_setting('transaction_read_only') AS ro`;
    const before = await Promise.all(clients.map(async c => (await c.query(identity)).rows[0]));
    // Each interval is measured INSIDE its server query, not at dispatch time.
    const timing = `WITH t AS MATERIALIZED (SELECT clock_timestamp() AS started),
      w AS MATERIALIZED (SELECT pg_sleep(3) FROM t)
      SELECT t.started::text AS start, clock_timestamp()::text AS end,
      (extract(epoch FROM t.started)*1000000)::bigint::text AS start_us,
      (extract(epoch FROM clock_timestamp())*1000000)::bigint::text AS end_us
      FROM t CROSS JOIN w`;
    const results = await Promise.allSettled(clients.map(c => c.query(timing)));
    requireTrue(results.every(r => r.status === 'fulfilled'));
    out.intervals = results.map(r => r.value.rows[0]);
    const [a, b] = out.intervals;
    requireTrue(BigInt(a.start_us) < BigInt(b.end_us) && BigInt(b.start_us) < BigInt(a.end_us));
    const after = await Promise.all(clients.map(async c => (await c.query(identity)).rows[0]));
    out.tx = after.every((r, i) => r.pid === out.pids[i] && before[i].pid === r.pid &&
      r.tx === before[i].tx && r.ro === 'on' && before[i].ro === 'on');
    requireTrue(out.tx);
    await Promise.all(clients.map(async (c, i) => {
      out.rollback[i] = (await c.query('ROLLBACK')).command === 'ROLLBACK';
      const r = (await c.query('SELECT 1 AS ok, pg_backend_pid() AS pid')).rows[0];
      out.post[i] = r.ok === 1 && r.pid === out.pids[i];
    }));
    complete = out.rollback.every(Boolean) && out.post.every(Boolean);
  } catch (e) {
    fault = true;
    // Only fixed allowlisted codes; NEVER message, stack, detail, or error objects.
    const allowed = new Set(['SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_OSSL_PEM_NO_START_LINE',
      '28P01', '28000', '08P01', '53300', '57P03', '42501', '42704',
      'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET',
      'ENOENT', 'EACCES', 'MODULE_NOT_FOUND', 'ERR_INVALID_URL']);
    category = allowed.has(e?.code) ? e.code : 'UNCLASSIFIED_FAILURE';
  }
  finally {
    // end() terminates the session and rolls back any interrupted read-only transaction.
    await Promise.all(clients.map(async c => {
      try { await c.end(); } catch { closed = false; }
    }));
  }
  console.log('TLS verified: ' + yes(out.tls));
  for (let i = 0; i < 2; i++) {
    const label = ['A', 'B'][i];
    console.log('PID ' + label + ': ' + (out.pids[i] ?? 'UNAVAILABLE'));
    console.log('Overlap ' + label + ' start: ' + (out.intervals[i]?.start ?? 'UNAVAILABLE'));
    console.log('Overlap ' + label + ' end: ' + (out.intervals[i]?.end ?? 'UNAVAILABLE'));
  }
  console.log('Transaction overlap: ' + yes(out.tx));
  for (let i = 0; i < 2; i++) {
    console.log('Rollback ' + ['A', 'B'][i] + ': ' + pass(out.rollback[i]));
    console.log('Post-rollback probe ' + ['A', 'B'][i] + ': ' + pass(out.post[i]));
  }
  const success = complete && closed && !fault;
  if (!success) {
    console.log('Blocked stage: ' + stage);
    console.log('Safe error category: ' + category);
  }
  console.log('Final S1-C0: ' + (success ? 'PASS' : 'BLOCKED'));
  process.exitCode = success ? 0 : 1;
}
main().catch(() => { console.log('Final S1-C0: BLOCKED'); process.exitCode = 1; });
