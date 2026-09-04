# HAJIZ — local S1-B execution bundle

This directory publishes the local harness used to produce the preserved S1 runtime
artifacts under `docs/evidence/s1/`. Publishing and validating this harness does not
rerun S1-A, S1-C0, or S1-B. No Hotels H2 or Product P2 is started.

## Local commands

Use the PowerShell process that already contains the approved database secret.

```powershell
node .\scripts\s1\run-s1b.mjs --plan
```

After reviewing the budget, prerequisites, and SQL-REVIEW.md:

```powershell
node .\scripts\s1\run-s1b.mjs --execute-staging
```

Recovery cleanup ONLY (substitute the printed run identifier, not a path):

```powershell
node .\scripts\s1\run-s1b.mjs --cleanup S1B_TIMESTAMP_RANDOM
```

Do not start a second run to recover a failed run. Preserve output/run-id/journal.json.
Do not edit that journal. Cleanup is scoped to its exact synthetic identities and offer.

## Environment and prerequisites

- Node 20+ (fetch and AbortSignal.timeout required).
- Install the pinned local dependency with `npm ci --prefix .\scripts\s1` before a future authorized local run.
- HAJIZ_STAGING_DATABASE_URL: existing process-only secret, exact approved session pooler port 5432.
- HAJIZ_STAGING_ANON_KEY: project-bound legacy anon JWT from the SAME Staging project.
- HAJIZ_STAGING_SERVICE_ROLE_KEY: project-bound legacy service_role JWT from the SAME Staging project. Only used for synthetic Auth lifecycle and Storage cleanup; NEVER RLS evidence.
- HAJIZ_STAGING_PUBLISHABLE_KEY: current `sb_publishable_...` key from the SAME Staging project. Used as the public API-gateway `apikey` for Auth/REST/Storage. User access JWTs, when present, are sent independently in `Authorization`.

C1 exposes no anon-readable Data API table/view/RPC: it revokes anon table access and grants its user-facing read RPCs only to `authenticated`. Therefore the PostgREST root is not used as a publishable-key probe. Public REST is recorded as `NOT_APPLICABLE_BY_SCHEMA`; the first real REST proof calls the canonical read-only `get_my_bookings()` RPC as newly authenticated synthetic User A, before business fixtures exist, and requires an empty result.
- CA: C:\Users\mzeep\Downloads\prod-ca-2021.crt. Loaded directly; never copied into a repository.
- The published evidence was produced against canonical C1 commit `61c1c760efc5b098334046166b383b5f3fa154dd`.
- Auth email/password login and Admin API must be available. No real email is sent: users are created email-confirmed with generated passwords and @example.invalid addresses.
- Existing receipts bucket/policies must permit legitimate synthetic uploads; no bucket or policy is created.
- PostgreSQL role must support existing RPCs, catalog observations and ordinary run-scoped cleanup. No new grants are issued.

Use set-auth-env.ps1 for the two legacy JWT keys and set-publishable-env.ps1 for the publishable key. Both use Read-Host -AsSecureString and set only the current PowerShell process. Never put values in source, .env files, commands, chat or screenshots. The database URL is not rebuilt or printed.
Opaque new-format API keys are intentionally rejected: this bundle requires offline project binding from JWT claims before sending them. JWT signatures are validated by the official service, not by the local claim check.

## Isolation / test matrix

Run ID: S1B_<UTC timestamp>_<random suffix>. All reference/idempotency strings include it. Generated booking/payment IDs are journaled before commit. Auth email intentions are journaled before create-user requests, allowing recovery by exact email if the response is lost.

Three synthetic Auth actors: A, B, FINANCE. Random passwords/access tokens exist only in memory. A/B use actual password sign-in, /auth/v1/user and authenticated REST RPC requests. FINANCE is a newly created test profile only; no existing user or security policy is changed. Its commission remains the canonical default zero.

One shared mock SDG offer; 2600 market price, 2300 supplier cost. No FX configuration is edited. Six committed booking/payment fixture lineages plus two rollback-only lineages:

| Fixture | Objective / expected state | Owner |
|---|---|---|
| crash13 | paid -> REQUEST_SENT -> closed workers -> UNKNOWN; no blind retry | A |
| issued | B13 ACCEPTED; B14 REQUEST_SENT -> closed workers -> UNKNOWN -> trusted ISSUED/AVAILABLE | A |
| none | real ISSUED, artifact NONE, download false | A |
| metadata | real ISSUED, METADATA_ONLY, download false | A |
| bankak | awaiting -> under_review -> finance confirmed; booking only payment_confirmed | A |
| rejected (ROLLBACK ONLY) | awaiting -> rejected; duplicate/confirmed retry ineffective; cross-payment event reuse denied | A |
| expired (ROLLBACK ONLY) | server-time expiry -> expired; future client event time cannot revive payment | A |
| ownerb | positive B-owned booking/payment visibility and reciprocal IDOR tests | B |

Payment-only assertions reuse crash13 BEFORE supplier execution and the Bankak fixture AFTER finance confirmation. No separate convenience payment-only fixture is retained. FINANCE remains a distinct identity to avoid elevating A or B during customer isolation proofs.

