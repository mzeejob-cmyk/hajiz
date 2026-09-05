# Hotels H2 — server boundary and sandbox validation

Verdict: **PARTIAL**. Offline boundary implementation passes. Real hotel supplier sandbox
mapping validation is **BLOCKED**: no concrete authorised hotel sandbox adapter, endpoint,
API contract, or credential configuration was found. No supplier was contacted.

Base: `d03a1783b988116843969f3ab9b6c424dd65d49f` on `integration/c1-canonical`, clean before changes.
Branch: `feature/hotels-h2-sandbox-boundary`. C1/S1 evidence remains unchanged.

## Repository truth before changes

| Area | Existing files / classification |
|---|---|
| Canonical contract | `src/features/hotels/contracts/hotelV2.js`, `docs/HOTELS_V2_CANONICAL_CONTRACT.md`: IMPLEMENTED H1 contracts; booking/hold capability names CONTRACT-ONLY |
| Mapping | `services/hotelCanonical.js` within the hotels feature: IMPLEMENTED deterministic foundation, PARTIAL server authority; display names not sufficient identity |
| Synthetic adapter | `services/syntheticHotelAdapter.js`: SYNTHETIC-ONLY reads; reprice/hold/booking throw `NOT_IMPLEMENTED_H2` |
| Fixtures | `data/hotelCanonicalFixtures.js`, `data/hotelFixtures.js`: SYNTHETIC-ONLY |
| Detail | `resolveHotelDetail` fixture projection: SYNTHETIC-ONLY; no supplier-backed Detail transport |
| Room selection | `components/RoomSelection.jsx`: IMPLEMENTED fixture presentation; room/rate data coupled in fixtures |
| Guest details | `components/GuestDetails.jsx`: IMPLEMENTED local presentation, no guest persistence |
| Review | `components/HotelReview.jsx`: IMPLEMENTED H1 boundary, `NOT_YET_WIRED` payment |
| Routing | `HotelsPage.jsx`: SYNTHETIC-ONLY fixture routes; no server hotel endpoint mounted |
| Tests | `scripts/hotel-v2-tests.mjs`: 17 preserved tests |
| Sandbox | MISSING: no hotel supplier server module, hotel credentials in `.env.example`, or hotel-related process variable names found; no secret values inspected |
| Persistence | MISSING hotel mapping schema in `supabase/migrations`; existing flight offers/operations are not hotel mapping authority |

## Implemented server composition

`src/server/hotels/hotelReadBoundary.js` provides search, detail, rates and reprice.
`hotelHttpBoundary.js` provides an authenticated POST handler for those four operations.
The host must supply a session verifier. The body cannot supply the owner, mapping,
supplier IDs, price, commission, or provider. Selections belong to the verified user.
Responses have `Cache-Control: no-store`; errors contain only fixed public messages.

This is a composable server boundary, not a deployed endpoint. The existing browser H1
presentation is unchanged. Wiring the browser to real detail/rates awaits the actual
approved sandbox and host authentication composition. No fake live data replaces fixtures.

Only explicitly synthetic, non-network adapters are accepted currently. There is no
concrete approved hotel sandbox provider; `APPROVED_HOTEL_SANDBOX_PROVIDERS` is empty.
Any adapter claiming sandbox, live, production or network capability is rejected. A future
provider integration must implement and test its concrete API transport, HTTPS endpoint
allowlist, redirects, timeout, secret management, public content mapping, and pricing policy
before registration. Setting a mode flag alone cannot enable an endpoint in this batch.

The offline test adapter exists only in the test file. It is not a real supplier response,
runtime validation artifact, or replacement for supplier sandbox evidence.

## Canonical mapping and persistence

`hotelMappingStore.js` loads version-1 JSON snapshots from a **server-configured file path**.
This is durable, read-only, server-owned mapping persistence: a reviewed snapshot can be
reloaded on restart. It is not a database repository or a browser-writable mapping service.
No runtime mapping write API is provided. The snapshot is cloned on load and lookup.
An administrator must provision the file outside browser assets with filesystem access
restricted to the server account. No populated real-provider snapshot is claimed here.

Each record carries provider, supplierPropertyId, canonicalHotelId, optional supplierRoomId
and canonicalRoomId, status (`mapped`, `unmapped`, `ambiguous`, `review`), confidence,
provenance, createdAt and updatedAt. The server maps canonicalHotelId to the canonical
property concept; it preserves existing H1 ID prefixes. No name fallback is used at this
authority boundary. An explicit provider/property key is required; rooms also require the
property and supplier room key. Room parent mismatch fails closed.

