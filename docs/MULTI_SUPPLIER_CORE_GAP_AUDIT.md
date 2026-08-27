# HAJIZ Multi-Supplier Core Gap Audit

## Scope and target

This is a read-only architecture audit of the current supplier registry, flight adapter contract, mock and Travelport adapters, normalization, public mapping, booking orchestration, database fields, and frontend consumption. It does not enable Travelport, change pricing or FX, add a supplier, or introduce a migration.

Target flow:

`Customer Search -> Search/Comparison Layer -> Supplier Orchestrator -> Multiple Supplier Adapters -> Canonical Offer Normalization -> Deduplication -> HAJIZ Pricing -> FX -> Final Customer Price -> Ranking -> Booking Provider Selection`

## Current architecture

The server has a provider-neutral flight adapter boundary and private normalized offer shape. A registry validates adapters, but normal selection returns exactly one configured default supplier. Both mock and Travelport adapters normalize into the same private shape, and `toPublicFlightOffer` removes provider identity, raw status, private metadata, and supplier economics before browser exposure. Booking orchestration accepts one already-selected supplier and preserves the frozen payment/booking state boundaries.

The active customer flight UI remains fixture-driven and does not consume the server supplier layer. Its presentation shape is provider-neutral, although it includes UI-owned fields such as `key`, `rankingLabel`, `additionalOptionsCount`, `flexibility`, and formatted price/duration values that are not produced by the current public mapper.

## Exact audit answers

1. **Can more than one supplier be queried in one search today?** No. `selectSupplierForClientRequest` returns `getConfiguredFlightSupplier()`, which resolves one default adapter.
2. **Is supplier execution parallel/sequential?** Neither multi-supplier mode exists. Calls against the selected adapter are sequential. There is no fan-out scheduler.
3. **Is there a canonical `FlightOffer` contract independent of provider?** Partially. Mock and Travelport emit the same private normalized shape, and the public mapper has a frozen field allow-list. There is no single validator covering every private offer field, version, fare conditions, or identity rule.
4. **Can two supplier offers for the same physical itinerary coexist?** In memory, yes as separate normalized objects. In persistence, identity is incomplete: `offers.supplier_offer_ref` is globally unique and no provider column disambiguates equal references. There is no itinerary grouping identity.
5. **Is there any dedup/grouping logic?** No.
6. **Is ranking currently supplier-neutral?** No authoritative ranking exists. Fixture labels are manually assigned in frontend data.
7. **Does ranking occur before or after HAJIZ authoritative pricing?** It does not occur in the server pipeline. The public mapper accepts an externally supplied server price, but no comparison/ranking stage follows it.
8. **Does frontend code depend on supplier-specific fields?** Active frontend code does not depend on supplier/provider fields. It does depend on a fixture presentation shape not yet supplied by the backend public mapper.
9. **Is supplier identity safely internal while still available to backend operations?** It is hidden correctly from public offers and present in adapter results. It is not durably modeled on `offers` or `bookings`; booking metadata can carry it, but that is not a typed selection boundary.
10. **What supplier identifiers must be persisted?** Provider name, provider offer reference, opaque provider repricing context (Travelport transaction/offering/product identifiers), expiry, HAJIZ offer ID, selected provider at booking, provider booking reference, and stable operation/idempotency identity. Raw provider payloads should not become public records.
11. **What breaks with multiple processes?** Travelport search references disappear because they live in a process-local `Map()`. Mock booking/idempotency and status-read state also live in process-local maps. A reprice, booking retry, or status poll routed to another process cannot resolve the prior identity.
12. **What prevents one failing/slow supplier from blocking all search?** Nothing, because no multi-supplier orchestration exists.
13. **What timeout/error isolation exists per supplier?** None in the supplier contract or Travelport client. There is no timeout, abort signal, per-provider deadline, circuit state, concurrency budget, or partial-result policy.
14. **How are provider-specific capabilities represented?** Boolean capability flags on each adapter. They are validated against a fixed vocabulary and fail closed, but have no richer constraints such as timeout policy, market/content scope, or booking mode.
15. **What is missing for future hotel multi-supplier mapping?** A hotel-specific canonical domain contract, room/rate-plan identity, occupancy and board normalization, cancellation/refundability semantics, tax/fee normalization, availability expiry, dedupe keys, capability tests, and a public mapping boundary. The current `hotels_search` flag is only reserved and disabled.
16. **What changes require additive schema migration?** Typed provider identity on offers and bookings; composite provider/offer uniqueness; and durable supplier-operation attempt/idempotency records for multi-process booking execution. Existing state enums and payment tables do not need alteration.
17. **What can remain application-layer only?** Fan-out scheduling, bounded parallelism, timeouts, partial-result aggregation, canonical normalization validation, itinerary fingerprints, dedupe/grouping, HAJIZ pricing/FX invocation, final-price ranking, health policy, and provider capability routing can begin in server code. Persistence is needed only at durable selection/operation boundaries.
18. **What frozen contracts must not be touched?** Payment states and authority, booking states and forward-only transitions, provider-event uniqueness/idempotency, Bankak review authority, payment expiry, customer inability to select providers, adapter prohibition on direct database mutation, and the rule that confirmed payment is only `payment_confirmed` booking state.

