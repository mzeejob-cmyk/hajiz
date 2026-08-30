# HAJIZ Flight Ticketing and Final Confirmation B14

## Entry authority and B13 dependency

B14 is an internal, provider-neutral `flight-supplier-ticketing/v1` boundary. It accepts only a booking UUID and stable server idempotency key after trusted ownership resolution. Ticketing is applicable only when the canonical booking is exactly `confirmed` and its exact B13 execution is durably `ACCEPTED`, has an acceptance timestamp, and carries the same provider and supplier booking reference already frozen on the booking.

Payment confirmation, a PNR, a supplier booking reference, a browser status, or a ticketing request by itself is not ticket evidence. The browser cannot provide supplier identity, B13 state, PNR, ticket number, traveler identity, ticket status, artifact reference, owner, or commercial data. B14 never creates or replaces a supplier booking.

## Adapter and live reality

The existing supplier registry and explicit `confirm_booking` / `retrieve_ticket` capabilities remain the adapter boundary. Providers that require explicit issuance use `confirm_booking`; providers that ticket as part of booking may use the read-only retrieval path. Reconciliation calls only `retrieve_ticket`, never a second issuance operation.

The new deterministic `mock` ticketing adapter is non-live, rejects production construction, performs no network call, and returns conspicuously synthetic ticket metadata for tests only. It is not airline fulfillment. There is no enabled live ticketing adapter. Travelport `confirm_booking`, `retrieve_ticket`, and booking-status capabilities remain false.

## Evidence, PNR distinction, and lifecycle

A B13 supplier booking reference or locator/PNR proves only that a booking exists. B14 reaches `ISSUED` only when the normalized supplier response contains one unique ticket number for every authoritative traveler key, a real supplier issuance timestamp, exact supplier booking identity, and optional artifact metadata actually returned by the adapter.

The successful lifecycle is:

```text
booking confirmed + B13 ACCEPTED
→ PREPARED durable ticketing claim
→ REQUEST_SENT (booking remains confirmed)
→ PROCESSING (booking remains confirmed)
→ ISSUED with complete ticket records
→ booking ticketed
```

B14 never marks `completed`. The repository has no reviewed rule that equates ticket issuance with completed travel.

## Durable idempotency and unknown outcomes

Migration `20260830090000_flight_ticketing_confirmation_v1.sql` adds a private one-per-booking ticketing execution and private per-traveler ticket records. The execution is claimed before supplier I/O, has an attempt count bounded to one, and links to the immutable B13 execution and generic supplier operation ledger. Concurrent requests, restarts, event replays, and post-success replays resolve the same durable execution.

Definite rejection, pre-send/configuration failure, processing, malformed response, post-send timeout, and unknown outcome remain distinct. Any issuance call that may have reached the supplier becomes `UNKNOWN` with reconciliation required. It is never blindly reissued. A trusted retrieval capability may reconcile; otherwise the record remains blocked for provider/manual review.

## Ticket records and artifact boundary

Each private ticket record is tied to the canonical booking, owner, B14 execution, provider, and opaque B11 traveler key. It stores only returned ticket number/reference, issuance timestamp, and normalized artifact state. Multiple passenger tickets are modeled as multiple records; a single booking-level ticket number is not assumed.

Artifacts are private and default to `NONE`. `METADATA_ONLY` means ticket data exists but there is no downloadable airline document. `AVAILABLE` requires an opaque artifact reference, media type, and digest returned by the trusted adapter. B14 does not generate a PDF, URL, itinerary, receipt, PNR, document number, or airline ticket. The owner-scoped customer RPC exposes ticket numbers and artifact availability only after both the booking is `ticketed` and the execution is `ISSUED`; it never exposes an artifact reference or storage path.

## My Trips and customer confirmation

My Trips continues to read canonical booking and payment RPCs and adds two owner-scoped read RPCs for ticketing summary and ticket records. It keeps the customer meanings separate:

- `payment_confirmed`: “تم تأكيد الدفع”;
- supplier-confirmed booking without issued evidence: “تم تأكيد الحجز مع شركة الطيران”;
- ticketing request/processing: “جاري إصدار التذكرة”;
- unknown outcome: “جاري التحقق من حالة إصدار التذكرة”;
- `ticketed` plus `ISSUED` ticket records: “تم إصدار التذكرة”.

`canDownloadTicket` is false until every persisted traveler ticket has an `AVAILABLE` trusted artifact. Ticket details load by authenticated POST RPC using the displayed HAJIZ booking reference, never a PNR/passport/ticket number in a URL. Stale or contradictory `ticketed` state without B14 evidence is presented as requiring review, not as issued.

## Privacy and firewalls

Ticket and traveler data remain server/private. Public execution results exclude ticket numbers, provider identity, supplier booking reference, raw payloads, credentials, traveler PII, and artifact references. No request bodies or supplier responses are logged.

B14 has no payment, Bankak, PSP, wallet, repricing, FX, margin, commission, supplier-net, selling-price, supplier-booking, cancellation, refund, or completion authority. Bankak expiry remains 24 hours; price-lock timings are unrelated and unchanged.

## Runtime status and next gate

This batch is code/schema definition only. The migration was not applied to Staging or Production, no database or supplier was contacted, and no live ticket was issued. A later runtime gate must verify first application, exact replay, ownership/ACL/RLS, concurrent claims, rollback, ticket IDOR, My Trips projections, and reconciliation using isolated synthetic records.

B10, B11, B12, B13, and B14 remain **IMPLEMENTED**, not closed. The next action is the independent Flight Gate review across all five batches. Live supplier work and `completed` lifecycle semantics remain outside B14.
