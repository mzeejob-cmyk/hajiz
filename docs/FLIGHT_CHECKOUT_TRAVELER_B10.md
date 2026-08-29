# Flight Checkout and Traveler Boundary B10

## Scope

B10 adds the customer-safe boundary between authoritative B9 repricing and a future booking-intent workflow. It prepares checkout from an opaque `hpr_v1_*` priced-selection identifier, collects flight traveler details, and validates the strict traveler contract. It does not create or persist a booking intent, booking, payment, hold, supplier reservation, ticket, or My Trips entry.

## Authority chain

The browser may initialize checkout only with the unchanged `pricedSelectionId` issued by B9. The process-local server resolver maps that token to the exact protected selection: `internalOfferId`, provider, provider offer reference, customer currency and price, safe itinerary/fare summaries, expiry, and passenger composition.

Possession of a valid HMAC-derived token is not enough to continue. Checkout preparation resolves the token, checks its expiry, calls the exact selected supplier adapter's reprice capability again, rejects any identity mismatch, and recomputes the current customer price using the B4 pricing policy and purpose-specific FX snapshots. Client amounts, itinerary data, supplier identity, currency overrides, FX, and markup never enter the preparation request.

The public preparation contract is `customer-flight-checkout/v1` and has three successful business outcomes:

- `READY`: identity, availability, and authoritative price are current.
- `PRICE_CHANGED`: the response exposes only the previous and current customer-safe prices and issues a replacement `hpr_v1_*` token through the existing B9 mechanism. The customer must explicitly accept it and revalidate before traveler fields appear.
- `UNAVAILABLE`: the exact supplier reports that inventory is unavailable.

Expired selections are a `410 CHECKOUT_SELECTION_EXPIRED` transport error. A supplier/reprice service failure is `503 REPRICE_UNAVAILABLE`, a timeout is `504 REQUEST_TIMEOUT`, and neither is presented as sold out. Unexpected failures use the safe `500 INTERNAL_ERROR` contract.

## Exact selection and substitution prevention

Each checkout reprice must match all three protected identities: `internalOfferId`, `provider`, and `providerOfferRef`. Any mismatch fails closed. Checkout does not rank again, select another alternative, fail over to another provider, or substitute another flight.

## Traveler contract

The strict contract version is `flight-travelers/v1`. The payload has exact top-level keys: `contractVersion`, `travelers`, and `contact`; unknown keys are rejected.

Each traveler has an in-memory UI coordination key, `travelerType` (`ADT`, `CHD`, or `INF`), compatible title, first/middle/last name, date of birth, and a passport document containing document number, ISO alpha-2 issuing country and nationality, and expiry date. B10 conservatively requires a passport for this presentation contract; it does not claim that every airline or route has the same document rules. Gender and unsupported traveler categories are deferred.

Names are trimmed, bounded, nonblank, and reject control characters. Dates use strict calendar parsing; date of birth must be before the validation date and document expiry after it. B10 deliberately does not invent airline-specific age-category rules.

Booking contact is separate from traveler identity and contains email, phone country code, and phone number. B10 performs format validation only—no OTP, SMS, email, or external verification.

## Passenger composition authority

The B7 protected search-resolution entry now retains the validated search request's `ADT`, `CHD`, and `INF` counts. B9 carries those counts into the protected priced-selection record. B10 compares the traveler array against those server-owned counts exactly and never accepts a client passenger-count override. A passenger change requires a new search.

## PII rules

Traveler names, dates of birth, passport data, email, and phone remain only in the live form and validation call boundary. B10 writes none of them to URLs, query strings, browser history state, `localStorage`, `sessionStorage`, IndexedDB, logs, telemetry, generic error payloads, or a database. Going back or reloading may discard the form; no reload persistence is promised.

The public preparation response contains no provider/supplier identity, offer references, internal offer IDs, supplier economics, canonical internal USD, pricing margins, commissions, FX internals, ranking diagnostics, raw payloads, traces, or stacks. The frontend parser rejects unexpected response keys and nested contract contamination.

## Frontend states

The B9 continuation now invokes checkout preparation. `READY` displays the safe itinerary, authoritative current customer price, traveler fieldsets derived from protected passenger composition, and one booking-contact fieldset. `PRICE_CHANGED` displays old and current customer-safe prices and requires explicit acceptance before forms. Inventory unavailable, supplier service unavailable, expiry, timeout, and internal failure remain distinct states. Request sequencing and abort handling prevent an older response from overwriting a newer selection.

The final B10 action is “متابعة إلى مراجعة الحجز”. It performs only local browser field-shape checks in the current presentation shell; the canonical server validator is available for the B11 boundary. The UI states explicitly that no booking, payment, or seat hold has occurred.

## No-side-effect boundary

B10 does not call booking, payment, wallet, Bankak, PSP, supplier booking/hold/confirmation, Travelport, ticketing, or My Trips services. It adds no migration and makes no database or external network call. The mock supplier is used only by local tests for search/reprice conformance.

## Process-local limitation

Both the search alternative resolver and priced-selection map remain process-local and non-production. Tokens cannot be resolved across processes or restarts. B10 is therefore not production multi-process safe until a durable shared resolver and production HTTP host are implemented.

## B11 ownership

B11 may map a successfully validated B10 traveler payload and current priced selection into the approved booking-intent persistence and orchestration boundary. Booking creation, payment initiation, supplier execution, idempotent persistence, durable resolver infrastructure, and all downstream lifecycle transitions remain outside B10.