Exact mapping duplicates are idempotent. Conflicting canonical IDs or pending review fail
closed. Provider A cannot use provider B's mapping. Naming changes cannot change identity.
Two different supplier properties mapped to one canonical property in one search are rejected
as source ambiguity; the boundary does not arbitrarily choose one for detail/reprice.

Rates are separate from rooms. A deterministic canonical rate digest covers provider,
supplier property/room/rate IDs, currency, occupancy, stay, board, cancellation policy,
refundability and tax inclusion. Exact duplicate rates dedupe; conflicting duplicate prices
or availability/expiry details fail closed. Supplier references are kept in the server selection
cache, never in public responses. Each selection records its mapping snapshot revision.

Selections/rate references are process-local, owner-scoped, capped at 1,000 and expire after
five minutes (supplier rate expiry may be earlier). Restart invalidates selections safely.
Multi-instance continuity, mapping administration and shared rate persistence are not claimed.

**Migration required: NO for this file-snapshot boundary. Migration prepared: NO.
Migration applied: NO.** No schema changes or migration files are introduced. A later shared
database mapping repository must have its own design/RLS/replay review and approval;
the current implementation does not depend on that work to perform offline reads.

## Search / Detail / Room Rates / Reprice

Search validates calendar dates, destination code and occupancy before adapter invocation.
Supplier shape and provider identities are validated; malformed data rejects the complete
operation. Canonical property results are deduplicated and sorted. Selected supplier identities
are resolved only from server state.

Detail resolves the selected property and returns an allowlisted public projection. Unknown
name, description or address becomes null. No placeholder stars, amenities or production-looking
values are synthesized. No unreviewed supplier-specific object is serialized wholesale.

Rates validate stay and occupancy, integer market amount in minor units, currency, explicit
availability and finite expiry. Missing board/cancellation/refund/tax/fee information is
explicit null. Unknown expiry cannot safely authorize reprice and is rejected. There is no FX.

Reprice resolves the private property/room/rate reference from the authenticated selection.
The returned identity, provider, currency, stay, mapping, availability and expiry must still
match. Expiry is checked both before and after the adapter call. Concurrent replacement of
the rate snapshot during reprice fails closed. A changed amount is explicitly reported along
with the previous authoritative amount. Browser amounts and commission fields are rejected.

`marketAmountMinor` is the **server adapter's Hajiz market amount**, not supplier net. Real
supplier net-to-market pricing requires a reviewed server pricing policy in the future concrete
adapter. H2 does not implement sale, agent uplift or commission calculation. It cannot authorize
a below-market sale because it authorizes no sale at all. No Model B or flight pricing code changes.

Hold, booking, payment, cancellation and voucher capabilities are false. The reprice result
includes `bookingAllowed=false`, `holdAllowed=false`, `continueToPayment=NOT_YET_WIRED`.
No guest data is accepted or persisted. No Bankak/PSP flow is called.

## Validation

- Preserved baseline: 722/722 PASS, including the existing 17 H1 tests.
- New independent H2 deterministic tests: 45/45 PASS.
- Full product command: 767/767 PASS. Every baseline command retained in original order;
  H2 command appended. LOST=0, SKIPPED=0.
- Hotel targeted command: `npm run test:hotels` (H1 17 + H2 45 = 62).
- Build PASS. Lint PASS with the same five existing S1 unused-import warnings, no new H2 warnings.
- No sandbox runtime evidence exists; real property/room mapping validation remains BLOCKED.

Tests exercise durable snapshot reload, property/room ambiguity, provider isolation, unstable
names, multiple rate identities, currency/board/occupancy, duplicate conflicts, malformed payloads,
server references, tampering, reprice change/no-change, stale/unavailable responses, cross-owner
access, expiry during provider calls, HTTP auth, error redaction and disabled commerce/network.

## Remaining before booking/hold phase

1. Provide and authorize a named hotel supplier sandbox, documented non-production endpoint,
   API contract and locally supplied credentials. Do not send secrets in chat.
2. Implement that concrete server adapter with reviewed market pricing and real mapping snapshot.
3. Validate property/room/rate mapping, detail, rates and reprice against the sandbox; persist
   original runtime evidence separately from deterministic tests.
4. Compose the server HTTP handler with the host's verified authentication and connect the
   hotel UI to its canonical responses. Review before moving beyond H2.
5. Shared persistence, if required by deployment topology, needs a separate design and approval.

Safe to begin booking/hold phase: **NO**. H2 has no real sandbox validation PASS yet.
Hold/booking/payment/voucher/cancellation/refund remain subsequent separately authorized work.
Product P2 not started. No canonical merge performed.