## Gap register

| ID | Severity | Gap | Required phase |
|---|---|---|---|
| MS-01 | P0 | Registry selects one default; no multi-adapter search orchestrator | Multi-Supplier Search Core |
| MS-02 | P0 | Travelport offer/reprice references are stored in a process-local `Map()` | Pre-supplier persistence |
| MS-03 | P0 | No per-supplier timeout, cancellation, or failure isolation | Multi-Supplier Search Core |
| MS-04 | P0 | Durable booking operation/idempotency state is absent across processes | Booking Provider Selection |
| MS-05 | P1 | No canonical private-offer validator/version or stable HAJIZ offer identity | Canonical Normalization |
| MS-06 | P1 | No provider-aware persistent offer or booking identity | Additive persistence migration |
| MS-07 | P1 | No itinerary/fare deduplication or grouping | Deduplication |
| MS-08 | P1 | No authoritative pricing -> FX -> final price -> ranking pipeline | Pricing and Ranking |
| MS-09 | P1 | Frontend fixture shape and server public-offer shape are not reconciled | Public Search Boundary |
| MS-10 | P1 | Capability booleans lack execution policy and content-scope metadata | Provider Policy |
| MS-11 | P2 | No hotel canonical supplier contract | Hotel Multi-Supplier phase |

## Confirmed additive schema needs

1. Add a typed/internal supplier provider identifier to `offers`; replace global `supplier_offer_ref` uniqueness with uniqueness scoped to `(supplier_provider, supplier_offer_ref)` while preserving the HAJIZ offer UUID.
2. Add the selected supplier provider identifier to `bookings` alongside `supplier_reference`; keep provider-private details in protected metadata.
3. Add a durable supplier-operation/attempt ledger keyed by HAJIZ booking, provider, operation, and server idempotency key, with opaque result identity and timestamps. This is required before process-safe booking retries.

No payment or booking enum change is justified. A new search-results table, dedupe table, FX schema, or hotel schema is not yet confirmed and should not be invented before the application-layer contracts are reviewed.

## Application-layer work

- Introduce a server-owned search orchestrator that resolves all enabled adapters from configuration while continuing to reject client supplier selection.
- Add bounded parallel fan-out with an abort signal, per-provider deadline, concurrency limit, partial-result policy, and normalized error telemetry.
- Define and validate a versioned private `FlightOffer` contract plus stable HAJIZ internal offer keys.
- Compute canonical itinerary and fare fingerprints; group equivalent physical itineraries without discarding distinct provider offers.
- Run HAJIZ pricing, then FX, then final-customer-price calculation before supplier-neutral ranking.
- Return opaque HAJIZ offer keys to the browser and resolve the chosen provider only on the trusted backend.
- Reprice the selected durable provider offer before checkout/booking and fail closed on expiry or identity drift.
- Persist booking operation identity before supplier execution; never perform automatic rebooking or supplier failover after an ambiguous create-booking result.
- Reconcile the server public offer projection with frontend display needs without exposing provider identity or economics.
- Define richer provider execution policy separately from capability support.

## Travelport `Map()` classification

**P0 pre-supplier blocker.** `createTravelportFlightSupplier` converts Travelport transaction/offering/product identifiers into a generated reference and stores the reverse mapping in a local `Map()`. The browser-safe opacity is correct, but the storage lifetime is not: references are lost on restart, unavailable to another process, and cannot support durable reprice/checkout. The mapping must move behind a protected persistent offer-reference boundary before Travelport can be enabled. Credentials alone must never enable it.

## Recommended build order

1. Multi-supplier contracts and test harness: versioned private offer validation, provider policy, canonical fingerprints, and frozen-boundary tests.
2. Additive persistence design and migration: provider-scoped offers, selected booking provider, durable operation attempts, RLS/ACL review.
3. Search orchestrator: enabled-provider resolution, bounded parallel fan-out, deadlines, cancellation, partial results, and observability.
4. Normalization and grouping: validate each adapter result, compute fingerprints, retain alternative provider offers, and deduplicate presentation groups.
5. Authoritative price pipeline: HAJIZ pricing, FX, final price, then supplier-neutral ranking.
6. Public search/selection boundary: opaque HAJIZ offer keys and frontend contract reconciliation.
7. Durable reprice and booking-provider selection: resolve one persisted provider, reprice, execute once with operation idempotency, and preserve frozen booking transitions.
8. Travelport pre-production enablement review only after explicit flag, injected network client, persistent references, isolation tests, credentials, and provisioned booking contracts exist.
9. Define hotel canonical contracts separately before any hotel adapter implementation.

