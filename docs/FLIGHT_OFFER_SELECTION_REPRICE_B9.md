# Flight Offer Selection and Reprice B9

## Boundary

A `customer-flight-search/v1` result is discovery output, not booking authority. Its `hca_v1_*` value is an opaque customer selection handle: browsers store and return it unchanged, and never decode it, infer a supplier, price from it, or use it to book.

B9 introduces `POST /api/v1/flights/reprice`. The exact public request is `{ alternativeId, customerCurrency }`. The only supported currencies are USD, AED, and SDG. Provider/supplier identity, offer references, prices, economics, FX, ranking, timing controls, internal fingerprints, and tracing values are rejected rather than ignored.

## Resolution and durability

During each trusted B7 search projection, the server collects the exact first internal offer chosen as the representative of each public alternative and commits the collection atomically. Identical public alternatives already deduplicated by B6 remain bound to that server-chosen representative; reprice never searches for a similar flight or silently substitutes another supplier candidate. A repeated successful authoritative search refreshes/rebinds the deterministic customer alternative to its newest representative and newest price/expiry context. Ambiguity means conflicting representatives for the same public alternative inside one search collection—not normal internal-offer rotation across separate searches. True same-search ambiguity fails closed with a typed result and does not partially mutate resolver state.

The current resolver is explicitly `process-local-non-production`. Its bounded lifetime is the earlier of the supplier offer expiry and the authoritative search customer-price expiry. Expired resolver entries are opportunistically pruned when a new search collection is committed, and an expired prior binding can always be replaced by fresh authoritative search context. It is lost on restart and unavailable to another process. A protected durable shared resolver is required before multi-process production hosting or Travelport enablement. Priced-selection pruning beyond expiry-on-read remains deferred with that durable-store design. No database migration or new infrastructure dependency is claimed in B9.

## Supplier validation and authoritative pricing

The canonical service resolves the provider only from protected server state and requires the adapter's declared `reprice` capability. Mock provides deterministic conformance. Travelport remains disabled and no supplier network is contacted. The repriced offer must return the same internal offer, provider, and protected provider reference; any mismatch fails closed rather than switching alternatives.

B9 reuses the B4 `priceFlightOfferV1` and `createCustomerPriceV1` primitives with trusted pricing policy and FX snapshots. Client old price, net, margin, FX rate, and discount cannot enter the request. A different requested currency causes a new authoritative reprice. Comparable previous price comes only from server-owned search context. `PRICE_CHANGED` is explicit; a changed amount is never silently accepted.

## Public result and errors

`customer-flight-reprice/v1` returns the selected opaque ID, `AVAILABLE`, `PRICE_CHANGED`, or `UNAVAILABLE`, customer-safe itinerary/fare, authoritative previous/current prices where comparable, `priceChanged`, revalidation time, expiry, and an opaque `pricedSelectionId`. It excludes provider/supplier identity and references, internal IDs, supplier economics, canonical internal USD, FX snapshots/rates, ranking diagnostics, telemetry, and stacks.

Transport errors use `customer-flight-reprice-http-error/v1`: validation, selection-not-found/expired, reprice-unavailable, timeout, and generic safe failures remain distinct. Supplier failure is a service failure and never masquerades as sold-out inventory.

## Priced selection token

`hpr_v1_*` is an HMAC-derived, server-owned, replay-stable handle bound to the exact internal alternative, authoritative customer amount/currency, and `validUntil`. Protected process memory holds its reverse mapping. It authorizes only a future checkout boundary to consider this recently repriced selection. It does not book, hold a seat, lock a supplier price, initiate payment, create a supplier reservation, or issue a ticket. Expired tokens fail closed. The search, reprice, payment, and any future supplier-hold clocks remain separate.

## Frontend

Selection enters an in-memory repricing state through an injected transport. UI states cover loading, current price, explicit price change confirmation, unavailable, expired, service unavailable, timeout, validation, and internal error. Sequence and abort guards prevent selection A or an old currency response from overwriting selection B/current currency. Successful output stops at an honest “ready to continue to traveler details” presentation boundary. Tokens and prices are not placed in URLs or local/session storage.

## Limitations

- No production HTTP host/router or cross-process admission/rate limiting.
- Resolver and priced-token state are process-local and non-durable.
- Mock conformance only; no real supplier repricing is enabled.
- No checkout, passenger booking contract, payment, hold, supplier booking, ticketing, or automatic alternative substitution.
- B2-05, B5-03, raw-body limits, production FX sourcing, filters/sorting, and Travelport enablement remain deferred.
