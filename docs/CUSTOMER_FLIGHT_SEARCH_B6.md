# HAJIZ Customer Flight Search Batch 6

## Scope and pipeline placement

Batch 6 adds the application-level customer contract after multi-supplier
search, normalization, grouping, HAJIZ pricing, FX, and private ranking, and
before any HTTP endpoint or frontend integration:

`ranked-grouped-flight-search/v1 -> toCustomerFlightSearchV1 -> customer-flight-search/v1`

The mapper is the sole new private-to-customer boundary. It strictly validates
the expected ranked shape and fails closed on unexpected private fields. This
batch creates no HTTP, RPC, Edge Function, fetch hook, React wiring, migration,
database access, or network integration.

## Customer contract

`customer-flight-search/v1` contains:

- `searchStatus`: COMPLETE, PARTIAL, or UNAVAILABLE
- the requested customer `currency`
- stable HAJIZ-owned customer groups
- customer itinerary and segment display data
- fare brand, cabin, baggage, changeability, and refundability
- authoritative customer price amount, currency, and validity
- group status: RANKED, UNRANKED, or UNAVAILABLE
- an opaque preferred alternative ID and boolean recommendation when available

COMPLETE and PARTIAL remain distinct when usable results exist. If projection
has no usable customer-priced alternative, the effective customer status is
UNAVAILABLE. Supplier failure identities and technical exception reasons are
never projected.

## Price and expiry behavior

Only a valid, active `CustomerPriceV1` in the explicitly requested customer
currency may cross the boundary. Missing, malformed, future-dated, expired, or
wrong-currency prices cause only that public alternative to be excluded. They
cannot remain recommended, and supplier-native or canonical-USD values are
never used as fallback. Other alternatives and groups survive.

## Ranking isolation and B5-01

Ranking is now isolated per fare group. When active, valid alternatives in one
fare group contain more than one customer currency, that private group is
retained as UNRANKED, both preferred and cheapest IDs are `null`, and every
alternative is retained privately as unrankable. Unaffected fare groups keep
ranking and the whole search returns successfully. Cross-currency comparison
never occurs. **B5-01 is CLOSED.**

The public mapper retains customer-valid alternatives from an isolated group
that match the requested currency, while recommendation remains unavailable.
Other-currency alternatives remain private and are not misrepresented under
the contract's requested currency.

## Customer-safe identity and duplicate options

Although `internalOfferId` is HAJIZ-owned, its existing format permits opaque
payload text and is an internal persistence/selection identity. Batch 6 does
not expose it. Customer group and alternative IDs are deterministic SHA-256
derivations with `hcg_v1_` and `hca_v1_` prefixes. They are one-way, contain no
provider name or provider offer reference, and remain stable for identical
projected input.

Alternatives that differ only in hidden supplier identity but have identical
customer fare and price/validity fields are collapsed into one public option.
Distinct customer prices remain distinct and in first-seen order. Private
supplier alternatives are never deleted or winner-selected.

## Forbidden public data

The contract excludes provider identity, supplier name/reference, supplier
native economics, canonical USD internals, margin, uplift, commission, FX
internals, ranking score/rank/weights/policy, quality metrics, supplier
operation IDs, adapter metadata, supplier outcomes, and diagnostics. Adversarial
key and value tests enforce this boundary, including probes of the actual IDs.

## Deferred and gap status

- B5-01: **CLOSED** — mixed-currency fare-group isolation is implemented and tested.
- B5-02: **CLOSED** — the final ID fallback uses deterministic codepoint lexical comparison rather than `localeCompare`.
- B5-03: **DEFERRED / LOW OBSERVABILITY** — no public diagnostic field was added.
- MS-09: **PARTIAL — CUSTOMER CONTRACT COMPLETE, HTTP/FRONTEND NOT WIRED**.

Travelport remains disabled. Supplier operations, Backend Core,
payment/Bankak, and historical migrations are unchanged. Staging, Production,
supplier networks, and FX providers were not contacted.
