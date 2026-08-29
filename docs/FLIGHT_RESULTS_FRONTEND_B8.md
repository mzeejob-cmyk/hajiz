# Flight Results Frontend B8

## Scope and architecture

B8 connects the existing Arabic-first flight results presentation to the reviewed public contracts `customer-flight-search-http/v1` and `customer-flight-search/v1`. The app provider accepts an injected transport and creates one canonical client. No URL, fetch implementation, supplier adapter, or in-process backend import is embedded in the browser bundle. A production host/router is still required.

The flow is: existing home search query → explicit ten-field request mapper → injected transport client → strict response parser → presentation-only view model → results cards.

## Existing frontend audit

- **REUSED:** app entry/provider composition, `/flights` routing, home search form and safe query parameters, results page shell, search summary, flight card visual language, route segment, price primitive, RTL/LTR primitives, responsive CSS, and the pre-existing fare/traveler/review screens outside this batch.
- **REPLACED:** the active results path no longer reads `FLIGHT_FIXTURES`; it uses the customer contract state machine and view model. The old ranking labels, mock expiry promise, and fixture itinerary CTA were removed from active results.
- **DEPRECATED:** fixture-driven results, fixture-specific filters/toolbar, and the state gallery are no longer part of the active results path. Fixture data remains for legacy regression tests only.
- **LEFT UNTOUCHED:** reviewed B6/B7 backend, pricing, FX, grouping, ranking, supplier execution, payments/Bankak, migrations, hotels, and other product areas.

## Request and client boundary

`mapFlightSearchRequestV1` deliberately emits exactly: `tripType`, `origin`, `destination`, `departureDate`, `returnDate`, `adults`, `children`, `infants`, `cabinClass`, and `customerCurrency`. It uppercases IATA values, maps one-way return to `null`, requires round-trip return dates, converts passenger inputs to integers, and performs only obvious UX validation. Supplier/provider, ranking, pricing, margin, FX, timing, trace, and adapter controls cannot enter the DTO.

The client accepts only an injected `transport(request, { signal })`. It validates status and safe error envelopes. Success parsing uses exact-key allowlists at every envelope, group, itinerary, segment, alternative, fare, and price level. Any contamination or inconsistent recommendation fails closed as a generic internal error.

## View model and presentation

The flattened view model retains backend group and alternative order. It contains opaque `alternativeId`, server recommendation, public itinerary/carrier/times/duration/stops/segment count, public fare summaries, authoritative price string/currency, and `validUntil`. It contains no provider, supplier reference, supplier economics, FX snapshot, ranking score/policy, or internal offer ID.

Cards show route, the wall-clock `HH:MM` carried by each contract ISO timestamp and offset, stop count, carrier display, cabin, baggage, public change/refund summary, exact customer price, a neutral `موصى به` badge only when the server contract is consistent, and an `اختيار` button. The frontend does not convert flight times to UTC or the browser timezone, infer timezone from IATA codes, or use an airport timezone database. Regression coverage includes non-`Z` offsets, `Z`, and millisecond timestamps. USD, AED, and SDG are labels only; there is no browser-side conversion or arithmetic.

## States, race safety, and selection

The explicit UI states are `idle`, `loading`, `success`, `empty`, `partial`, `partial_empty`, `unavailable`, `timeout`, `validation_error`, and `internal_error`. `COMPLETE` with no groups is an empty result, not an outage. `PARTIAL` keeps valid results visible without supplier diagnostics; `PARTIAL` with zero groups keeps its partial contract status while presenting a safe retry message. HTTP 503, 504, 400, and 500 have distinct safe Arabic copy. A contradictory HTTP 200 payload with `searchStatus: UNAVAILABLE` fails closed at the parser boundary.

Each new request aborts the previous frontend signal and advances a sequence number. A late response cannot replace a newer result, even if the transport ignores abort. Unmount cancels/invalidate the active UI request; this does not claim cancellation of server-side supplier work.

Selection stores only the opaque `alternativeId` in component state. It never parses the handle, adds it to the URL, books, reserves, locks price, or starts checkout. The next scope requires a reviewed selection/reprice contract.

## Persistence, RTL, responsiveness, accessibility

B8 adds no local/session storage. No result payload, alternative handle, private data, PII, or payment data is persisted. Existing safe URL parameters remain limited to search context. Arabic content stays RTL while IATA, dates, times, and prices use direction-safe primitives. Existing desktop/tablet/mobile card breakpoints were retained; state panels and skeletons scale with the same container. Buttons remain semantic, loading and selection use live status regions, failures use readable alert regions, and recommendation is textual rather than color-only.

## Deferred items and status

Large filters and customer sorting are deferred; backend order remains authoritative by default. Currency changes create a new request rather than converting existing results. The approved wordmark/assets were not changed. No favorites behavior was expanded.

MS-09 is **customer frontend contract integration complete; real network host wiring pending**. It is not production-ready and does not close selection, reprice, checkout, booking execution, or supplier availability. `HOST/ROUTER STILL REQUIRED BEFORE PRODUCTION`.
