# HAJIZ V1 Payment Architecture Pack

Status: architecture and contract only. No provider integration, UI wiring, database mutation, deployment, or production change is included. The companion SQL is **PLAN ONLY / NOT APPLIED** and is unsuitable for production until reviewed and rehearsed in staging.

## Frozen product policy

The server availability response is the source of truth. V1 enables exactly `card` (Visa/Mastercard), `apple_pay`, `google_pay`, and `bankak`. `paypal`, `samsung_pay`, `tabby`, and `tamara` are reserved but disabled. A future UI must render only enabled methods returned by trusted server/config, never activate future values from a frontend constant.

Payment states are `awaiting -> under_review -> confirmed|rejected|expired`, with an explicit server-only `confirmed -> refunded` transition. PSP methods normally move `awaiting -> confirmed` from a verified webhook/status check; Bankak uses `awaiting -> under_review -> confirmed|rejected`, or expires while unresolved.

Booking states are `pending_payment -> payment_confirmed -> processing -> confirmed -> ticketed -> completed`. Payment confirmation—whether PSP webhook or Bankak finance review—may move a booking only to `payment_confirmed`. Supplier execution is a separate trusted command and only a verified supplier response can move `processing -> confirmed -> ticketed`.

## Unified checkout boundary

`create_checkout` is an authenticated, idempotent server command. Its client request contains only `offerId`, a short-lived `travelerToken`, an enabled `paymentMethod`, an `idempotencyKey`, and optionally an allow-listed HTTPS `returnUrl`. The client never submits an authoritative amount, currency, reference, status, supplier cost, margin, commission, FX rate, provider, or provider metadata.

In one database transaction the server must:

1. authenticate the customer and resolve the offer/travelers from trusted server records;
2. reprice or validate the offer and calculate selling economics using server pricing/FX configuration;
3. generate the booking reference and payment reference;
4. insert the internal booking as `pending_payment` and its payment intent as `awaiting`;
5. persist immutable method/provider metadata and an idempotency record;
6. set `expires_at` where required; and
7. invoke the selected adapter only after the internal transaction can be reconciled safely.

Failures must not leave a client-authoritative or orphaned “confirmed” record. Repeated idempotency keys return the original safe result and cannot create another intent.

### Safe UI responses

Common fields: `bookingRef`, `paymentId`, `paymentMethod`, `sourcePrice { sellingAmount, currency }`, `status`, and nullable `expiresAt`.

Bankak adds only server-calculated `amountSDG`, literal `currency: "SDG"`, `paymentReference`, configured `bankAccountDisplayName`, and `maskedAccountNumber`. No real account data is committed here. PSP methods may add only an opaque `providerSession`/client token when a future provider requires it. Responses exclude supplier net, commission, internal margin, FX rate, reviewer data, raw provider payloads, and unmasked account data.

## Adapter model

The executable provider-neutral boundary is documented in `docs/PSP_ADAPTER_LAYER_V1.md`. It preserves the model below while standardizing method names, capability gates, registry failure behavior, and the normalized handoff to `apply_payment_event`.

The payment hub selects an adapter by enabled method. `card`, `apple_pay`, and `google_pay` share a generic PSP adapter contract; no provider is selected in V1:

```text
createSession(trustedIntent, returnContext) -> opaqueSession
confirmWebhook(verifiedRequest) -> NormalizedPaymentEvent
verifyStatus(trustedIntent) -> NormalizedPaymentEvent
refund(trustedIntent, trustedRefundCommand) -> NormalizedPaymentEvent
```

Normalized events contain an internal payment ID/reference, provider event ID, event type, provider status, amount/currency, occurred-at time, and a verification result. Raw payloads are retained only in protected audit storage with a digest and minimum necessary PII. Webhook signatures, timestamp tolerance, provider event uniqueness, intent match, and exact amount/currency match are mandatory before transition. Browser redirects or success callbacks are presentation hints only and never confirm payment.

Bankak implements the same adapter boundary as a manual-transfer adapter. It reads trusted `fx_config`, locks `amountSDG` and the FX snapshot, generates the reference, copies display-only account configuration into immutable intent metadata, sets expiry, and authorizes a receipt slot. Receipt submission moves `awaiting -> under_review`; finance/admin review moves it to `confirmed` or `rejected`. Expired intents cannot accept receipts or confirmation without an explicit privileged recovery workflow.

## Receipt boundary

The `receipts` bucket remains private. A server-authorized upload (prefer a short-lived signed upload token; strict RLS is the fallback) must verify the authenticated user owns the payment, its method is Bankak, and status is `awaiting`. The only accepted object prefix is `user_id/payment_id/filename`; the server generates/sanitizes the filename. Maximum size is 10 MB and MIME/content checks allow only JPEG, PNG, and PDF. Public URLs, arbitrary paths, overwrite, and list access are forbidden. Submission records object identity, size, detected MIME, hash, actor, IP/request context, and time; malware/content review should precede finance access.

