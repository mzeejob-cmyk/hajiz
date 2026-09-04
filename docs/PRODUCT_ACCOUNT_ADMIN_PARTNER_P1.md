# Product / Account / Admin / Partner P1 — canonical C1 verification

Verified locally on 2026-09-04. This document replaces historical P1 ancestry and test totals; no database or deployment was performed.

## Canonical ancestry and provenance

- RT-04 base: 57f0763093ba01b6a43b448adb43fd69e7b8c668.
- Hotels C1 checkpoint: da96cee73a0e2ebf390937968b7247cc23b01254.
- Product C1 checkpoint: 5e5aff204c7ae455f6f7a420251568ffe22124c9.
- Hotels source b76d62a133aba066278a93b3ff055857933e61f4 was ported with no-commit cherry-pick and package test-chain union.
- Product functional source fa887257f6fd7cbfc1b2b7560589f8fd01e23838 was selectively ported.
- 97073d40ae397ca9282525fe07f0a16ff5d90628 was not ported.
- e85430a96c180a430f44a156ad645f282befa18d was not cherry-picked.
- myTripsContract.js is byte-identical to RT-04. The historical Product hunk was explicitly restored away before the Product commit.
- Existing three-RPC My Trips test retained get_my_flight_ticketing_v1; Product's no-artifact download test was added unchanged.
- CSS is append-only; Admin change is navigation-only; no old Admin safe-port implementation was imported.

## Implemented boundaries

Account exposes only displayName and phone as editable profile fields. Profile/session actions remain disabled pending authenticated service wiring. Saved travelers, favorites and preferences are contract-pending; no fake persistence.
Partner is a Model B presentation shell: supplier net and wallet authority are excluded; KYC and payouts are non-mutating.
Packages/Offers are CMS presentation contracts with publishAuthority=false and dynamicBuilder=false.
Notifications validate contracts only, with provider-pending delivery.
Hotels remain synthetic=true, network=false, productionAllowed=false. hold_room and create_booking reject NOT_IMPLEMENTED_H2; continueToPayment is NOT_YET_WIRED. No fake hold.
RT-04 already supplies trusted ticketing projection; it is not deferred or replaced by hardcoded false. Download requires issued evidence and trusted artifact availability.

## Actual test registration and per-suite results

Every listed program is registered directly by package.json scripts.test using node scripts/<program>.mjs, chained with &&. run-tests additionally invokes supplier and Travelport conformance suites; those remain included in its count. test:hotels and test:staging-e2e aliases are retained.

| Program (scripts/*.mjs) | RT-04 | Hotels | Product | Fail | Skip |
|---|---:|---:|---:|---:|---:|
| run-tests | 130 | 130 | 139 | 0 | 0 |
| psp-adapter-tests | 21 | 21 | 21 | 0 | 0 |
| psp-sandbox-adapter-tests | 5 | 5 | 5 | 0 | 0 |
| staging-e2e-booking-tests | 4 | 4 | 4 | 0 | 0 |
| remediation-regression-tests | 8 | 8 | 8 | 0 | 0 |
| multi-supplier-persistence-tests | 10 | 10 | 10 | 0 | 0 |
| multi-supplier-search-tests | 25 | 25 | 25 | 0 | 0 |
| multi-supplier-grouping-tests | 26 | 26 | 26 | 0 | 0 |
| pricing-fx-tests | 36 | 36 | 36 | 0 | 0 |
| ranking-selection-tests | 16 | 16 | 16 | 0 | 0 |
| customer-flight-search-tests | 18 | 18 | 18 | 0 | 0 |
| customer-flight-search-http-tests | 17 | 17 | 17 | 0 | 0 |
| flight-results-frontend-tests | 30 | 30 | 30 | 0 | 0 |
| flight-offer-reprice-b9-tests | 43 | 43 | 43 | 0 | 0 |
| flight-checkout-traveler-b10-tests | 35 | 35 | 35 | 0 | 0 |
| flight-booking-intent-b11-tests | 41 | 41 | 41 | 0 | 0 |
| flight-booking-intent-b11-gatea-tests | 15 | 15 | 15 | 0 | 0 |
| flight-payment-initiation-b12-tests | 63 | 63 | 63 | 0 | 0 |
| flight-supplier-booking-execution-b13-tests | 72 | 72 | 72 | 0 | 0 |
| flight-ticketing-confirmation-b14-tests | 81 | 81 | 81 | 0 | 0 |
| hotel-v2-tests | 0 | 17 | 17 | 0 | 0 |

Totals: 696 baseline, 713 after Hotels, 722 after Product. Product adds eight presentation/contract tests and one My Trips test; no existing test body removed or weakened. LOST=0; SKIPPED=0.
Full npm test, build, lint, working/staged diff checks PASS. Hotels direct run: 17/17. G8 frozen hashes: PASS.
No skip/focus markers or commented-out tests found; apparent block-comment scan hits were route strings and regex character classes.

## Executed invariants

- Payment confirmed is not supplier-booking confirmed; lifecycle unchanged.
- Payment alone, PNR alone, supplier reference alone, and ticketed without trusted artifact cannot download.
- Trusted issued ticketing with available artifact can download; UNKNOWN fails closed.
- B13/B14 suites execute no-blind-retry/reissue, unknown reconciliation, ticket metadata boundaries and artifact validation.
- Pricing suite verifies Model B (net 100, market 110, final 115, base commission 2, uplift 5, total commission 7, Hajiz margin 8).
- Additional local probe rejects negative uplift; wallet balances are not converted into commission; supplier economics remain internal.
- Existing browser authority and PII tests pass. C1 introduces no PII persistence; existing server-side booking/traveler persistence is unchanged.

## Remaining P2 / limitations

Requires separately approved profile/session wiring, saved-traveler/favorites ownership and storage, role-aware Admin reads, Partner/KYC/commission/payout services, CMS publishing, notification provider/outbox and artifact delivery integration. No live supplier or operational production-readiness claim.
See C1_CANONICAL_MIGRATION_LEDGER.md for historical migration mapping. That ledger is documentation only; original runtime-era docs remain historical snapshots, not current deployment instructions.
