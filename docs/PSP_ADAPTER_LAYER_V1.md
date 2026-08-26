# HAJIZ PSP Adapter Layer V1

Status: provider-neutral server contract plus a deterministic non-money mock. No real PSP, credentials, SDK, network integration, database migration, deployment, or production change is included.

## Boundary and flow

```text
Payment Authority (trusted payment row)
        |
        v
PSP Adapter Registry -- server-configured name, enabled check, fail closed
        |
        v
Provider Adapter -- create session / reconcile / capture / void / refund

Provider webhook request
        |
        v
Provider Adapter verifyWebhookEvent + normalize
        |
        v
Trusted economics + provider identity validation
        |
        v
service-role apply_payment_event RPC
        |
        v
Payment Authority state machine + booking payment_confirmed boundary
```

The adapter never writes payment or booking tables. It returns data to a trusted orchestration service, which validates the normalized result against the server-owned payment row and then calls the existing service-role-only `apply_payment_event` boundary. Raw provider bodies are not forwarded by this V1 helper; only a SHA-256 digest and normalized fields cross the handoff. Protected raw audit retention can be added later under an explicit retention/redaction policy.

Browser redirects and callbacks are presentation hints. A `returnUrl`, even one already approved by the upstream server allow-list, cannot confirm payment. Only a verified webhook or a trusted server-side status reconciliation may produce a trusted normalized event for the domain handoff.

## Contract surface

Every adapter implements these server-only methods:

- `createPaymentSession(trustedPayment)` creates or returns an idempotent opaque session.
- `verifyWebhookEvent(serverRequest)` verifies authenticity and returns the strict normalized event shape. It does not mutate domain state.
- `getPaymentStatus(trustedQuery)` performs trusted server reconciliation.
- `capture(trustedCommand)` is gated by `authCapture`.
- `voidAuthorization(trustedCommand)` is gated by `voids`.
- `refund(trustedCommand)` is gated by `refunds`.
- `getMetadata()` reports name, mock/network markers where relevant, and immutable capabilities.

Session input contains exactly the internal `paymentId`, internal `paymentReference`, PSP payment method, server-owned amount/currency, idempotency key, and upstream-allowlisted return URL. A browser must never construct this object from client pricing, FX, status, or arbitrary provider selection.

The normalized provider event contains exactly:

```text
verified
providerEventId       opaque string
providerPaymentId     opaque string, matched against protected provider metadata
normalizedStatus      one frozen HAJIZ payment state
amount
currency
occurredAt
rawDigest             lowercase SHA-256
```

Frozen statuses remain exactly `awaiting`, `under_review`, `confirmed`, `rejected`, `expired`, and `refunded`. Adapters must reject unknown provider states until a reviewed mapping exists. They must not introduce `authorized`, `captured`, `paid`, or any other provider vocabulary into the HAJIZ domain.

## Registry and provider choice

`PspAdapterRegistry` accepts a known adapter registration and an explicit enabled flag. Resolution uses a provider name read from server configuration. Missing, unknown, and disabled names fail closed. `bankak` and `manual_transfer` are reserved and rejected by the registry, so a client-supplied arbitrary name cannot turn into a provider implementation.

There is no automatic PSP failover. HAJIZ must not silently retry a charge with a second PSP after an error or ambiguous result. Any future routing/failover design requires explicit payment-attempt identity, customer consent rules, reconciliation, idempotency across providers, and duplicate-charge controls.

## Capability model

Adapters declare supported `paymentMethods` from `card`, `apple_pay`, and `google_pay`, plus booleans for `authCapture`, `refunds`, `voids`, `webhooks`, and `multiCurrency`. Orchestration must check both the selected payment method and operation capability before calling an optional operation.

Bankak remains a separate manual rail. It continues to use the Payment Authority's server-owned FX snapshot, receipt inspection, `under_review`, and finance/admin decision workflow. It coexists with PSP methods at the checkout/payment domain layer but is not a PSP adapter and never enters this registry.

## Deterministic mock

