# Flight Payment Initiation B12

## Scope and stopping point

B12 accepts one owner-bound B11 `READY_FOR_PAYMENT` booking intent, revalidates its commercial authority, creates or reuses one canonical `pending_payment` booking and one `awaiting` payment, and returns a customer-safe Bankak or PSP handoff.

The boundary stops there. It does not confirm a payment, approve a Bankak receipt, simulate a webhook, debit a wallet, call supplier booking/hold/ticketing, create a PNR, or move a booking to `payment_confirmed`, `processing`, `confirmed`, `ticketed`, or `completed`.

## Public authority contract

`POST /api/v1/flights/payment-initiation` uses `flight-payment-initiation-request/v1` with exactly:

- `bookingIntentId`;
- `paymentMethod`, currently `bankak` or `card`; and
- an opaque `hpi_req_*` idempotency key.

Unknown fields fail validation. The browser cannot resubmit traveler/contact data, price, currency, FX, margin, commission, internal offer identity, supplier/provider identity, provider reference, payment status, booking status, or `userId`.

The response `flight-payment-initiation/v1` contains only the customer-safe booking reference, payment ID, selected method, `awaiting` payment status, `pending_payment` booking status, authoritative amount/currency, expiry, next action, and a method-specific handoff. It contains no traveler PII, supplier identity/economics, provider payment identity, raw provider payload, service credential, or audit data.

## Owner and booking-intent resolution

Owner identity is injectable only from a trusted server request context and must be a UUID with source `authenticated` or the explicit test-only source. The handler never reads `request.body.userId`.

The server resolves `(ownerId, bookingIntentId)` through the B11 store. A fabricated or cross-owner ID is indistinguishable from not found. The intent must still be exactly `READY_FOR_PAYMENT`, unexpired, and contain the authoritative customer-price, traveler, and contact snapshots. B11 has no superseded state; B12's unique payment-initiation claim prevents a second materially different payment from consuming the same intent.

The repository still lacks the production HTTP host that validates a live Supabase session and injects the owner, and it lacks the wired server-only Supabase client. The route and stores therefore remain injectable and are not an unauthenticated production endpoint.

## Commercial revalidation

`READY_FOR_PAYMENT` is not permanent authority. Immediately before reserving payment identity, B12:

1. rejects an expired intent or customer-price snapshot;
2. resolves the original provider only from the private intent;
3. calls that supplier adapter's `reprice` capability for the exact private provider offer reference;
4. verifies `internalOfferId`, provider, and provider offer reference without substitution;
5. reruns B4 pricing and FX using trusted server configuration; and
6. requires the current customer amount and currency to equal the accepted B11 snapshot.

A changed price returns `REPRICE_REQUIRED`; an expired intent returns `INTENT_EXPIRED`; unavailable inventory and supplier timeout/service failure stay distinct. No price is silently changed or accepted, and no payment is reserved before this application-layer check.

The database `prepare_flight_payment_initiation_v1` RPC performs a second fail-closed check before any PSP call: the durable offer must match the intent's internal/provider identities, remain enabled/unexpired, and have the exact persisted customer amount/currency. The materialization RPC repeats that check after a PSP handoff to close the race window as far as the current schema allows.

## Atomicity and idempotency

Migration `20260829183000_flight_payment_initiation_v1.sql` adds the private, RLS-enabled non-forced `app_private.flight_payment_initiations` ledger. It claims each B11 intent once and reserves stable booking/payment IDs and references without creating either business row.

The server flow is:

```text
resolve owner-bound intent
→ revalidate current commercial authority
→ PREPARED private reservation
→ Bankak config or idempotent PSP session
→ one database transaction inserts booking + payment + audit
→ MATERIALIZED reservation
→ safe handoff
```

`materialize_flight_payment_initiation_v1` inserts the canonical booking and payment in the same PostgreSQL transaction. Any exception rolls back both inserts. A PSP failure or timeout leaves at most a private recoverable `PREPARED` reservation—never an orphan canonical booking or payment. A retry reuses its stable internal IDs and the same PSP idempotency key. If the provider session exists but database materialization fails, the next retry asks the same configured adapter for that same idempotent session; operational reconciliation/void policy remains a later provider-specific concern.

Uniqueness on `booking_intent_id` and `(owner_id, idempotency_key)`, plus request and handoff digests, enforces:

- identical retry returns the original booking/payment result;
- double click cannot create a second booking or payment;
- one intent cannot switch method or key after being claimed; and
- one key cannot bind a different intent or method.

The in-memory store follows the same contract but is explicitly process-local and non-production.

## Bankak path

Bankak is a manual rail outside the PSP registry. The server requires configured display-only account details and a trusted SDG amount resolver; the durable RPC independently calculates the SDG amount from current `fx_config` (or rate 1 for an SDG customer price), copies only the configured display name and masked account number, and sets:

