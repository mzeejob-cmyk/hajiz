# HAJIZ Customer Flight Search HTTP Batch 7

## Endpoint and architecture

The repository has no existing HTTP framework, API router, or server host. B7
therefore adds one framework-neutral canonical server handler without adding
Express, an Edge Function, or duplicate endpoint forms:

- path contract: `POST /api/v1/flights/search`
- handler factory: `createCustomerFlightSearchHttpHandlerV1`
- handler: `handleCustomerFlightSearchHttpV1`
- HTTP contract: `customer-flight-search-http/v1`
- error contract: `customer-flight-search-http-error/v1`

The handler follows the reviewed pipeline exactly: strict HTTP validation,
multi-supplier orchestration, grouping, pricing, FX, ranking,
`toCustomerFlightSearchV1`, then the HTTP envelope. It never projects a private
ranked result directly. Host/router registration remains future deployment
work and is not frontend wiring.

## Public request

The body requires exactly `tripType`, `origin`, `destination`, `departureDate`,
`returnDate`, `adults`, `children`, `infants`, `cabinClass`, and
`customerCurrency`. Unknown or missing fields fail with `VALIDATION_ERROR`.

- trip type: `one_way` or `round_trip`
- airport identity: uppercase three-letter IATA code; origin and destination must differ
- dates: exact `YYYY-MM-DD` calendar dates, compared against the server UTC calendar date
- one-way: `returnDate` must be `null`
- round-trip: return date is required and cannot precede departure
- passengers: integer adults >= 1; children and infants >= 0; no unapproved total-passenger maximum is invented
- cabin: economy, premium_economy, business, or first
- customer currency: the canonical pricing set USD, AED, or SDG

Provider/supplier selection, ranking mode, FX, pricing/margin/uplift, timeout,
concurrency, trace controls, adapter metadata, and client `now` are forbidden.
The validator accepts only plain/null-prototype objects, uses own-key checks,
does not merge attacker data, rejects dangerous/extra prototype keys, and caps
the serialized application body at 4096 characters. The HTTP host must also
enforce its own byte-level request limit before JSON parsing.

## Response and errors

HTTP 200 wraps `customer-flight-search/v1` as:

`{ contractVersion: "customer-flight-search-http/v1", data }`

COMPLETE and PARTIAL are successful responses. PARTIAL never identifies the
failed/timed-out supplier. A search with no usable customer result returns 503
`SEARCH_UNAVAILABLE`. Exhausted global request budget returns 504
`REQUEST_TIMEOUT`. Invalid requests return 400 `VALIDATION_ERROR`. Unexpected
failures return 500 `INTERNAL_ERROR`. Error bodies contain only the version,
stable code, and generic customer message—never stacks, provider causes,
credentials, pricing/FX internals, or diagnostics.

Money remains decimal strings; timestamps are ISO strings; the response has no
BigInt, Date object, or undefined/private field.

## Customer selection IDs

**B6-01 and B6-02 are CLOSED before endpoint exposure.** Customer ID inputs use
recursive key-sorted canonical JSON with stable array order and JSON-safe
primitive validation. The hash input includes the explicit domain/version:

- `SHA-256(["hcg_v1", canonicalGroupIdentity])` -> `hcg_v1_<32 hex>`
- `SHA-256(["hca_v1", canonicalAlternativeIdentity])` -> `hca_v1_<32 hex>`

The pre-public ID change is deliberate contract stabilization. Golden tests
prove insertion-order independence and group/alternative domain separation.
No provider, provider reference, or internal offer ID enters the customer ID.

An `hca_v1` value is a customer-safe search-result handle only. It is not a
durable booking authorization token and is not reversibly decoded. A future
selection/reprice service must resolve protected search state, verify expiry,
reprice, and authorize the operation. `price.validUntil` does not guarantee
availability or price beyond that instant.

## Server time and request budget

The handler reads its trusted server clock exactly once. The same ISO
`requestNow` is passed to pricing/FX validity, ranking, and customer projection;
the client cannot supply time. The absolute `deadlineAt` is derived from that
instant and a validated server-owned `requestTimeoutMs`.

The technical default global request budget is 10,000 ms in
`multiSupplierSearchPolicy`; the accepted internal range is 1–120,000 ms. The
HTTP handler's configured budget cannot exceed the orchestrator budget. Public
requests cannot override either budget or concurrency.

**B2-03 is CLOSED.** Workers do not launch suppliers after the global deadline
or request abort. Each supplier receives an effective deadline equal to the
minimum of its server timeout and remaining global budget. Completed valid
results survive as PARTIAL. The response stops waiting at the global deadline,
and late resolve/reject is absorbed without contradictory telemetry or
unhandled rejection.

## True in-flight capacity and disconnects

**B2-02 is CLOSED for application-layer per-request capacity scope.** A timed
out supplier that ignores AbortSignal retains its worker capacity lease until
the underlying promise settles or the global deadline ends. Queued supplier
work cannot immediately replace it and inflate true in-flight work within the
request. The response remains deadline-bounded and does not wait for abandoned
I/O after the budget.

Residual risk: an adapter may continue remote work after the response, bounded
to at most the request's configured concurrency. Capacity across many separate
requests requires host-level admission control/rate limiting and preferably
transport-enforced cancellation. Those controls are a **PRE-PUBLIC-PRODUCTION
REQUIREMENT** and are not claimed by B7.

If the HTTP host supplies a disconnect `AbortSignal`, the handler composes it
into orchestration. It stops waiting and launching work and propagates
cancellation where adapters cooperate. The framework-neutral handler cannot
manufacture a disconnect signal when its future host does not provide one.

## Projection safety

Endpoint-level adversarial tests verify no provider identity/reference,
supplier operation ID, supplier-native economics, margin, uplift, commission,
canonical USD/FX internals, ranking policy/score/weights, quality metrics,
diagnostics, trace ID, raw error, or stack reaches the HTTP body.

Customer-identical public options may collapse without deleting private
supplier alternatives. **B6-03 is CLOSED:** group display itinerary now comes
from the first retained customer-visible alternative. **B6-04 remains expected:**
if a preferred alternative is stale at projection it is removed and survivors
remain UNRANKED; projection never silently promotes without fresh ranking.

## Deployment boundary and gaps

Trusted pricing policy, ranking policy, FX snapshots, supplier registry, clock,
and budgets are injected server dependencies. No production policy service,
FX service, supplier, or HTTP host is wired by this batch. Travelport remains
disabled. There is no booking, checkout, database migration, frontend fetch,
React integration, or provider action.

- B6-01: **CLOSED**
- B6-02: **CLOSED**
- B6-03: **CLOSED**
- B6-04: **INFO / EXPECTED**
- B2-02: **CLOSED FOR APPLICATION-LAYER REQUEST CAPACITY SCOPE**
- B2-03: **CLOSED**
- B2-05/B5-03: **DEFERRED**
- MS-09: **PARTIAL — HTTP CUSTOMER SEARCH ENDPOINT COMPLETE; FRONTEND NOT WIRED**