## Authority, roles, and audit

Only finance/admin may review Bankak receipts. Role checks occur server-side against protected privilege data, never a client claim alone. Every create, receipt authorization/submission, review, webhook, status verification, transition, refund, rejection, and supplier action appends an immutable audit event with actor type/id, request and idempotency IDs, before/after states, reason, event digest, and timestamp. Refund is a distinct server command; it never follows a client database update.

The supplier executor consumes only `payment_confirmed` bookings. It transitions to `processing`, calls the supplier through a trusted adapter, and records the supplier response before `confirmed` or `ticketed`. Payment processors and finance reviewers have no supplier-confirmation authority.

## State transition matrix

| Aggregate | From | Event / authority | To |
|---|---|---|---|
| Payment (all) | — | server `create_checkout` | `awaiting` |
| PSP payment | `awaiting` | verified, unique webhook/status; amount matches | `confirmed` |
| Bankak payment | `awaiting` | authorized receipt submitted before expiry | `under_review` |
| Bankak payment | `under_review` | finance/admin approves | `confirmed` |
| Bankak payment | `under_review` | finance/admin rejects | `rejected` |
| Payment | `awaiting` / `under_review` | server expiry job | `expired` |
| Payment | `confirmed` | explicit server refund command/provider result | `refunded` |
| Booking | — | atomic checkout creation | `pending_payment` |
| Booking | `pending_payment` | payment becomes `confirmed` | `payment_confirmed` |
| Booking | `payment_confirmed` | trusted supplier executor starts | `processing` |
| Booking | `processing` | verified supplier confirmation | `confirmed` |
| Booking | `confirmed` | verified ticket/fulfilment artifact | `ticketed` |
| Booking | `ticketed` | completion policy/event | `completed` |

Duplicate or out-of-order events are audited no-ops. Rejection/expiry/refund effects on booking cancellation or recovery require a separate explicit policy; they must not infer supplier confirmation.

## RLS hardening plan and current production blockers

The current production shape is unsafe for rollout until staging-verified remediation:

- `bookings` exposes `net_cost`, `sold_price`, `currency`, `fx_rate_sdg`, `agent_profit`, `commission`, `status`, and `pay_method`, while customers can update their own rows. Revoke client update of economics/status and expose a customer-safe view/projection.
- `payments` exposes reference, amount/currency, receipt/review/status/expiry fields, while client insert checks only booking ownership. Revoke client insert/update; create intents only through the server command and expose a safe view.
- receipt upload currently scopes only the first folder to `auth.uid()` and lacks strict size/MIME/payment authorization. Replace it with the receipt boundary above.
- `fx_config` must be non-client-writable and readable only through safe derived outputs.
- profile self-update is too broad. Separate public identity fields from protected role/privilege/commission fields and deny self-mutation of the latter.
- audit tables must be append-only to trusted server roles and not directly readable if they contain sensitive data.
- `service_role` is server-secret only and must never appear in frontend bundles, logs, browser storage, or public environment variables.
- the active shell correctly has no mutation commands; legacy prototypes contain unsafe direct-write examples and must remain unreachable and excluded from production builds.

The plan-only SQL describes revocations, safe views/functions, transition guards, receipt policies, and audit controls. Before use, reconcile exact production schema, backfill/constraints, role source, storage metadata behavior, and operational recovery in a disposable staging environment.

## Threat model

| Threat | Required control |
|---|---|
| Client economics/status tampering | allow-listed request contract; server repricing; RLS denies direct writes |
| Replay / duplicate checkout | scoped idempotency key and unique constraint |
| Forged browser success | verified server webhook or provider status only |
| Duplicate/reordered webhook | signature/timestamp verification, unique provider event ID, transition guard |
| Amount/currency mismatch | exact trusted-intent comparison; quarantine and audit |
| Forged receipt | payment-bound upload authorization, hash/metadata, finance review |
| Expired intent | server time check on upload, webhook/review, and expiry job |
| Privilege escalation | protected role store and server-side finance/admin authorization |
| Direct RLS writes | revoke table DML; narrow views/RPC; automated policy tests |
| Upload abuse | private bucket, fixed prefix, 10 MB cap, MIME/content validation, rate limits |
| PII leakage | safe projections, masked account data, private objects, redacted logs, retention policy |

## Delivery gate

Before implementation: approve this model, inspect actual schemas/policies, choose a PSP, define webhook/refund SLAs, define finance roles and audit retention, and stage-test the migration. The exact next product step after approval is to implement the multi-method Payment Method Selection + Bankak/Card/Wallet presentation layer from Figma, but only after reviewing whether Figma needs an added payment-method selector before existing Bankak frame 71:26.
