# HAJIZ Multi-Supplier Search B2

## Scope

Batch 2 adds an internal, server-owned multi-supplier flight-search orchestrator. The pipeline stops after validated deterministic aggregation:

`validated search input -> enabled/capable registry resolution -> bounded parallel execution -> FlightOfferV1 validation -> isolated outcomes -> deterministic internal aggregation`

It does not implement deduplication, pricing, FX, ranking, frontend projection, booking operations, a database ledger, or supplier enablement.

## Execution and concurrency model

`createMultiSupplierFlightSearchOrchestrator` resolves `search_flights` adapters exclusively through `getEnabledSuppliersForCapability`. Client fields that could name, list, or order providers are rejected. Zero capable enabled suppliers raises the canonical `FLIGHT_SEARCH_UNAVAILABLE` error.

A fixed worker pool limits concurrent supplier attempts. `maxConcurrency` defaults to 3 and accepts only server-configured integers from 1 through 16. Queued attempts start only when a worker is free. This is bounded parallelism, not unbounded `Promise.all` fan-out.

## Timeout model

Each provider attempt has its own server-owned timeout. `supplierTimeoutMs` defaults to 5000 ms and accepts only validated server configuration. The adapter receives `{ signal, deadlineAt, traceId }`; Travelport forwards the signal into its pre-production HTTP calls but remains disabled and credential-gated.

No separate global timer is used in Batch 2. With `N` suppliers, concurrency `C`, and per-supplier timeout `T`, the queue is bounded by approximately `ceil(N/C) * T` plus local scheduling overhead. A global deadline can be added later only if operational evidence requires a stricter request budget.

Timeout finalization aborts the adapter signal, removes the timer, and records one terminal outcome. The supplier promise always has both resolution and rejection handlers, so a late resolution or rejection is ignored without changing the finalized result, emitting contradictory telemetry, or causing an unhandled rejection.

## Failure isolation and result semantics

Each provider produces exactly one internal outcome:

- `success`: valid `FlightOfferV1[]` containing at least one offer
- `no_results`: valid empty array
- `timeout`: provider deadline elapsed
- `error`: provider invocation rejected
- `invalid_response`: non-array output or any malformed offer

Validation is fail-closed per provider attempt. If one item is invalid, none of that provider's offers are admitted.

The private result contract is `multi-supplier-flight-search/v1` and contains a trusted trace ID, overall status, private offers, provider outcomes, timestamps, and duration.

- `COMPLETE`: every attempted supplier ended in `success` or `no_results`.
- `PARTIAL`: at least one supplier ended in `success` or `no_results`, and at least one ended in timeout, error, or invalid response. It may contain zero offers.
- `UNAVAILABLE`: no supplier completed successfully.

## Deterministic aggregation

Supplier outcomes follow registry order, regardless of completion speed. Offers are concatenated in that supplier order, preserving each adapter's own offer order. This is deterministic internal aggregation, not customer ranking.

The later customer ordering pipeline remains:

`Normalization -> Dedup/Grouping -> HAJIZ Pricing -> FX -> Final Customer Price -> Ranking`

## Telemetry

Telemetry is injected through a minimal `emit(event)` sink. The safe default is a no-op sink. Supported events are:

- `search.started`
- `supplier_search.started`
- `supplier_search.completed`
- `supplier_search.timeout`
- `supplier_search.failed`
- `search.completed`

The allow-listed fields are trace ID, provider, outcome/status, duration, offer count, safe error code, supplier count, and timestamp. Events never include raw exceptions, raw responses, credentials, tokens, offers, supplier economics, provider references, private metadata, or customer data.

## Intentionally unresolved

Travelport remains disabled; its process-local reference `Map`, opaque-key blocker C-02, implicit `globalThis.fetch` default, and explicit enable flag remain unresolved. Supplier-operation ledger wiring, deduplication, pricing, FX, ranking, frontend integration, and hotel contracts are outside Batch 2.
