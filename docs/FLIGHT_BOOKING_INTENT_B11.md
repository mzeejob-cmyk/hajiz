# Flight Booking Intent B11

## Scope and semantics

B11 creates the server-owned boundary after B10 checkout/traveler preparation. A successful `READY_FOR_PAYMENT` intent means only that HAJIZ accepted a currently valid priced selection and server-validated traveler/contact data that may proceed to payment initiation in B12.

It does not mean paid, booked, confirmed, held, ticketed, or supplier-accepted. B11 does not call payment, Bankak, PSP, wallet, supplier booking/hold/confirmation, Travelport, ticketing, My Trips mutation, payout, or commission services. The rule `PAYMENT CONFIRMED != SUPPLIER BOOKING CONFIRMED` is unchanged.

## B10 to B11 authority chain

The strict HTTP request `flight-booking-intent-request/v1` contains only:

- the current opaque B9/B10 `pricedSelectionId`;
- an opaque `hbi_req_*` idempotency key;
- B10 traveler entries;
- the separate booking contact.

Unknown fields are rejected. Price, currency overrides, supplier/provider identity, internal offer identity, FX, margin, status, payment data, supplier references, ticket state, and `userId` cannot enter from the browser.

Intent creation calls the B10 checkout preparation service again. That resolves the protected token, checks expiry, reprices the exact provider offer, verifies `internalOfferId`, provider, and `providerOfferRef`, and recomputes current customer price through the B4 pricing/FX primitives. B11 then resolves the protected priced selection again and confirms the customer amount, currency, and validity match the current B10 result. A browser-carried READY object is never accepted as authority.

`PRICE_CHANGED` returns a replacement token from the existing B9 mechanism and persists no intent. `UNAVAILABLE` is a business result. Supplier failure and timeout remain distinct transport errors and never look sold out.

## Authoritative traveler validation

B11 invokes the canonical `flight-travelers/v1` validator on the server after current-price revalidation and before persistence. It enforces exact keys, supported ADT/CHD/INF types, compatible titles, unique traveler keys, strict names/dates/passport fields, issuing country/nationality, contact shape, and an exact match to the passenger composition retained from the protected search selection.

Frontend/native field validation is presentation assistance only and cannot bypass the server validator. No universal airline age, passport eligibility, or visa rule is claimed. No traveler document is sent to a supplier.

## Persistence decision

The frozen `public.bookings` table is not reused. It requires a payment method and is currently created inside `create_checkout` together with a `payments` row. Creating it in B11 would misleadingly imply a checkout/payment lifecycle that has not started.

Migration `20260829120000_flight_booking_intents_v1.sql` therefore adds a narrow `app_private.flight_booking_intents` entity. It is additive and does not edit frozen migrations, enums, bookings, payments, transitions, or audits. The table stores:

- opaque `hbi_v1_*` customer identifier and `READY_FOR_PAYMENT` status;
- trusted owner and idempotency identity;
- payload and priced-selection digests;
- protected exact offer/provider identity;
- safe itinerary/fare and customer-price snapshots;
- authoritative passenger composition;
- validated traveler/contact snapshots;
- validity and creation timestamps.

Supplier net, commission, margin, payment state, supplier booking reference, and ticket state are not stored by B11.

The migration has not been applied. The Supabase CLI was unavailable in the build environment, so verification is structural/local only and the migration requires a separate Staging review and runtime gate before application.

## RLS and privileges

The PII table is in `app_private`, has RLS enabled and forced, has a direct-deny policy for `anon` and `authenticated`, and revokes direct table privileges from public API roles and `service_role`. The only persistence/resolution functions are `public.create_flight_booking_intent_v1` and `public.get_flight_booking_intent_v1`; both are `SECURITY DEFINER` with an empty `search_path`, fully qualified relations, and EXECUTE granted only to `service_role`. The browser never receives or uses that credential.

This follows Supabase's current guidance that grants and RLS are separate controls, new exposed tables require explicit grants, and privileged functions must pin `search_path` and revoke default execution: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database Functions](https://supabase.com/docs/guides/database/functions), and [Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## Ownership

Owner identity comes from an injectable trusted server request context. It never comes from `request.body.userId`. The persistence key is `(owner_id, idempotency_key)`, and resolution always requires both owner and `bookingIntentId`; a cross-owner lookup fails closed.

The current repository does not yet have a production flight HTTP host that converts an authenticated request into this owner context. Tests use the explicit `injected-test` source. Production wiring must validate the user/session server-side and inject the UUID; this limitation is not hidden by fabricating an auth flow.

## Idempotency

The request key format is opaque and prohibits PII. The server computes a SHA-256 digest over exact selected identity, authoritative customer price, passenger composition, normalized travelers, and contact. The private SQL boundary uses atomic `INSERT ... ON CONFLICT DO NOTHING` on `(owner_id, idempotency_key)`:

- same owner + key + effective payload returns the original `bookingIntentId`;
- the same key with different travelers or priced-selection authority raises a conflict;
- retries and double clicks cannot create independent intents.

The in-memory conformance store has the same behavior but is explicitly non-production. Durable semantics require the reviewed migration and server-only Supabase RPC adapter.

## Public response and PII

The public `flight-booking-intent/v1` result contains only the opaque intent ID, honest status, authoritative customer-safe price, safe itinerary, aggregate passenger counts, validity, and next action. It never echoes names, DOB, document/passport data, email, phone, supplier identity/economics, FX internals, trace data, raw payloads, or stacks.

PII exists only in the live form, the server validation boundary, and—after the migration is approved—the private intent snapshot. It is not placed in URLs, query strings, history, browser storage, logs, telemetry, generic audit data, errors, IDs, or idempotency keys. No generic Admin/list endpoint is added.

## Frontend

The B10 form now creates an in-memory review draft. The customer reviews the safe route, current price, and passenger count before intent creation. Request coordination aborts stale submissions, suppresses late responses, deduplicates a double click, and reuses the same idempotency key for an identical retry.

After success, the UI displays “جاهز لاختيار طريقة الدفع”, the authoritative server-returned price, and the opaque intent ID. The B12 control is disabled and the copy states that no payment, confirmed booking, or seat hold exists. Price change returns to explicit B10 acceptance/re-entry; it is never silently accepted.

## B12 handoff

B12 should accept only `bookingIntentId` plus the selected payment method. The server must resolve the intent under the trusted owner context. The browser must not resubmit traveler PII, price, FX, itinerary, or supplier identity. B12 owns payment initiation and must not infer supplier confirmation from payment state.

## Current limitations and Review Gate A

- B9/B10 priced-selection resolution remains process-local and non-production.
- The B11 authenticated owner resolver and server-only Supabase client are injectable but not wired to a production HTTP host.
- The additive migration is un-applied and has no live Staging evidence in this batch.
- No supplier/Travelport or FX-provider network was contacted.

The combined B10+B11 delta from canonical B9 `1abe02cbdf4bb6283468ae04c732694c3419a41e` through the final B11 head is Review Gate A. B12 must not start before that independent review.
