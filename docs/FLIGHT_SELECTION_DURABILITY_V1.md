# Flight Selection Durability V1 — Review Contract

Status: proposal only. This document and its companion SQL do not create a migration, change runtime code, or authorize deployment.

## Boundary and invariants

This boundary replaces, in a later implementation batch, the two process-local pre-booking reverse maps. It does not change any public contract.

- `hca_v2` is an opaque search-selection resolution handle. It is not a booking, payment intent, supplier reservation, ticket, or availability proof beyond its expiry.
- `hpr_v1` is an opaque authoritative repriced-selection handle. It has the same exclusions.
- `hcg_v1`, `hca_v2`, `hpr_v1`, Search, Reprice, Checkout, and Booking Intent public formats remain unchanged.
- B9's historical durability discussion predates Handle V2. Current canonical semantics are: a materially different context or representative gets a different `hca_v2`; arbitrary same-handle rebinding is forbidden.

The stores are pre-authentication authority. Search is legitimately public and authentication can occur later, so neither table has `owner_id`. Ownership begins at the separately protected Booking Intent boundary.

## Search selection store

Table: `app_private.flight_search_selections`.

Primary identity is `alternative_id`, constrained to `^hca_v2_[0-9a-f]{32}$`. Stored authority is:

- `alternative_id`, `payload_digest`
- exact retained `internal_offer_id`, `provider`, and `provider_offer_ref`
- `itinerary_snapshot`, `fare_snapshot`, `previous_customer_price_snapshot`
- `passenger_composition`
- authoritative `expires_at` and server `created_at`

Expiry is the earliest trusted applicable expiry: supplier-offer expiry and previous Customer Price `validUntil`. The trusted server calculates it before persistence; the RPC also refuses an already-expired value against `transaction_timestamp()`. Expiry never slides and cannot be supplied by a browser.

Replay policy:

- new `alternative_id`: insert;
- same ID and exact digest: idempotent success;
- same ID and different digest: `SELECTION_IDENTITY_CONFLICT`, fail closed;
- the whole Search batch runs in one RPC statement/transaction, in stable ID order; any invalid row or collision aborts all rows.

`remember_flight_search_selections_v1(jsonb)` is service-only. `get_flight_search_selection_v1(text)` returns only the trusted fields Reprice needs, distinguishes not-found from expired internally, and never revives an expired record.

## Priced selection store

Table: `app_private.flight_priced_selections`.

Primary identity is `priced_selection_id`, constrained to `^hpr_v1_[0-9a-f]{40}$`. Stored authority is:

- `priced_selection_id`, `payload_digest`, and source `alternative_id`
- exact `internal_offer_id`, `provider`, and `provider_offer_ref`
- `customer_price_snapshot`, `itinerary_snapshot`, `fare_snapshot`
- `passenger_composition`
- authoritative `expires_at` and server `created_at`

Expiry is exactly the current authoritative Customer Price `validUntil`. Replay is insert / identical-digest idempotent success / different-digest fail closed. `create_or_get_flight_priced_selection_v1(...)` and `get_flight_priced_selection_v1(text)` are service-only.

No FK is used between these stores or to bookings, payments, `public.offers`, or `app_private.supplier_operations`. A priced selection can remain valid after its originating search row becomes cleanup-eligible, and bookings do not yet exist. Lifecycle coupling would incorrectly invalidate valid pre-booking authority.

## Canonical payload digests

Each digest is lowercase SHA-256 hex (`^[0-9a-f]{64}$`), computed inside the database from a fixed-position JSONB array. JSONB normalizes nested object key order. Timestamps are normalized to UTC with six fractional digits (`YYYY-MM-DDTHH24:MI:SS.USZ`) before hashing. UTF-8 bytes are hashed. Digests are private and never returned to a browser.

Search digest positions, in order:

1. `flight-search-selection-payload/v1`
2. `alternative_id`
3. `internal_offer_id`
4. `provider`
5. `provider_offer_ref`
6. `itinerary_snapshot`
7. `fare_snapshot`
8. `previous_customer_price_snapshot`
9. `passenger_composition`
10. normalized `expires_at`

Priced digest positions, in order:

1. `flight-priced-selection-payload/v1`
2. `priced_selection_id`
3. `alternative_id`
4. `internal_offer_id`
5. `provider`
6. `provider_offer_ref`
7. `customer_price_snapshot`
8. `itinerary_snapshot`
9. `fare_snapshot`
10. `passenger_composition`
11. normalized `expires_at`

