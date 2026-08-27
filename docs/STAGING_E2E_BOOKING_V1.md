# HAJIZ Staging E2E Booking Orchestration V1

This track proves the trusted sequence `pending_payment -> payment_confirmed -> processing -> confirmed -> ticketed` with the deterministic Mock PSP and Mock Flight Supplier. It does not call Travelport, Checkout.com, or any real-money or live-inventory endpoint.

`runStagingMockBookingV1` is server-only orchestration. It accepts a gateway whose methods map to the existing trusted boundaries: `apply_payment_event`, `apply_booking_transition`, and `get_my_bookings`. The orchestrator itself has no database client and no direct table mutation. Amount and currency come from `trustedPayment`; provider events are normalized and checked before the payment-authority handoff. Supplier execution cannot begin until the gateway rereads `payment_confirmed`.

The mock payment and supplier booking identities are deterministic. A completed `ticketed` retry reads the My Trips projection and performs no payment or booking transition. The database remains the cross-process replay authority through provider-event uniqueness, checkout idempotency, transition guards, and audit rows.

## Live Staging status

No Staging credentials were available in the execution environment, so no live write was attempted. The automated conformance suite exercises signed-boundary-shaped gateway calls and role separation locally. A live run must target only project `pdnuswmljownjzjzpoop`, use synthetic user/offer/traveler identifiers, call the existing authenticated checkout and read RPCs plus service-role-only transition RPCs, and delete only captured IDs in dependency order. Production project `ckqxmacpojierkyxmiip` is forbidden.

The live rehearsal remains blocked until an explicitly scoped Staging publishable key, service-role secret, and disposable test-user authority are supplied. Do not place those values in this repository, browser code, logs, or public environment variables.
