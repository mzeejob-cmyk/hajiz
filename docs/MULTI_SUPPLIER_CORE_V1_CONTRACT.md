# HAJIZ Multi-Supplier Core V1 Contract

## Scope

Batch 1 defines contracts and an unapplied persistence design. It does not run supplier fan-out, enable Travelport, change pricing or FX, or apply a database migration.

## Four separate provider concepts

- **Provider** is a canonical internal identifier such as `mock` or `travelport`. A known identifier does not imply working code.
- **Adapter** is an implemented server module that conforms to the flight-supplier contract.
- **Enabled provider** is an implemented adapter explicitly selected by trusted server configuration. Clients cannot enable or select providers.
- **Capability** is an adapter's explicit support for one operation. Enablement never implies that every capability is available.

The registry resolves enabled adapters for a requested capability in deterministic server-configured order. Unknown or duplicate configured providers fail closed. The legacy default-provider resolver remains only for compatible single-supplier callers.

## Canonical offer pipeline

`Supplier response -> FlightOfferV1 normalization -> HAJIZ pricing (later) -> FX (later) -> ranking (later) -> SearchOfferV1 public projection`

`FlightOfferV1` is the private, provider-neutral normalization boundary. Its version is `flight-offer/v1`; unknown versions fail closed. It carries a HAJIZ-owned opaque internal offer ID, internal provider identity/reference, normalized itinerary and segments, fare semantics, supplier-native economics, validity, capabilities, and a bounded private metadata envelope.

`SearchOfferV1` is the public projection. Its version is `search-offer/v1`. It exposes an opaque HAJIZ selection key and an authoritative customer price supplied by the trusted pricing boundary. It never exposes provider identity, provider offer references, supplier-native economics, or private metadata.

Batch 1 does not implement the pricing, FX, ranking, or frontend-consumption stages.

## Adapter and capability contract

The operation vocabulary is `search_flights`, `reprice`, `create_booking`, `confirm_booking`, `get_booking_status`, `retrieve_ticket`, `cancel`, `change`, and `hold`. Every adapter advertises every capability explicitly as enabled or disabled, but it implements methods only for supported operations. Invocation of an unavailable operation raises the canonical `SUPPLIER_CAPABILITY_UNAVAILABLE` backend error.

The shared conformance suite validates both Mock and Travelport adapters without relaxing the private or public contracts. Travelport remains credential-gated and disabled.

## Persistence responsibilities

The unapplied `multi_supplier_identity_and_operations_v1` migration designs three durable boundaries:

1. `offers` receives an opaque internal offer key, provider, contract version, supplier-native amount/currency, and a bounded private reference payload. Provider references are unique within a provider, not globally.
2. `bookings` receives the selected provider and source contract version, so supplier ownership is explicit.
3. `app_private.supplier_operations` records server-owned operation identity, request digest, status, and opaque provider result reference. `(provider, idempotency_key)` prevents reuse of one logical operation identity.

New columns remain nullable for legacy-row compatibility. Application writes must populate them before later hardening is considered. The private ledger has RLS enabled, denies browser roles, and grants its limited writes only to `service_role`. Customers neither choose providers nor read supplier economics.

Transitional offers whose provider is still `NULL` retain unique `supplier_offer_ref` values. Non-null providers use `(supplier_provider, supplier_offer_ref)` uniqueness, so equal opaque references may coexist only when they belong to different providers. This batch does not backfill legacy provider identity.

At most one live or recoverable operation may exist for a `(booking_id, provider, operation)` tuple. Live means `pending` or `unknown`; `succeeded` is terminal and excluded so later legitimate reprices or other repeatable operations are not blocked. Logical retries remain bound by unique `(provider, idempotency_key)`.

Supplier-operation `booking_id`, `provider`, `operation`, `idempotency_key`, and `request_digest` are immutable after insert. A reused idempotency key therefore cannot replace the original digest. Booking `supplier_provider` and `supplier_contract_version` permit initial `NULL -> canonical value` assignment and cannot later be cleared or changed.

## Replacing the Travelport process-local map

Today Travelport retains `providerOfferRef -> transaction/offering/product identifiers` in a process-local `Map`. That is not safe across restarts, multiple processes, horizontal scaling, or delayed reprice.

Before Travelport can be enabled, the minimal identifiers needed to reprice or book must be stored in the protected offer reference payload under the HAJIZ internal offer key, with provider identity, contract version, and expiry. Only the minimum structured reference is durable; credentials, auth responses, and unrestricted supplier response blobs remain ephemeral. Expired references should be rejected and later removed under a separately reviewed retention policy.

The supplier-operation ledger then persists booking-side retries and ambiguous outcomes. No automatic supplier failover or rebooking is implied. Until this design is applied, reviewed, and wired into runtime, Travelport is not safe to enable.

Opaque-key derivation independent of Travelport process memory remains a pre-Travelport-enablement blocker (C-02).

## Deliberately unresolved

Parallel fan-out, timeouts, failure isolation, deduplication, authoritative pricing, FX, ranking, frontend reconciliation, richer provider execution policy, and hotel contracts remain later batches.
