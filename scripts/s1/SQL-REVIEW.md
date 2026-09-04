# Static SQL and network review

No statement in the execution modules uses CREATE, ALTER, DROP, TRUNCATE, GRANT, REVOKE, SET ROLE, SET session_replication_role, DISABLE TRIGGER or deferred constraints. No migration files are executed. Canonical migrations were read only as source contracts. All parameters are bound; dynamically interpolated table/function/column identifiers come exclusively from fixed in-source allowlists. No SQL from environment values, journal text, HTTP replies, or supplier input is evaluated.

## Statement families reviewed

| Module | Statements | Scope / reason |
|---|---|---|
| connection | SELECT * FROM fixed public RPC with positional parameters; SAVEPOINT / ROLLBACK TO / RELEASE | Existing canonical contracts; isolated negative tests |
| fixtures | INSERT offers; SELECT clock_timestamp; SELECT fixed joined booking/payment state and execution counts | One journaled mock offer; exact UUID/owner filters; no secrets in selected fields |
| runtime | BEGIN/COMMIT/ROLLBACK; SELECT execution state/counts by booking; negative UPDATE booking economics; UPDATE run payment expiry / intent validity / price snapshot / offer expiry; negative receipt DELETE | Economics/receipt mutations must fail and are rolled back. Expiry changes are synthetic setup only. No customer rows |
| competition | SELECT pg_backend_pid; BEGIN/ROLLBACK; SELECT bounded pg_stat_activity/pg_blocking_pids and clock_timestamp | Observe only B's PID; never collect query text or other sessions' data |
| inventory | SELECT safe columns from explicitly listed owned tables; scoped DELETE children; scoped UPDATE offer enabled=false; DELETE payments/bookings/offers only without required children | Minimum dependency closure. Immutable HAJIZ tables never deleted during cleanup |
| inventory Auth | DELETE synthetic user sessions/refresh tokens/identities and run-attributable mutable operational logs | Ordinary DELETE only, on exact fresh run actors; no secret column selected. Any protection failure stops cleanup; no bypass |
| runner / immutability | INSERT/UPSERT profiles only for new run actors; SELECT catalog functions, relations, constraints, columns, policies and triggers for pre/post hash and cleanup preconditions | Finance is a synthetic test identity, not a policy/grant change. Definition text retained only in memory for hashing; unexpected Auth delete triggers block before data creation |

## Tables touched directly or by existing RPCs

- public.profiles: Auth trigger creates; runner labels and initializes the synthetic finance/customer role; authenticated self-read and forbidden financial write tests; cleanup removes.
- public.offers: one synthetic row; expiry negative test; disabled at cleanup; retained only if referenced by necessary bookings.
- public.bookings, public.payments: B12 creates through real RPCs; trusted state transitions through real payment/B13/B14 functions. Cleanup follows immutable-child FKs.
- public.payment_audit, public.payment_provider_events, public.payment_receipts: created by canonical RPCs; no cleanup mutation. Ledger is mandatory.
- app_private.flight_booking_intents, flight_payment_initiations: B11/B12; bound negative expiry/price tests roll back; cleanup deletes only own rows.
- app_private.flight_supplier_booking_executions, flight_supplier_ticketing_executions, flight_ticket_records, supplier_operations: real B13/B14 RPCs and persisted-state verification; all deletable run rows removed.
- auth.users: normal Auth Admin lifecycle, safe id/email reads, retained only for required foreign keys; retained users banned.
- auth.identities, auth.sessions, auth.refresh_tokens, auth.audit_log_entries: Auth-managed lifecycle; narrowly scoped ordinary cleanup, no token/hash field selected or logged.
- storage.objects: only real Storage API creation/removal; SQL reads verify absence. No SQL fake objects or tables.
- public.fx_config: read transitively by B12 only if required; fixtures use SDG so no FX row is created/modified.
- pg_catalog.pg_proc, pg_namespace, pg_stat_activity, pg_class, pg_constraint, pg_policy, pg_trigger, pg_attribute, pg_attrdef: read only.

Auth/Storage may maintain service-internal metadata. Their exact version-dependent behavior is a runtime prerequisite: cleanup refuses success when its known scoped rows remain. Platform service logs outside application tables are not altered.

## RPC inventory

1. create_flight_booking_intent_v1
2. get_flight_booking_intent_v1
3. prepare_flight_payment_initiation_v1
4. materialize_flight_payment_initiation_v1
5. apply_payment_event
6. register_inspected_receipt
7. review_bankak_payment
8. prepare_flight_supplier_booking_execution_v1
9. mark_flight_supplier_booking_request_sent_v1
10. complete_flight_supplier_booking_execution_v1
11. record_flight_supplier_booking_failure_v1
12. prepare_flight_supplier_ticketing_v1
13. mark_flight_supplier_ticketing_request_sent_v1
14. complete_flight_supplier_ticketing_v1
15. record_flight_supplier_ticketing_failure_v1
16. get_my_bookings
17. get_my_payments
18. get_my_flight_ticketing_v1
19. get_my_flight_ticket_records_v1

Transitive canonical helpers/triggers: project_flight_supplier_booking_execution_v1, project_flight_supplier_ticketing_v1, is_staff, can_upload_bankak_receipt, handle_new_user, enforce_payment_transition, payment/booking economics and supplier-identity immutability, reject_immutable_mutation. Their definitions are not changed.

## Network allowlist

- PostgreSQL: only aws-0-ap-northeast-1.pooler.supabase.com:5432, postgres database, postgres.pdnuswmljownjzjzpoop user. TLS CA and hostname verification required.
- HTTPS: only pdnuswmljownjzjzpoop.supabase.co, redirects refused. Auth admin create/update/delete; password sign-in; user validation; logout; authenticated REST RPC/read/negative-write; receipts Storage upload/delete.
- No Edge Function, supplier, Travelport, Production, Legacy, webhook/payment-provider network calls, schema-changing statements, or migrations.

## Readiness classification

Static review is not database execution. Live schema/API incompatibility, unexpected residue/dependencies, missing grant, unobserved contention, or failed invariant stops the runner with FAIL/BLOCKED. Never grant new permissions or disable protections to turn a failure into a PASS.