Negative economics, pre-send failures, invalid/partial/duplicate ticket evidence, PSP rejection and expiry cases use rollback transactions/savepoints wherever cross-session visibility is unnecessary. They do not create additional committed lineages. Expired Bankak upload requires a committed synthetic expiry adjustment, restored before receipt processing; no historical audit or financial field is changed.

## Concurrency and crash proof

Each competing pair gets distinct pg.Client instances, not a pool. A performs an existing RPC and holds its transaction. B begins and calls the competing RPC. A third observer must see B waiting on a Lock with pg_blocking_pids(B) containing A. No COMMIT is permitted until that observation. The report records PIDs, server timestamps, xact_start/query_start, transaction boundaries, exact allowlisted result fields, and persisted row counts.

prepare, mark, failure and complete are tested with real contention for B13 and B14. REQUEST_SENT is committed and both sender connections are closed before a NEW recovery connection inspects state. No supplier response/network call is fabricated as a real external effect. The crash modeled is loss of the application session after durable request marking, not a database-server crash or live Travelport execution. Recovery explicitly records UNKNOWN through the existing failure RPC; it does not assert an automatic timeout worker exists. B14 receives synthetic trusted completion evidence only after UNKNOWN persistence has been read back.

## Residue ceilings declared before any write

| Table | Maximum immutable/dependency residue |
|---|---:|
| public.payment_audit | 28 |
| public.payment_provider_events | 5 |
| public.payment_receipts | 1 |
| public.payments | 6 |
| public.bookings | 6 |
| public.offers | 1 |
| auth.users | 3 |
| Every other table in plan.budget | 0 |

The successful path reaches these exact root counts: 28 payment_audit rows, 5 provider events, 1 receipt. Five payments are required by provider events; the sixth is required by the receipt. Every retained parent must have a concrete dependency child, never a convenience justification. Total maximum retained application/identity records: 50 (28+5+1+6+6+1+3). All other owned data must be removed or the gate does not PASS.
Budget checks occur within each SQL transaction BEFORE COMMIT; an over-budget transaction rolls back. The finance HTTP review reserves one audit row before the call. No automatic retry creates another scenario. Auth creation is capped at exactly three calls, storage one intended successful object, receipt consumption one successful registration.

## Cleanup and minimal closure

1. Snapshot safe IDs/dependencies before deletion; no raw Auth rows or token columns.
2. Remove run-scoped uploaded object bytes through Storage API and verify metadata absent.
3. Sign out synthetic sessions; ban synthetic users so retained identities cannot log in. Access tokens are not serialized; PostgreSQL cleanup removes remaining run-owned sessions/refresh tokens/identities using ordinary DELETEs (no trigger/policy bypass).
4. Disable only the shared synthetic mock offer; delete ticket records, ticket executions, booking executions, supplier operations, payment initiations and intents in FK order.
5. Delete payments without immutable event/receipt children, then unneeded bookings/offers and profiles. Never DELETE/UPDATE payment_audit, payment_provider_events or payment_receipts except a rolled-back negative receipt-delete test that must be rejected by the existing trigger.
6. Delete unneeded synthetic Auth users through Admin API. Mutable Auth operational logs attributable by exact synthetic actor IDs/usernames are deleted by ordinary scoped DELETE; no historical/pre-existing actor is selected. If an existing protection prohibits deletion, cleanup fails rather than bypassing it.
7. Verify remaining rows form only the FK parent closure of immutable records. Audit aggregate/actor IDs are logical references, not an excuse to retain deletable rows. Ledger preserves these identifiers even after the aggregate is deleted.
8. Attempt B13/B14 prepare against each retained booking in rolled-back transactions: both must reject missing execution lineage. Verify mock provider, disabled offer, and zero execution/operation rows. The pinned canonical mock adapter declares network=false and productionAllowed=false. No provider fallback or live supplier import is used.

Each ledger entry contains run, table/id, synthetic owner, parent/child edges, prohibition reason, test association, no-live eligibility, no-real-PII and no-production relevance. Cleanup PASS never means zero immutable residue. On an interrupted run, the partial ledger is not a zero-residue proof; use recovery cleanup and retain reports.

## Outputs

output/<run>/pre-execution-plan.json, journal.json, evidence.json, residue-ledger.json, result.json, S1-B-REPORT.md.
Only allowlisted diagnostics and synthetic records are serialized. No error messages, raw error objects, request headers, DB URL, API keys, tokens or passwords are written. On error: stop new tests, attempt cleanup, report FAIL/BLOCKED without softening mandatory gates.

## Known pre-execution blockers / limits

- Required Auth keys may not yet be present; no request for secrets in chat.
- Runtime permissions, Storage behavior, Auth-internal cleanup compatibility and lock observation must be verified by the LOCAL run. A disagreement fails closed; do not weaken security to pass.
- This is not proof that downloaded PDF bytes constitute a valid ticket; synthetic AVAILABLE metadata exercises C1's artifact authority/projection, with no real storage target.
- Edge receipt inspection deployment/invocation is not exercised. Bankak uses real Storage upload plus existing trusted registration/finance RPCs; no mock table/function substitute.
- Forced power loss cannot guarantee completion of cleanup. Journal + separate cleanup mode is the recovery mechanism; incomplete cleanup prevents PASS.
- Bundle readiness is static only. Actual S1-B result remains NOT RUN until local output is reviewed.

No migrations, DDL, grants, policy changes, live supplier calls, Production or Legacy access are present in the execution path.