`MockPspAdapter` is enabled only when construction explicitly supplies `enabled: true` and an environment of `test`, `local`, or `staging`. It makes no network calls, represents no real money, and is named `mock_psp`. Its provider payment/session identities are deterministic for the trusted internal payment plus idempotency key. Reusing the key with changed data fails. It supports deterministic session status checks, capture, authorization void, refund, and signed/unsigned webhook result shapes so tests can exercise the full boundary.

The mock is in-memory and process-local. It is not a ledger, durability mechanism, provider simulator, or substitute for sandbox certification.

## Idempotency and duplicate events

Session idempotency belongs to the server-owned payment record and is passed unchanged to the adapter. A duplicate key with identical trusted data returns the same mock provider identity; reuse with different data is rejected. Real adapters must send the same logical idempotency key using the provider's documented mechanism and persist the opaque provider identity in protected payment metadata.

Webhook uniqueness remains enforced by `(provider, provider_event_id)` in `payment_provider_events`. The adapter verifies and normalizes but does not decide database replay behavior. The existing `apply_payment_event` boundary records a unique event and returns a no-op for a duplicate or disallowed/out-of-order transition. Economics and provider-payment identity are checked before that handoff.

## Future Checkout.com and APS adapters

These are mapping intentions only, not implemented integrations:

| Provider concept | HAJIZ intent |
|---|---|
| successfully captured/settled payment | `confirmed` |
| authorization awaiting a later capture | `awaiting` |
| declined/failed final payment | `rejected` |
| expired payment/session where authoritative | `expired` |
| completed refund | `refunded` |

Before writing either adapter, verify every event name, signature algorithm, timestamp/replay rule, amount unit, currency representation, payment/session identity, idempotency behavior, wallet support, capture/void/refund semantics, and finality rule against the provider's current official documentation. Do not infer fields from the table above. TODOs must remain explicit where official sandbox documentation is incomplete.

Migration `20260826200000_psp_rejected_transition_v1.sql` narrowly permits a trusted PSP event to move a non-Bankak payment from `awaiting` to `rejected`. The unique provider event insert remains the idempotency boundary and a successful transition still writes `payment_audit`. It does not permit PSP rejection from `under_review`; Bankak rejection remains owned by the finance review command.

## Checkout.com sandbox readiness

No Checkout.com or APS credential/configuration was present in the repository environment review. `CheckoutComSandboxAdapterSkeleton` therefore provides only a fail-closed contract surface and reviewed event-name mapping; every network operation is disabled and metadata explicitly reports `live: false` and `conformanceOnly: true`.

The current official Checkout.com Flow documentation uses a server-created Payment Session and says fulfillment must wait for a webhook (or trusted server retrieval), not a success redirect. Its sandbox base URL is account-specific. The fixed HAJIZ contract also lacks a reviewed way to persist the Payment Session ID and later bind the resulting `pay_...` payment ID. Credentialed network work is blocked until that protected identity handoff, account base URL, key scopes, webhook signing key/algorithm handling, currency minor-unit conversion, and exact response/event schemas are reviewed with a real sandbox account.

Reviewed provider mappings are deliberately narrow: `payment_pending`/`payment_approved` remain `awaiting`; `payment_captured` becomes `confirmed`; `payment_declined` and `payment_voided` become `rejected`; `payment_expired` becomes `expired`; and `payment_refunded` becomes `refunded`. Declined operation events such as `payment_capture_declined` are rejected instead of being misrepresented as a payment-state transition.

## Security invariants

- No `service_role`, provider secret, webhook secret, or private key belongs in browser code or public environment variables.
- No browser amount, currency, FX, status, provider metadata, or arbitrary provider name is authoritative.
- No adapter may mutate booking/payment state directly or treat supplier confirmation as payment authority.
- No redirect success can confirm payment.
- Confirmation requires a verified provider event or trusted server reconciliation, exact economics, matched provider identity, and the existing state-machine boundary.
- No adapter may silently retry a charge on another provider.