- payment `awaiting`;
- booking `pending_payment`; and
- payment expiry to exactly 24 hours from database materialization.

The UI shows the configured masked instructions and payment reference. It explicitly says that Finance review and payment confirmation have not happened. Receipt upload is not newly implemented or auto-triggered; the B12 response marks this screen's receipt action unavailable. The existing write-once receipt and Finance review boundaries are unchanged.

The 24-hour Bankak payment window is not a supplier fare guarantee. Commercial validity is required before initiation, but a supplier fare may cease to be available during manual review. B12 does not invent a hold, rebooking, or automatic fare guarantee to hide that operational tension.

## PSP path

The server chooses an enabled adapter through the existing PSP registry. The browser chooses only `card`; it cannot select `mock_psp`, Checkout.com, or any other provider.

The trusted adapter request uses the reserved payment ID/reference, authoritative amount/currency, server idempotency key, and server-configured return URL. Returned redirect URLs, when present, must be HTTPS and match a server allowlist. The session must remain `awaiting`; any other initiation status fails closed. A trusted explicit expiry is mandatory, using the provider expiry or a bounded server-configured expiry.

The deterministic `mock_psp` is the only executable adapter in this repository and is test/local/staging-only with no network or real money. The Checkout.com class remains a conformance-only skeleton and is rejected as configuration unavailable. There is no live PSP claim, provider failover, webhook simulation, capture, void, or refund in B12. Payment confirmation remains exclusively owned by the existing verified event/reconciliation path.

## Wallet decision

Wallet is deferred. The requested canonical `create_booking_from_wallet()` function does not exist in the current repository or migrations; only unsafe legacy prototype text mentions a wallet. B12 does not create a second debit path or reinterpret Apple Pay/Google Pay as the missing internal wallet. A future wallet adapter must reuse a reviewed atomic debit/booking function rather than this Bankak/PSP materializer.

## PII and security

Traveler/contact PII is resolved from the private B11 intent and is never resubmitted by the browser or returned in the handoff. It is copied only into the existing canonical booking traveler snapshot during atomic materialization. No PII is written to URLs, logs, IDs, idempotency keys, PSP public responses, or generic errors. If a future PSP requires contact data, a server adapter may receive the minimum required private values; the current PSP contract does not receive them.

The new table has RLS enabled without `FORCE RLS`, an explicit deny policy for browser roles, and no direct table grant to `anon`, `authenticated`, or `service_role`. A Gate A compatibility guard requires the B11 intent table, the B12 initiation table, and both B12 RPCs to share one owner. The RPCs are `SECURITY DEFINER`, pin an empty `search_path`, fully qualify relations, revoke default/browser execution, and grant execution only to `service_role`. This preserves the final B11 table-owner security model without depending on a `BYPASSRLS` role attribute. It follows current Supabase guidance on separate grants and RLS controls, pinned `search_path`, and explicit function privileges: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database Functions](https://supabase.com/docs/guides/database/functions), and [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api).

## Frontend behavior

The B11 ready state now presents Bankak and Card categories. The coordinator:

- shares an identical double click;
- aborts the prior UI request when the method changes;
- prevents a late prior response from overwriting the newer method;
- retains the same idempotency key for an identical retry; and
- never shows a payment/booking success claim from initiation alone.

Bankak renders the safe instructions and awaiting state. PSP renders a continue link only if the trusted adapter returned an allowlisted URL; otherwise it honestly reports that no external portal link exists. Mock/Sandbox handoffs are labeled non-live.

## Runtime and migration reality

The B11 migration `20260829120000_flight_booking_intents_v1.sql` and B12 migration `20260829183000_flight_payment_initiation_v1.sql` are code/schema definitions only in this batch. Neither was applied or checked against Staging or Production.

Durable runtime requires, in order:

1. the already-reviewed payment-authority and multi-supplier identity schema;
2. the B11 private booking-intent migration;
3. durable persisted offers populated with exact `internal_offer_key`, provider identity/reference, current customer amount/currency, and expiry; and
4. the B12 reservation/materialization migration plus a server-only authenticated host.

The Supabase CLI was unavailable in this build environment. The migration is covered by structural regression tests only and requires an independent SQL review plus disposable/Staging runtime validation before application. No migration was applied here.

## B13 handoff

B13 must not consume `PAYMENT_INITIATED`, a redirect, a PSP session, a Bankak transfer claim, or booking `pending_payment` as supplier-booking authority.

B13 may start supplier execution only when trusted existing confirmation paths have produced both:

```text
payment.status = confirmed
AND
booking.status = payment_confirmed
```

Payment confirmation still does not mean supplier booking confirmation. B13 must preserve that separation and use the already-selected private provider identity without browser input or automatic supplier rebooking.
