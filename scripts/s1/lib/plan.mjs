export const PROJECT = 'pdnuswmljownjzjzpoop';
export const HOST = 'aws-0-ap-northeast-1.pooler.supabase.com';
export const CA = 'C:/Users/mzeep/Downloads/prod-ca-2021.crt';
export const sections = ['B13 CONCURRENCY','B13 CRASH WINDOW','B14 CONCURRENCY','B14 CRASH WINDOW','PAYMENT AUTHORITY','BANKAK','PSP','RLS / IDOR','TICKET ARTIFACT GATE','MY TRIPS','EXPIRY'];
// Hard ceilings, NOT permissions to create additional scenarios. Checked BEFORE every COMMIT.
export const budget = Object.freeze({
  'public.payment_audit': 28, 'public.payment_provider_events': 5, 'public.payment_receipts': 1,
  'public.payments': 6, 'public.bookings': 6, 'public.offers': 1, 'auth.users': 3,
  'public.profiles': 0, 'app_private.flight_booking_intents': 0,
  'app_private.flight_payment_initiations': 0, 'app_private.flight_supplier_booking_executions': 0,
  'app_private.flight_supplier_ticketing_executions': 0, 'app_private.flight_ticket_records': 0,
  'app_private.supplier_operations': 0, 'storage.objects': 0,
  'auth.identities':0, 'auth.sessions':0, 'auth.refresh_tokens':0, 'auth.audit_log_entries':0
});
export const rpc = Object.freeze({
  intent: 'create_flight_booking_intent_v1', getIntent: 'get_flight_booking_intent_v1',
  preparePayment: 'prepare_flight_payment_initiation_v1', materialize: 'materialize_flight_payment_initiation_v1',
  event: 'apply_payment_event', receipt: 'register_inspected_receipt', review: 'review_bankak_payment',
  b13prepare: 'prepare_flight_supplier_booking_execution_v1', b13mark: 'mark_flight_supplier_booking_request_sent_v1',
  b13complete: 'complete_flight_supplier_booking_execution_v1', b13fail: 'record_flight_supplier_booking_failure_v1',
  b14prepare: 'prepare_flight_supplier_ticketing_v1', b14mark: 'mark_flight_supplier_ticketing_request_sent_v1',
  b14complete: 'complete_flight_supplier_ticketing_v1', b14fail: 'record_flight_supplier_ticketing_failure_v1'
});
export const tables = Object.keys(budget);
export const immutable = ['public.payment_audit','public.payment_provider_events','public.payment_receipts'];
export function assert(ok, label) { if (!ok) { const e = new Error('Assertion failed'); e.safeLabel = label; e.gate = 'FAIL'; throw e; } }
export function blocked(label) { const e = new Error('Gate blocked'); e.safeLabel = label; e.gate = 'BLOCKED'; throw e; }