Every authority-bearing field is covered. No arbitrary `ON CONFLICT DO UPDATE` is allowed.

## Snapshot bounds

Bounds are deliberately above current canonical fixtures while preventing generic unbounded JSONB:

| Field | Maximum UTF-8 JSON bytes | Rationale |
|---|---:|---|
| itinerary | 16,384 | bounded segment projection with operational headroom |
| fare | 8,192 | canonical fare projection with headroom |
| Customer Price | 4,096 | compact authoritative price contract |
| passenger composition | 1,024 | exact `{ADT,CHD,INF}` object |

`internal_offer_id` is 1–255 characters, `provider` follows `^[a-z0-9][a-z0-9_-]{0,63}$`, and `provider_offer_ref` is 1–512 characters. Passenger keys are exactly ADT, CHD, and INF with non-negative integers. No maximum passenger-count product policy is introduced.

The stores exclude raw supplier responses, OAuth tokens, credentials, supplier net, margin, commission, FX snapshots not already part of authoritative Customer Price, ranking diagnostics, browser owner/role, and browser-supplied provider, internal ID, price, or expiry.

## Database security

- Both tables are in `app_private`, have RLS enabled, and use `NO FORCE ROW LEVEL SECURITY` only because the table owner and reviewed `SECURITY DEFINER` RPC owner must match.
- A deny policy covers `anon` and `authenticated`; all direct privileges are revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- `service_role` receives EXECUTE only on four named RPCs. `PUBLIC`, `anon`, and `authenticated` have EXECUTE revoked.
- Each RPC uses `SECURITY DEFINER`, `SET search_path = ''`, fully qualified objects, bounded inputs, and safe internal errors.
- The proposal aborts if any same-name table, index, policy, or function already exists. Conversion must replace that conservative first-install guard only with full catalog-signature equality checks; it must never repair drift using DROP or arbitrary CREATE OR REPLACE.
- A final owner-consistency guard requires both tables and all four RPCs to share the same owner.

The SQL is review-only: it opens an explicit transaction and ends with `ROLLBACK`. It must first be validated in a disposable local database. It is not approved for Staging.

## Future JavaScript interfaces

Both implementations will expose the same asynchronous shape:

```js
// Search selection store
await store.rememberSearch(entries)
await store.resolve(alternativeId)

// Priced selection store
await store.createOrGet(record)
await store.resolve(pricedSelectionId)
```

Durability labels remain explicit: `process-local-non-production` and `supabase-private-persistence`. Persistence is extracted from the Reprice domain service and injected; it is not hidden inside the service.

## Required async propagation (later implementation only)

1. **Search HTTP:** await `rememberSearch(resolutionEntries)`. Any persistence failure fails Search closed. No Customer alternative may be returned before its complete reverse-map batch commits.
2. **Reprice:** use `await resolver.resolve(alternativeId)` for search-selection resolution. Await priced-selection `createOrGet` before returning an `hpr_v1`.
3. **Checkout:** `prepare()` already supports async orchestration; it must await priced-selection resolution. A replacement `hpr_v1` must be durably stored before the response contains it.
4. **Traveler Validation:** propagate async through the current synchronous priced-selection resolution without weakening exact ADT/CHD/INF validation.
5. **Booking Intent:** await durable priced-selection resolution before computing `pricedSelectionDigest`, `payloadDigest`, trusted provider identity, or validating travelers. Existing Booking Intent durability and ownership remain unchanged.

Internal failures are classified as `NOT_FOUND`, `EXPIRED`, `PERSISTENCE_UNAVAILABLE`, and `IDENTITY_DIGEST_CONFLICT`. Public mapping should preserve existing B9/B10/B11 semantics where possible and must never expose SQLSTATE text, database bodies, provider identity, internal IDs, or stacks. Any unavoidable public taxonomy change requires a separate review.

## Explicit non-scope

No migration, runtime implementation, Redis, cleanup worker, cron, automation, host, browser transport, Edge Function, supplier enablement, Travelport/Duffel change, Model B/pricing/FX change, booking/payment state change, Supabase contact, Bankak, Account/Catalog, Hotels/H2, Production, or Legacy work is authorized here. `supplier_operations` and `public.offers` are not repurposed.
