# HAJIZ Ranking + Selection B5 Gate

## Status

**PASS**

- Independent review: **PASS**
- Required fixes: **NONE**
- Source reviewed HEAD: `4f83879db5ce42771481fb877843718b8474be0f`
- Previous canonical integration HEAD: `71c0ef800ea942a6a1655e58733491f1b086c53c`
- Tests: **272/272**
- Build: **PASS**
- Lint: **PASS**
- Diff check: **PASS**
- Staging: **NOT REQUIRED — application-layer-only batch**
- Database migrations: **NONE**
- Backend Core: **UNCHANGED**
- Payment/Bankak: **UNCHANGED**
- Travelport: **DISABLED**
- Supplier network: **NOT CONTACTED**
- FX provider: **NOT CONTACTED**

## Validated capabilities

F-03 is closed. The trusted pricing policy requires `maxMarginPct` and
`maxAgentUpliftAmountUsd`; missing or malformed bounds and exceeded bounds fail
closed, while boundary equality is accepted. No hardcoded business maximum was
invented and the Model B formulas are unchanged.

The private `flight-ranking-policy/v1` produces
`ranked-grouped-flight-search/v1` only after authoritative `CustomerPriceV1`.
It ranks final customer prices, never supplier net or a raw supplier-price
fallback. Decimal comparison uses exact BigInt fractions and no floating-point
money arithmetic. Ordering is deterministic: customer price, first-seen order,
then internal ID as the final fallback.

Every valid or unrankable supplier alternative is retained. Unrankable
alternatives cannot become preferred, and `preferredInternalOfferId` is either
a retained rankable alternative or `null`. COMPLETE results rank, PARTIAL
results rank their valid alternatives, and UNAVAILABLE results have no
preferred alternative.

The active policy is price-only, so cheapest and preferred coincide today;
that is not a permanent product invariant. The versioned architecture can
later accept trusted reliability, ticketing, latency, support, or SLA inputs,
but no runtime quality source, fabricated production value, or quality weight
is active.

## Public safety

The ranked contract remains private. No provider identity, supplier reference,
supplier economics, ranking weight, ranking internals, or quality metric is
exposed. Batch 5 adds no public endpoint or frontend/customer wiring.

## Gap status

- F-03: **CLOSED**
- MS-01: **CLOSED — search fan-out scope**
- MS-02: **PARTIAL**
- MS-03: **CLOSED — search timeout/failure-isolation scope**
- MS-04: **PARTIAL**
- MS-05: **CLOSED**
- MS-06: **CLOSED — persistence/schema scope**
- MS-07: **CLOSED — flight marketed-itinerary/fare grouping scope**
- MS-08: **CLOSED FOR FLIGHT PRICING + FX + RANKING/SELECTION SCOPE**; the current policy remains price-only and trusted supplier-quality weighting is inactive
- MS-09: **PARTIAL** — no customer endpoint/frontend reconciliation exists
- MS-10: **PARTIAL**
- MS-11: **OPEN**

## Deferred boundaries

- **B5-01 — REQUIRED BEFORE CUSTOMER ENDPOINT WIRING:** a mixed-customer-currency
  fare group currently throws and fails the entire ranking call. This is
  fail-closed and unreachable through the normal Batch 4 path, which prices one
  customer currency. Before endpoint wiring, isolate the affected group as
  UNRANKED, retain its alternatives with no preferred ID, and allow unaffected
  groups to continue.
- **B5-02 — LOW:** replace the final internal-ID `localeCompare` tie-break with a
  plain deterministic lexical comparison to remove the theoretical ICU
  dependency.
- **B5-03 — LOW / observability:** preserve a safe per-alternative unrankable
  reason instead of losing it in the bare catch; fold this into diagnostics.
- Supplier currency expansion beyond USD/AED/SDG remains
  **PRE-REAL-SUPPLIER-ENABLEMENT**.
