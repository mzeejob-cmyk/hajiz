# HAJIZ S1 runtime evidence closeout

This document indexes original runtime artifacts for independent review. It does not turn runtime assertions into independent Git proof.

## Canonical baseline

- Branch: `integration/c1-canonical`
- C1 base: `61c1c760efc5b098334046166b383b5f3fa154dd`
- Canonical C1 product suite: 722/722 PASS.
- S1 local harness offline regression suite: 19/19 PASS. This suite is separate from the 722 product tests.

## Gate record

- S1-A: MATCH/PASS according to the [original ground-truth report](s1-a/S1-A-STAGING-GROUND-TRUTH.md).
- S1-C0: PASS according to the [original PowerShell output](s1-c0/S1-C0-POWERSHELL-OUTPUT.txt). Two persistent sessions, distinct backend PIDs 1036690 and 1036692, overlapping read-only transactions, rollback and post-rollback probes passed with TLS verification enabled.
- Targeted EXPIRY: PASS — `S1B_EXPIRY_20260904T195546899Z_c5b8d5e5`.
- Full S1-B: PASS — `S1B_20260904T195834511Z_ecc45498`.

Full S1-B sections: B13 concurrency PASS; B13 crash window PASS; B14 concurrency PASS; B14 crash window PASS; payment authority PASS; Bankak PASS; PSP PASS; RLS/IDOR PASS; ticket artifact gate PASS; My Trips PASS; expiry PASS. Cleanup PASS.

## Historical failure accounting

`S1B_20260904T193653536Z_795dfb89` remains an original runtime FAIL artifact. It is invalidated for final gating by a confirmed harness defect: the harness set expiry using `clock_timestamp() - interval '1 second'` inside a long transaction while `apply_payment_event` correctly compared `expires_at` with `now()` / transaction-timestamp semantics. C1 product code was not changed.

The subsequent targeted harness initially failed only in `POST_ROLLBACK_RESIDUE_CHECK`: `flight_booking_intents.booking_intent_id` is the public text `hbi_v1_*` token, while `flight_payment_initiations.booking_intent_id` is a UUID FK to `flight_booking_intents.id`. The corrected verifier resolves the internal UUID first. This was not a product or schema regression.

## Successful-run residue

Immutable synthetic residue is expected because C1 prevents deletion of immutable payment records. Final counts: `auth.users=3`, `public.bookings=6`, `public.offers=1`, `public.payment_audit=28`, `public.payment_provider_events=5`, `public.payment_receipts=1`, `public.payments=6`.

These equal or remain within the declared maxima: payment audit 28; provider events 5; receipts 1; payments 6; bookings 6; offers 1; Auth users 3.

- REAL PII RETAINED: NO
- LIVE-SUPPLIER-ELIGIBLE TEST DATA RETAINED: NO
- PRODUCTION TOUCHED: NO — runtime-artifact evidence; independent reviewer must verify.
- LEGACY TOUCHED: NO — runtime-artifact evidence; independent reviewer must verify.
- LIVE SUPPLIER TOUCHED: NO — runtime-artifact evidence; independent reviewer must verify.

## Artifact index

- Successful targeted expiry: `targeted-expiry/S1B_EXPIRY_20260904T195546899Z_c5b8d5e5/expiry-evidence.json`
- Successful full S1-B: `full/S1B_20260904T195834511Z_ecc45498/`
- Preserved historical FAIL: `historical-fail/S1B_20260904T193653536Z_795dfb89/`
- Reproducible harness and offline tests: `../../../scripts/s1/`

Next action: Claude independent S1 closeout review. This document does not approve Hotels H2 or Product P2.
