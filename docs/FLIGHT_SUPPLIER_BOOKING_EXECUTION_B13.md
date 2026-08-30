# HAJIZ Flight Supplier Booking Execution B13

## Authority and scope

B13 is an internal, provider-neutral `flight-supplier-booking-execution/v1` boundary. It accepts only a canonical booking UUID and a server idempotency key after trusted ownership has been established. Supplier execution is applicable only when the canonical payment linked to that booking is exactly `confirmed` and the booking is exactly `payment_confirmed`.

Payment initiation, a Bankak receipt, a PSP session or redirect, and browser-supplied state are never supplier-booking authority. B13 cannot confirm payment or approve any payment rail. The browser cannot supply provider, offer identity/reference, economics, travelers, contact details, owner, supplier reference, locator, PNR, or booking/payment states.

## Protected lineage and supplier identity

The durable prepare RPC locks and resolves the booking, its one canonical payment, the materialized B12 initiation, the B11 intent, and the selected persisted offer. It fails closed unless ownership and every relationship match. The following identities must agree exactly:

- B11 `internal_offer_id` = durable offer `internal_offer_key`;
- B11 `provider` = booking and offer supplier provider; and
- B11 `provider_offer_ref` = durable offer provider reference.

No substitution, browser replacement offer, silent supplier switch, fallback supplier, or automatic rebooking exists. Traveler/contact snapshots are resolved from B11 on the server. The current deterministic adapter receives only an opaque trusted traveler token because it needs no PII. A future live adapter must resolve and receive only its reviewed minimum private fields inside the server boundary.

## Adapter reality

The existing supplier registry and canonical `create_booking` / `get_booking_status` capabilities remain the adapter boundary. The deterministic `mock` adapter is the only executable booking adapter in this repository. It is synthetic, process-local, non-live, makes no network call, and handles no real inventory.

Travelport booking remains disabled. Credentials alone do not enable it: persistent Travelport offer context, a provisioned booking contract, reviewed request/response mapping, reconciliation behavior, and explicit server configuration are still required. B13 makes no Staging or production supplier-booking claim.

## Durable execution and lifecycle

Migration `20260829213000_flight_supplier_booking_execution_v1.sql` adds the private `app_private.flight_supplier_booking_executions` record while retaining `app_private.supplier_operations` as the canonical generic operation ledger. One unique execution exists for each booking and one unique owner/idempotency identity exists for each execution.

The trusted flow is:

```text
payment confirmed + booking payment_confirmed
→ PREPARED durable claim
→ atomic REQUEST_SENT claim + booking processing
→ supplier createBooking once
→ SUBMITTED (supplier still processing)
→ ACCEPTED + booking confirmed only after supplier acceptance
```

The request-sent claim increments a bounded attempt count from zero to one before the adapter is invoked. Concurrent processes therefore receive `should_send = false`; process-local promise coalescing is only an optimization. Replays and restarts resolve the durable record and never issue a second create-booking call. A changed key or digest conflicts rather than creating another operation.

The booking is never advanced to `ticketed` or `completed`. A ticket-like adapter response is rejected into unknown-outcome handling, and ticket metadata is not persisted or projected by B13.

## Unknown outcomes and reconciliation

B13 distinguishes known pre-send/configuration failure, definite supplier rejection, and ambiguous post-send failure. A timeout, abort, malformed response, unclassified internal failure after the request-sent claim, or an adapter-declared may-have-reached condition becomes `UNKNOWN` with `reconciliation_required = true`.

An `UNKNOWN` execution is never blindly retried. If a trusted supplier booking reference exists, the separate internal reconciliation method may call only `getBookingStatus`; it never calls `createBooking`. Without that reference the execution stays blocked for provider/manual reconciliation. Only a strict, matching supplier `confirmed` result can resolve the execution to `ACCEPTED` and the booking to `confirmed`.

The record retains the generic operation ID, booking/payment/B11 lineage, exact provider identities, attempt and response timestamps, optional real supplier reference/locator, response digest, bounded safe metadata, acceptance time, failure code, and reconciliation state. It never invents a PNR or supplier reference.

## Security, privacy, and public projection

The new private table has RLS enabled without `FORCE RLS`, an explicit browser deny policy, and no direct table grant to browser or service roles. Four public-schema RPCs are `SECURITY DEFINER` only because they atomically cross the private lineage and canonical booking/payment tables. They pin `search_path = ''`, fully qualify relations, revoke default/browser execution, grant only `service_role`, and must share ownership with the B11/B12/B13 private tables and generic supplier ledger. There is no undocumented `BYPASSRLS` dependency.

The internal response contains only contract status, booking ID/reference, canonical booking state, reconciliation flag, and acceptance time. It excludes traveler/contact PII, provider identity, supplier references/locators, economics, raw responses, credentials, and diagnostic internals. Source and tests prohibit PII logging.

## Frontend

The frontend adds a presentation-only canonical booking-state component. `processing` renders “جاري تأكيد الحجز مع شركة الطيران”. `confirmed` renders “تم تأكيد الحجز مع شركة الطيران” and explicitly says this is not ticket issuance. It has no execution button, adapter call, direct database write, or provider identity.

## Migration and runtime status

This is a code/schema definition only. The migration was not applied to Staging or Production, and no database or supplier was contacted. A later runtime gate must verify first application, exact replay, owner alignment, ACL/RLS behavior, concurrent claim behavior, rollback, and reconciliation with synthetic records before enablement.

## B14 handoff

B14 may proceed only when both are true:

```text
booking.status = confirmed
AND
a real persisted supplier booking result is ACCEPTED
```

B14 exclusively owns ticket issuance/retrieval, ticket artifacts and numbers, the `ticketed` transition, final customer ticket confirmation, and My Trips ticket availability. B13 success never means a ticket was issued.
