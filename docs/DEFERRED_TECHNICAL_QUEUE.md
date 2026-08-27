# HAJIZ Deferred Technical Queue

These items are deliberately recorded without implementation in the Backend Core closeout.

## Pre-supplier enablement

- Add an explicit Travelport enable flag independent of credential presence.
- Remove `globalThis.fetch` as the Travelport client's implicit default; require explicit server injection.
- Persist Travelport offer and repricing references rather than retaining them in a process-local `Map()`.
- Add circuit breakers, supplier health scoring, and production SLA policy before real supplier enablement; Batch 2 already provides search timeouts, bounded concurrency, and failure isolation.

## Batch 2 review follow-ups

- **B2-02 — PRE-REAL-SUPPLIER-ENABLEMENT / CAPACITY:** an abort-ignoring remote supplier may leave underlying network I/O alive after the orchestrator has finalized its timeout outcome. Account for this in capacity planning and supplier-enablement review.
- **B2-03 — PRE-REAL-SUPPLIER-ENABLEMENT:** add an overall search deadline before enabled supplier count can create more than two queued timeout batches.
- **B2-04 — BATCH 3:** make empty aggregation fail closed; `overallStatus([])` must not return `COMPLETE`.
- **B2-05 — PRE-REAL-SUPPLIER-ENABLEMENT:** add safe server-only provider diagnostics without leaking raw supplier errors to telemetry or clients.
- **B2-07 — BATCH 3:** every customer-facing search surface must map private `FlightOfferV1` values through `toPublicFlightOffer` and test that public boundary.

## Pre-production

- Define secure default privileges for `app_private`.
- Seed and verify environment-specific checkout return origins.
- Define the refund-to-booking lifecycle.
- Tighten `create_checkout` idempotency scope.
- Replace Staging project-ref assumptions with productionized environment configuration.
- Relocate or otherwise make `PLAN_ONLY` migration handling unambiguous and non-executable.
- Decide whether checkout return URLs may contain query strings or fragments.
- Define Bankak checkout UI scope against the trusted receipt/review contracts.
- Remove or externalize the inactive legacy public Supabase configuration.

## Performance follow-up

- `app_private.supplier_operations.offer_id` covering index. The Supabase performance advisor reports that the foreign key lacks a covering index. Do not add it until an application query path uses `offer_id` and `EXPLAIN` or observed query behavior justifies it. This item does not block Multi-Supplier Batch 2.
