# HAJIZ Migration Canonical State

This document records the read-only Staging Ground Truth captured from project `pdnuswmljownjzjzpoop` on 2026-08-27. It is documentation, not an instruction to apply or replay migrations. Production was not contacted.

## Live objects and canonical repository sources

| Object | Live Staging state | Canonical migration source | Replay verdict | Known remediation |
|---|---|---|---|---|
| `public.create_checkout` | Security V2 body; calls `app_private.is_allowed_checkout_return_url()`; `search_path = pg_catalog, public, app_private`; Bankak expiry is 24 hours | `20260825210000_payment_authority_security_v2.sql` | Do not replay the full migration | Confirm environment origins; centralize expiry configuration |
| `public.apply_payment_event` | PSP rejection body; non-Bankak `awaiting -> confirmed/rejected`; persists `p_occurred_at`; service-role only | `20260826200000_psp_rejected_transition_v1.sql` | Already applied; do not replay to synchronize history | Before remediation, a refused transition can consume `provider_event_id`, and PSP confirmation does not enforce `expires_at` |
| `public.apply_booking_transition` | Forward-only `payment_confirmed -> processing -> confirmed -> ticketed -> completed`; service-role only | `20260825173046_payment_authority_staging_v1.sql` | Never replay the base migration | None in this batch |
| `app_private.enforce_payment_transition` | Includes non-Bankak `awaiting -> rejected`; retains manual Bankak review transitions | `20260826200000_psp_rejected_transition_v1.sql` | Already applied; do not replay | Canonicalize together with the provider-event consumption fix |
| `app_private.enforce_booking_transition` | Strict full chain including `pending_payment -> payment_confirmed` | `20260825173046_payment_authority_staging_v1.sql` | Never replay the base migration | None in this batch |
| `app_private.can_upload_bankak_receipt` | Own authenticated user, Bankak, `awaiting`, unexpired | `20260825210000_payment_authority_security_v2.sql` | Do not replay the full migration | Derive from the canonical expiry policy |
| `public.register_inspected_receipt` | Service-role only; exact object path and unexpired Bankak payment; moves `awaiting -> under_review` | `20260825173046_payment_authority_staging_v1.sql` | Never replay the base migration | Derive from the canonical expiry policy |
| `receipts_insert_exact_path` | Authenticated INSERT only; exact owner/payment/file path, MIME and extension constraints; delegates payment authorization to `can_upload_bankak_receipt` | `20260825210000_payment_authority_security_v2.sql` | Do not replay the full migration | None in this batch |
| `public.payment_status` | `awaiting, under_review, confirmed, rejected, expired, refunded` | `20260825173046_payment_authority_staging_v1.sql` | Enum is already present; never replay base migration | Keep JS contracts exact |
| `public.booking_status` | `pending_payment, payment_confirmed, processing, confirmed, ticketed, completed` | `20260825173046_payment_authority_staging_v1.sql` | Enum is already present; never replay base migration | Reconcile My Trips `failed/cancelled` assumptions |

## Staging migration evidence

Staging records `psp_rejected_transition_v1` as applied under remote migration version `20260826174412`. The live `apply_payment_event` definition hash was `a5d15e047a5f6ca3d5ccd085abdd7c15`, and both rejection-related function bodies matched `20260826200000_psp_rejected_transition_v1.sql`.

Repository filename timestamps and remote migration-history versions are not assumed to be identical. Live definitions are the runtime authority.

## Replay classification

| Repository migration | Classification | Reason |
|---|---|---|
| `20260825173046_payment_authority_staging_v1.sql` | NEVER REPLAY on initialized Staging | Empty-database migration; would restore the broken provider-event insert and older generic return-URL validation |
| `20260825173703_payment_authority_staging_v1_checkout_fix.sql` | SUPERSEDED / NEVER REPLAY independently | Duplicate of the older checkout definition and would replace the Security V2 allow-list with a generic HTTPS regex |
| `20260825173551_payment_authority_staging_v1_advisor_hardening.sql` | NEVER REPLAY blindly | Contains non-idempotent policy/index creation against an already initialized database |
| `20260825210000_payment_authority_security_v2.sql` | CANONICAL SOURCE, NOT A REPLAY SCRIPT | The live security objects match it, but the whole file contains existing table/trigger/policy setup and must not be reapplied as a synchronization mechanism |
| `20260826200000_psp_rejected_transition_v1.sql` | APPLIED; DO NOT REPLAY | Staging already has its exact function behavior; repository-history synchronization is not a reason to replace live definitions |
| `20260827171209_payment_event_consumption_and_expiry_v1.sql` | CANONICAL REMEDIATION; NOT YET APPLIED | Additive function replacements make applicability precede provider-event consumption, enforce PSP confirmation expiry, and reject Bankak `awaiting -> confirmed` in the trigger |
| `20260827180646_multi_supplier_identity_and_operations_v1.sql` | APPLIED TO HAJIZ STAGING; RUNTIME GATE PASS | Recorded remotely as `20260827191245`; replayed by executing the same SQL a second time with no drift or duplicate objects. Adds provider-aware offer/booking identity, legacy and provider-scoped reference uniqueness, a private operation ledger, live-operation uniqueness, and immutable supplier identity/request guards. It changes no payment or booking enums or authority functions |
| `PLAN_ONLY_20260825_payment_authority.sql` | NEVER EXECUTE | Self-aborting plan artifact, not a runtime migration |

## Effective Bankak expiry

`create_checkout` writes Bankak `expires_at` as `now() + interval '24 hours'`. Upload authorization, inspected-receipt registration, and Finance review all require the payment to remain unexpired. No `pg_cron` extension, cron schema, or automatic expiry worker was present during the read-only inspection. Passing the deadline alone does not mutate payment status; a trusted transition is required.

## Deferred remediation

Integration V2 used ancestry-only merges `b57b055` and `6946102` to restore parentage already carried by descendant content. This technique must not be reused blindly when descendants do not carry the merged content.

Before `20260827171209_payment_event_consumption_and_expiry_v1.sql`, `apply_payment_event` did not enforce `expires_at` for a non-Bankak PSP confirmation. The additive remediation migration is now the canonical repository source for provider-event consumption ordering, PSP confirmation expiry enforcement, and the Bankak `awaiting -> confirmed` trigger restriction. It has not been applied to any environment.

1. Choose one canonical Bankak expiry duration and derive every gate from it.
2. Confirm real return origins and error mappings before runtime enablement.

## Deferred queue after Remediation Batch 1

P1 / pre-supplier: explicit Travelport enablement, persistent Travelport offer references, and `app_private` default privileges.

The multi-supplier migration was applied to HAJIZ Staging `pdnuswmljownjzjzpoop` as remote migration version `20260827191245`. The repository filename timestamp and Supabase remote registry version intentionally differ; both are canonical records. Runtime scenarios S1-S11 passed, browser isolation passed, Backend Core regression passed, confirmed payment remained distinct from supplier booking confirmation, and Travelport remained disabled. The same SQL executed a second time without drift or duplicate objects, and the synthetic transaction left zero artifacts.

Pre-production: checkout-origin seeding, refund booking lifecycle, `create_checkout` idempotency scope, Staging project-ref productionization, `PLAN_ONLY` relocation/handling, return URL query/hash product decision, and Bankak checkout UI scope.

Product and later orchestration: Insurance, FX, Packages, Partner Hold, supplier orchestration, and production supplier integration.

The closeout documentation itself made no database write. The Staging migration and runtime gate described above were completed in the preceding authorized validation step; Production was not contacted.
