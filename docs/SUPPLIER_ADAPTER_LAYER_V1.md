# Supplier Adapter Layer V1

This layer is a server-only, provider-neutral boundary. V1 implements the flight contract and a deterministic synthetic adapter. `hotels_search` is reserved in the capability vocabulary but disabled; no hotel inventory semantics are asserted yet. No real supplier, credentials, SDK, network call, database write, deployment, or production project is involved.

## Boundaries

```text
Frontend/Search
  -> HAJIZ Search Service (validates request; client cannot choose provider)
  -> Supplier Registry (server-configured enabled adapter; fail closed)
  -> Flight Supplier Adapter
  -> private normalized offer (opaque refs/raw status/net economics stay server-side)
  -> HAJIZ Pricing Service (markup and selling-price authority)
  -> frozen public customer offer

Payment confirmed
  -> Booking Orchestrator (requires payment_confirmed; moves to processing)
  -> Supplier Adapter createBooking/getBookingStatus
  -> normalized operational outcome
  -> trusted apply_booking_transition
  -> confirmed, then ticketed only with verified ticket metadata

Ticketed
  -> ticket artifact metadata boundary (opaque artifact ref/media type only)
```

The public flight offer is HAJIZ-owned and contains exactly: `airline`, `airlineCode`, `flightNumber`, `segments`, `origin`, `destination`, `departure`, `arrival`, `durationMinutes`, `stops`, `cabin`, `baggage`, `sellingAmount`, `currency`, and `expiresAt`. Supplier references, raw statuses/payloads, net amounts, taxes, margins, and private metadata must never be serialized to the browser. Raw payload retention, when a real adapter is added, must be encrypted/redacted and audit-safe.

## Contract and state authority

The flight surface is `health`, capabilities, `searchFlights`, `repriceOffer`, `createBooking`, `getBookingStatus`, plus capability-gated `confirmBooking`, `issueTicket`, `cancelBooking`, and `retrieveTicket`. Providers may use holds internally, but those states remain private. HAJIZ states remain only `pending_payment -> payment_confirmed -> processing -> confirmed -> ticketed -> completed`. Payment confirmation is not supplier confirmation; confirmation is not ticketing. Ticket access starts only after trusted evidence maps to `ticketed` (or later `completed`). Adapters return values and never mutate booking/payment tables.

`createBooking` and `issueTicket` require stable, server-generated idempotency keys scoped to the HAJIZ booking and operation. A retry must return the original supplier identity/outcome. Traveler details enter through a server-owned token/normalized request; adapters must not log request bodies, put PII in URLs, or include PII in test snapshots.

There is deliberately no automatic provider failover. Unknown/disabled providers fail closed, and client provider hints are rejected. A later orchestrator may explicitly select a different provider before supplier booking begins; it must never silently create a second reservation, rebook, or recharge after an ambiguous/failed attempt.

## Mock and legacy migration

`synthetic_mock_flights` is for tests/local/staging only. It has no network path and deterministically provides DXB to KRT, EK 735, repricing, idempotent booking identity, confirmed-then-ticketed status progression, ticket metadata, and cancellation. It is synthetic inventory.

Legacy prototypes mention Duffel-shaped display data and passenger field conventions. They are not imported or wired because they mix presentation assumptions with provider-shaped data. A future Travelport sandbox adapter should translate its request/response types only inside a new server adapter, redact raw payloads, pass contract conformance tests, and leave HAJIZ pricing, state transitions, persistence, retries, and provider selection outside the adapter.

## V1 limitations

- In-memory mock state resets with the process and is not a production idempotency store.
- No real availability, hold, fare rules, cancellation/refund economics, ticket download, webhooks, or reconciliation.
- No hotels contract beyond the disabled capability name.
- No failover, multi-provider ranking, or automatic recovery orchestration.
