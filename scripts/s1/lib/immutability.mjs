import { createHash } from 'node:crypto';
import { blocked } from './plan.mjs';
// Targeted cleanup preconditions and pre/post authority fingerprint, not an S1-A rerun.
export async function fingerprint(c) {
  const parts=[];
  parts.push((await c.query(`SELECT n.nspname,p.proname,p.oid,pg_get_functiondef(p.oid) AS definition,p.proacl
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','app_private') AND p.prokind='f' ORDER BY p.oid`)).rows);
  parts.push((await c.query(`SELECT n.nspname,c.relname,c.oid,c.relrowsecurity,c.relforcerowsecurity,c.relacl
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','app_private') ORDER BY c.oid`)).rows);
  parts.push((await c.query(`SELECT c.oid,c.conrelid,c.confrelid,pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
    WHERE n.nspname IN ('public','app_private') ORDER BY c.oid`)).rows);
  parts.push((await c.query(`SELECT p.oid,p.polname,p.polrelid,p.polroles,pg_get_expr(p.polqual,p.polrelid) AS using_expression,
    pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','app_private') ORDER BY p.oid`)).rows);
  parts.push((await c.query(`SELECT t.oid,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','app_private') ORDER BY t.oid`)).rows);
  parts.push((await c.query(`SELECT a.attrelid,a.attnum,a.atttypid,a.attnotnull,a.attacl,a.attname,a.attgenerated,
    pg_get_expr(d.adbin,d.adrelid) AS default_expression FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname IN ('public','app_private') AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attrelid,a.attnum`)).rows);
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}
export async function cleanupPreconditions(c) {
  const locks=(await c.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app_private' AND p.proname='reject_immutable_mutation'`)).rows;
  if(locks.length!==1)blocked('IMMUTABILITY_HELPER_UNAVAILABLE');
  const triggers=(await c.query(`SELECT c.relname,t.tgname,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    AND t.tgname IN ('payment_audit_immutable','provider_events_immutable','receipts_immutable')`)).rows;
  if(triggers.length!==3||triggers.some(t=>!['O','A'].includes(t.tgenabled)))blocked('IMMUTABLE_TRIGGER_PRECONDITION');
  const known=['public.profiles','public.bookings','public.payments','public.offers','public.payment_receipts','public.payment_provider_events','public.payment_audit',
    'app_private.flight_booking_intents','app_private.flight_payment_initiations','app_private.flight_supplier_booking_executions','app_private.flight_supplier_ticketing_executions','app_private.flight_ticket_records','app_private.supplier_operations','public.traveler_tokens','public.fx_config'];
  const fks=(await c.query(`SELECT ns.nspname||'.'||child.relname AS child,nt.nspname||'.'||parent.relname AS parent
    FROM pg_constraint k JOIN pg_class child ON child.oid=k.conrelid JOIN pg_namespace ns ON ns.oid=child.relnamespace
    JOIN pg_class parent ON parent.oid=k.confrelid JOIN pg_namespace nt ON nt.oid=parent.relnamespace
    WHERE k.contype='f' AND nt.nspname IN ('public','app_private')`)).rows;
  if(fks.some(f=>known.includes(f.parent)&&!known.includes(f.child)))blocked('UNREVIEWED_CLEANUP_DEPENDENCY');
  const authGuards=(await c.query(`SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth'
    AND c.relname IN ('sessions','refresh_tokens','identities','audit_log_entries')
    AND NOT t.tgisinternal AND (t.tgtype & 8)<>0 AND t.tgenabled IN ('O','A')`)).rows;
  if(authGuards.length)blocked('UNREVIEWED_AUTH_DELETE_PROTECTION');
}
