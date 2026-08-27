# HAJIZ Migration Canonical State

This document records the read-only Staging Ground Truth captured from project `pdnuswmljownjzjzpoop` on 2026-08-27. It is documentation, not an instruction to apply or replay migrations. Production was not contacted.

## Live objects and canonical repository sources

| Object | Live Staging state | Canonical migration source | Replay verdict | Known remediation |
|---|---|---|---|---|
| `public.create_checkout` | Security V2 body; calls `app_private.is_allowed_checkout_return_url()`; `search_path = pg_catalog, public, app_private`; Bankak expiry is 24 hours | `20260825210000_payment_authority_security_v2.sql` | Do not replay the full migration | Confirm environment origins; centralize expiry configuration |
| `public.apply_payment_event` | PSP rejection body; non-Bankak `awaiting -> confirmed/rejected`; persists `p_occurred_at`; service-role only | `20260826200000_psp_rejected_transition_v1.sql` | Already applied; do not replay to synchronize history | P0: a refused transition can consume `provider_event_id` before returning `false` |
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
| `PLAN_ONLY_20260825_payment_authority.sql` | NEVER EXECUTE | Self-aborting plan artifact, not a runtime migration |

## Effective Bankak expiry

`create_checkout` writes Bankak `expires_at` as `now() + interval '24 hours'`. Upload authorization, inspected-receipt registration, and Finance review all require the payment to remain unexpired. No `pg_cron` extension, cron schema, or automatic expiry worker was present during the read-only inspection. Passing the deadline alone does not mutate payment status; a trusted transition is required.

## Deferred remediation

1. P0: consume a provider event only when its transition is applied or it is a genuine duplicate.
2. Choose one canonical Bankak expiry duration and derive every gate from it.
3. Reconcile My Trips fallback states with the database enums.
4. Confirm real return origins and error mappings before runtime enablement.

No migration was applied and no database row was written while producing this document.
