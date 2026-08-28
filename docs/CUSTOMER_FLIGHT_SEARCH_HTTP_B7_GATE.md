# HAJIZ Customer Flight Search HTTP B7 Gate

## Status

**PASS**

- Independent review: **PASS**
- Required fixes: **NONE**
- Reviewed feature HEAD: `35e259bef9f6fdeff37e9ab3c2cb118aded43158`
- Previous canonical integration HEAD: `6230d8793b88f53dd9a627242b633a62cb01adca`
- Tests: **316/316**
- Build: **PASS**
- Lint: **PASS**
- Diff check: **PASS**
- Staging: **NOT REQUIRED**
- Database migrations: **NONE**
- Backend Core: **UNCHANGED**
- Payment/Bankak: **UNCHANGED**
- Supplier booking execution: **UNCHANGED**
- Travelport: **DISABLED**
- Frontend: **NOT WIRED**
- Host/router: **NOT DEPLOYED**

## HTTP contract

- endpoint: `POST /api/v1/flights/search`
- handler factory: `createCustomerFlightSearchHttpHandlerV1`
- success contract: `customer-flight-search-http/v1`
- error contract: `customer-flight-search-http-error/v1`

Status mapping is 200 for COMPLETE/PARTIAL, 400 for VALIDATION_ERROR,
503 for SEARCH_UNAVAILABLE, 504 for REQUEST_TIMEOUT, and 500 for
INTERNAL_ERROR. A successful zero-match search is `200`, COMPLETE, with
`groups: []`; SEARCH_UNAVAILABLE never means merely “zero results”.

The exact request fields are `tripType`, `origin`, `destination`,
`departureDate`, `returnDate`, `adults`, `children`, `infants`, `cabinClass`,
and `customerCurrency`. Exact-key and plain-object validation rejects provider,
preferred-provider, supplier IDs/references, ranking/pricing/margin/uplift/FX
controls, timeout/concurrency overrides, client time/deadline, trace controls,
and adapter options. Prototype/object safety passed independent review.

## Customer IDs and selection semantics

B6-01 and B6-02 are CLOSED. `hcg_v1_<digest>` and `hca_v1_<digest>` use
SHA-256 over recursively canonical, deterministically key-sorted input with the
explicit domain/version inside the digest. Provider identity, supplier
reference, internal offer ID, and reversible encoding are absent.

The public alternative ID is a customer-safe search-result handle only—not
booking authorization, a reservation token, a guaranteed price, or a supplier
reference. Future protected selection/reprice resolution remains required.

## Server time and deadlines

Trusted request time is read once, cannot be supplied by the client, and is
used consistently for pricing/FX validity, ranking, and projection. The global
deadline derives from that time. N-1 clock/orchestrator coupling remains LOW
until real host integration.

B2-03 is CLOSED. The server-owned global request budget defaults to 10,000 ms
with a validated internal 1–120,000 ms range. Clients cannot override it. Each
supplier receives `min(per-supplier timeout, remaining global budget)`; no work
launches after the absolute deadline; valid completed results may survive as
PARTIAL; late promises are safely absorbed.

B2-02 is CLOSED FOR APPLICATION-LAYER PER-REQUEST CAPACITY SCOPE. An unresolved
timed-out attempt retains its capacity lease, so queued work does not replace
abandoned I/O and inflate true per-request concurrency. Responses still stop at
the global deadline and late resolve/reject is absorbed. Cross-request
admission/rate limiting remains a PRE-PUBLIC-PRODUCTION host requirement.

## Pricing isolation and empty results

Natural offer-local expiry is represented by `OfferPricingUnavailableError`
with code `OFFER_PRICING_UNAVAILABLE`. Only that explicit recoverable condition
is isolated per alternative before ranking/projection. Valid peers and unrelated
fare/itinerary/provider results survive, with no raw, net, native, or stale
customer-price fallback.

Malformed, missing, invalid, or expired trusted pricing policy; malformed or
missing FX; wrong FX direction; and internal contract, invariant, or identity
failures remain hard failures. Future code must not broaden the recoverable
catch without review.

All suppliers returning no results, or all offers naturally expiring after a
successful COMPLETE search, produce `200`, COMPLETE, `groups: []`. A valid plus
expired result retains the valid option and follows upstream search status.
Genuine execution/application unavailability is 503; global budget exhaustion
before a usable answer is 504. HTTP status follows semantic search state, not
`groups.length`.

## Projection and public safety

B6-03 is CLOSED: itinerary display comes from the first retained
customer-visible alternative. B6-04 remains INFO/EXPECTED: a stale preferred
option is removed, the group becomes UNRANKED, and no survivor is promoted
without fresh upstream ranking.

Independent review verified no endpoint provider/provider value,
`providerOfferRef`, supplier operation ID/economics/native money, margin,
uplift, commission, canonical USD/FX internals, ranking policy/internals,
quality metrics, diagnostics, trace ID, raw error, stack, or internal offer ID.
Error bodies contain only contract version and safe code/message.

The canonical pipeline is validated HTTP request → multi-supplier search →
grouping → pricing → FX → CustomerPriceV1 → ranking → customer projection →
HTTP response. There is no raw supplier ranking, provider-specific HTTP logic,
HTTP pricing/FX duplication, or supplier-price fallback.

## Gaps and regression

- B6-01/B6-02/B6-03: **CLOSED**
- B6-04: **INFO / EXPECTED**
- B2-02: **CLOSED FOR APPLICATION-LAYER PER-REQUEST SCOPE**
- B2-03: **CLOSED**
- B2-05: **DEFERRED**
- B5-03: **DEFERRED / LOW OBSERVABILITY**
- MS-08: **CLOSED FOR FLIGHT PRICING + FX + RANKING/SELECTION SCOPE**
- MS-09: **PARTIAL — CUSTOMER HTTP APPLICATION ENDPOINT COMPLETE; FRONTEND NOT WIRED**

Pricing, FX, and ranking passed. Model B, grouping, Backend Core,
payment/Bankak, supplier booking execution, historical migrations, Travelport,
and frontend remain unchanged. Travelport is disabled.
