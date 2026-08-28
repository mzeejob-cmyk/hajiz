# HAJIZ Deferred Technical Queue

These items are deliberately recorded without implementation in the Backend Core closeout.

## Pre-supplier enablement

- Add an explicit Travelport enable flag independent of credential presence.
- Remove `globalThis.fetch` as the Travelport client's implicit default; require explicit server injection.
- Persist Travelport offer and repricing references rather than retaining them in a process-local `Map()`.
- Add circuit breakers, supplier health scoring, and production SLA policy before real supplier enablement; Batch 2 already provides search timeouts, bounded concurrency, and failure isolation.

## Batch 2 review follow-ups

- **B2-02 — CLOSED FOR APPLICATION-LAYER PER-REQUEST CAPACITY SCOPE IN BATCH 7:** an abort-ignoring attempt retains its worker lease until actual settlement or the global deadline, so queued work cannot inflate true in-flight work within one request. **PRE-PUBLIC-PRODUCTION residual:** cross-request admission/rate limiting and preferably transport-enforced cancellation are still required because abandoned remote I/O may outlive a response, bounded per request by configured concurrency.
- **B2-03 — CLOSED IN BATCH 7:** a server-owned absolute global deadline now caps the search/request, bounds effective supplier deadlines, stops new launches, preserves safe completed results as PARTIAL, and absorbs late settlement.
- **B2-04 — CLOSED IN BATCH 3:** empty aggregation now fails closed in `overallStatus` and at the orchestrator boundary, with behavioral coverage.
- **B2-05 — PRE-REAL-SUPPLIER-ENABLEMENT:** add safe server-only provider diagnostics without leaking raw supplier errors to telemetry or clients.
- **B2-07 — CLOSED FOR APPLICATION PROJECTION BOUNDARY IN BATCH 3:** the grouped public projection maps every alternative through `toPublicFlightOffer`, requires authoritative customer prices, and has leakage tests. Frontend/customer endpoint reconciliation remains tracked by MS-09.

## Batch 3 review follow-ups

- **B3-02 — CLOSED IN BATCH 4:** conflicting duplicate identities are isolated without destroying unaffected alternatives; internal status degrades and conflict details remain private.
- **B3-03 — CLOSED IN BATCH 4:** authoritative customer-price resolution requires an own property through `Object.hasOwn` and validates `CustomerPriceV1` identity.

## Pricing policy and currency follow-ups

- **F-03 — CLOSED IN BATCH 5:** versioned pricing policy now requires trusted maximum bounds for `marginPct` and `agentUpliftAmountUsd` and fails closed when either value exceeds its configured maximum.
- **B5-01 — CLOSED IN BATCH 6:** mixed customer currencies now isolate only the affected fare group as UNRANKED with no preferred or cheapest alternative; all private alternatives remain retained and unaffected groups continue ranking.
- **B5-02 — CLOSED IN BATCH 6:** the final internal-offer-ID fallback now uses plain deterministic codepoint lexical comparison rather than `localeCompare`.
- **B5-03 — LOW / OBSERVABILITY:** the per-alternative bare catch does not retain an unrankable reason. Fold safe reason reporting into the diagnostics work.
- **B6-01 — CLOSED IN BATCH 7:** the explicit customer ID domain/version is now inside the canonical SHA-256 input.
- **B6-02 — CLOSED IN BATCH 7:** public customer IDs use recursive key-sorted canonical JSON with golden insertion-order vectors. Treat the post-B7 semantics as versioned; the public alternative ID is a search-result handle, not booking authorization.
- **B6-03 — CLOSED IN BATCH 7:** group display itinerary is derived from the first retained customer-visible alternative rather than an excluded private alternative.
- **B6-04 — INFO / EXPECTED / STALE PREFERRED:** if the ranked preferred alternative expires before projection, projection removes it and leaves surviving alternatives UNRANKED rather than promoting one. This is correct at the projection layer; any promotion requires fresh upstream ranking.
- **SUPPLIER CURRENCY COVERAGE — PRE-REAL-SUPPLIER-ENABLEMENT:** pricing currently supports only USD, AED, and SDG and fails closed for other supplier currencies. Extend coverage deliberately before enabling any supplier that may return EUR, GBP, or another currency.

## Pre-production

- **N-1 — LOW / HOST INTEGRATION:** remove or formally bind the handler-clock/orchestrator-`now` coupling when the real HTTP host is integrated.
- **N-2 — LOW:** define the canonical customer-ID serializer behavior for Date objects; current reviewed ID inputs are JSON-safe primitives and plain structures.
- **N-3 — LOW:** revisit the exact 503-vs-504 nuance for hung suppliers when production host/runtime behavior is known.
- **N-4 — LOW:** the framework-neutral handler returns 400 rather than 405 for non-POST input; decide at host/router integration.
- **N-5 — LOW:** reconcile server UTC calendar-date validation with Gulf customer timezone semantics before public launch.
- **N-6 — POLICY REQUIRED:** no approved total-passenger maximum exists; do not invent one before product/provider-neutral policy approval.
- **N-7 — LOW / TELEMETRY:** client disconnect currently shares timeout-classified internal handling; refine telemetry without changing public errors when host disconnect semantics exist.
- **PRE-PUBLIC-PRODUCTION HOST/INFRA:** enforce raw transport byte limits before JSON parsing, edge rate limiting, cross-request admission control, a host-supplied disconnect signal, and actual router/host deployment.

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
