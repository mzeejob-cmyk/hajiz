-- PLAN ONLY / NOT APPLIED / UNSUITABLE FOR PRODUCTION UNTIL STAGING REVIEW.
-- This guard intentionally makes accidental execution fail before any mutation.
do $$ begin
  raise exception 'PLAN ONLY: reconcile schema and validate in staging before creating an executable migration';
end $$;

-- Proposed operations below are deliberately comments, not executable migration SQL.
--
-- 1. REVOKE INSERT, UPDATE, DELETE on public.bookings and public.payments from anon, authenticated.
-- 2. REVOKE client writes to booking fields: net_cost, sold_price, currency, fx_rate_sdg,
--    agent_profit, commission, status, pay_method, reference and supplier metadata.
-- 3. Create customer-safe booking/payment views containing only display-safe projections.
-- 4. Create protected payment_intents/provider_events/payment_audit tables with:
--      unique(user_id, idempotency_key), unique(provider, provider_event_id),
--      immutable method/provider metadata, trusted amount/currency/FX snapshot,
--      transition constraints, timestamps and actor/reason fields.
-- 5. Implement SECURITY DEFINER server-only create_checkout that authenticates the caller,
--    resolves and reprices a trusted offer, generates references, and atomically inserts
--    booking=pending_payment plus payment=awaiting. Pin search_path and revoke PUBLIC execute.
-- 6. Permit only trusted server commands to apply payment/booking transitions. Finance/admin
--    review must use a protected role source. Confirmed payment may set only payment_confirmed.
-- 7. REVOKE client writes to fx_config and profile privilege/role/commission fields. Split
--    self-editable profile fields into an allow-listed function or separate table.
-- 8. Make audit storage append-only to trusted server roles; deny client INSERT/UPDATE/DELETE.
-- 9. Keep storage bucket receipts private. Replace broad object policies with a server-signed
--    upload or a policy bound to user_id/payment_id and an awaiting Bankak payment. Enforce
--    generated path, no overwrite/list/public read, <= 10 MB, and detected JPEG/PNG/PDF only.
-- 10. Never grant or expose service_role to browser code. Add policy tests for anon,
--     authenticated owner/non-owner, finance, admin, webhook worker, and supplier worker.
--
-- Required staging work: inventory current policies/functions/triggers; reconcile column types;
-- backfill invalid rows; test locks/rollback/idempotency; validate storage MIME enforcement;
-- rehearse deployment and rollback; security-review every SECURITY DEFINER function.
