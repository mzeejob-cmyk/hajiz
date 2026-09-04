# HAJIZ C1 Canonical Migration Ledger

Documentation only, 2026-09-04. No SQL execution, schema write, Supabase connection, Staging/Production mutation or deployment occurred in C1.

## Evidence and interpretation

Local paths and introducing commits were read from Git in the LF-safe C1 worktree. All SQL contents remain exactly from RT-04 (57f0763093ba01b6a43b448adb43fd69e7b8c668).
"Source commit" below means the introducing commit in canonical ancestry, not necessarily the final modifying commit; the effective local content is the RT-04 snapshot.
Staging versions below are historical observations carried forward from the preceding reconciliation, not a fresh remote inspection in C1. Project: pdnuswmljownjzjzpoop. APPLIED LOGICALLY means historical logical-name correspondence, NOT proof that raw remote SQL hashes equal local file bytes.
Do not interpret older CODE-ONLY / NOT YET APPLIED statements in runtime-era documents as current deployment instructions. In particular B11, B12 and payment-event consumption have later historical applied mappings below.
Production state is not revalidated here; this ledger authorizes nothing on Production.

## Mapping

All local filenames are under supabase/migrations/.

| Local filename | Logical migration name | Source commit (introduced) | Historical Staging version | Effective authority | Status |
|---|---|---|---|---|---|
| 20260825173046_payment_authority_staging_v1.sql | payment_authority_staging_v1 | d56c16da33173a010156adcce77c3e1c69bb9ad9 | 20260825173443 | Base enums/transition authority; checkout and event bodies superseded | APPLIED LOGICALLY; NEVER REPLAY |
| 20260825173551_payment_authority_staging_v1_advisor_hardening.sql | payment_authority_staging_v1_advisor_hardening | d56c16da33173a010156adcce77c3e1c69bb9ad9 | 20260825173613 | Historical advisor hardening; initialized policy/index objects | APPLIED LOGICALLY; NEVER REPLAY |
| 20260825173703_payment_authority_staging_v1_checkout_fix.sql | payment_authority_staging_v1_checkout_fix | d56c16da33173a010156adcce77c3e1c69bb9ad9 | 20260825173751 | SUPERSEDED by Security V2 checkout allow-list | SUPERSEDED; NEVER REPLAY |
| 20260825210000_payment_authority_security_v2.sql | payment_authority_security_v2 | 11b547e2108d4bc947ce02844ecb334450c4b09a | 20260825175325 | Security V2 checkout/receipt boundary, later event fixes compose | APPLIED LOGICALLY |
| 20260826200000_psp_rejected_transition_v1.sql | psp_rejected_transition_v1 | 3c9eef59a69bfa3eb5b84564f8726dc10d0d611f | 20260826174412 | PSP rejection transition, event body superseded by consumption/expiry fix | APPLIED LOGICALLY |
| 20260827171209_payment_event_consumption_and_expiry_v1.sql | payment_event_consumption_and_expiry_v1 | 2aa6d3c42af57c612e36ac83d718b530f26c2cca | 20260827134213 | Current event applicability/consumption ordering and expiry authority | APPLIED LOGICALLY |
| 20260827180646_multi_supplier_identity_and_operations_v1.sql | multi_supplier_identity_and_operations_v1 | a1c6054a8c433ec1250eda4c3d5e7113502505f5 | 20260827191245 | Provider identity and private supplier operation ledger | APPLIED LOGICALLY |
| 20260829120000_flight_booking_intents_v1.sql | flight_booking_intents_v1 | 88efbd9ee107b9ce3b26f5022323ecd9c42c7a6c | 20260831165725 | Private booking intent; RT-04 snapshot includes later Gate-A hardening | APPLIED LOGICALLY |
| 20260829183000_flight_payment_initiation_v1.sql | flight_payment_initiation_v1 | 81b383463882e30232fdc4b8ffcf4f13f23cde81 | 20260831165816 | Private payment initiation; RT-04 snapshot includes later Gate-A hardening | APPLIED LOGICALLY |
| 20260829213000_flight_supplier_booking_execution_v1.sql | flight_supplier_booking_execution_v1 | a9ddbede637e45f8b3ddb7b9be1107dbe6ab8859 | 20260831170046 | Private supplier execution; accepted/UNKNOWN functions superseded by RT-01/RT-03 | APPLIED LOGICALLY |
| 20260830090000_flight_ticketing_confirmation_v1.sql | flight_ticketing_confirmation_v1 | 54adb2e2ed395ae1642637e92f6bdd93a8dc9714 | 20260831170139 | Private ticket evidence; issued function superseded by RT-04 | APPLIED LOGICALLY |
| 20260831183000_fix_flight_supplier_booking_execution_accepted_persistence.sql | fix_flight_supplier_booking_execution_accepted_persistence | 290f5cf544aabfe129c19de88c75d6715aa25ad7 | 20260831174408 | Effective accepted-result persistence correction | APPLIED LOGICALLY |
| 20260831190000_fix_flight_supplier_booking_failure_unknown_persistence.sql | fix_flight_supplier_booking_failure_unknown_persistence | 18badb5a9bf529aab38ae739c6cd8b384e9878ab | 20260831180657 | Effective UNKNOWN failure persistence correction | APPLIED LOGICALLY |
| 20260831193000_fix_flight_supplier_ticketing_issued_persistence.sql | fix_flight_supplier_ticketing_issued_persistence | 57f0763093ba01b6a43b448adb43fd69e7b8c668 | 20260901160250 | Effective issued-ticket persistence correction | APPLIED LOGICALLY |
| PLAN_ONLY_20260825_payment_authority.sql | payment_authority | b603e63b5f288696a52072397d11a023e4661c55 | not applied | No runtime authority | NEVER REPLAY |

## Never-replay and supersession rules

- Base payment_authority_staging_v1 is not a synchronization script: replay can restore the broken legacy provider-event insert (11 columns / 10 values) and older checkout URL policy.
- Historical checkout_fix would overwrite the Security V2 allow-list with old generic HTTPS validation. NEVER REPLAY independently.
- Advisor hardening contains already-created policy/index objects; never replay blindly.
- Security V2 and PSP-rejection whole files must not be replayed to synchronize timestamp histories.
- Payment event consumption/expiry is the later event-function authority; do not restore its predecessors.
- B13 original completion/failure functions must not replace RT-01/RT-03 corrections.
- B14 original completion must not replace RT-04.
- PLAN_ONLY_20260825_payment_authority.sql is a self-aborting plan, not an executable deployment migration.
- Different local and remote timestamps are not missing migrations. No duplicate application, db push, renormalization, or SQL edits were performed.
- Before any separately authorized future deployment, obtain fresh read-only remote definitions/history and classify unresolved rows as NEEDS MANUAL MAPPING or UNKNOWN. This historical ledger alone is insufficient deployment evidence.

## C1 immutability

No migration SQL changes. G8 frozen eight-file SHA-256 gate passed after LF recovery and in both integrated test checkpoints.
Hotels and Product add presentation/contracts only; no new database objects or migration files.
