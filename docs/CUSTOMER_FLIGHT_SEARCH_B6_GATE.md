# HAJIZ Customer Flight Search B6 Gate

## Status

**PASS**

- Independent review: **PASS**
- Required fixes: **NONE**
- Source reviewed HEAD: `5aab92db4eded251e5cdb5dc8c5d789cee3109f7`
- Previous canonical integration HEAD: `e018d312ccb72f0c5dcd1719c960da649c676b7b`
- Tests: **289/289**
- Build: **PASS**
- Lint: **PASS**
- Diff check: **PASS**
- Staging: **NOT REQUIRED — application-layer-only batch**
- Database migrations: **NONE**
- Backend Core: **UNCHANGED**
- Payment/Bankak: **UNCHANGED**
- Supplier operations: **UNCHANGED**
- Travelport: **DISABLED**
- Supplier network: **NOT CONTACTED**
- FX provider: **NOT CONTACTED**

## Ranking isolation

**B5-01 is CLOSED.** A mixed-currency fare group no longer crashes the
whole ranking call. The affected group and all its private alternatives remain
retained, `preferredInternalOfferId` and `cheapestInternalOfferId` are `null`,
and no cross-currency rank is assigned. Unaffected groups continue ranking and
the search completes successfully.

**B5-02 is CLOSED.** The final internal-ID fallback uses deterministic
codepoint lexical comparison. `localeCompare`, locale, and `Intl` do not
participate.

## Customer application contract

The single explicit private-to-customer mapper is
`toCustomerFlightSearchV1`, producing `customer-flight-search/v1` with
`contractVersion`, `searchStatus`, requested `currency`, and customer groups.
Each group contains an opaque group ID, safe status, recommendation
availability, opaque preferred alternative ID, itinerary, and customer
alternatives. Each alternative contains an opaque ID, customer fare,
authoritative price, and a recommended boolean.

Only an active, identity-matched `CustomerPriceV1` in the requested currency is
accepted. Expired, malformed, wrong-currency, or forged-identity prices are
excluded without failing unrelated groups and without falling back to supplier
raw price, supplier net, canonical USD, market selling, native supplier amount,
or adapter pricing.

Customer search statuses are COMPLETE, PARTIAL, and UNAVAILABLE. Customer fare
group statuses are RANKED, UNRANKED, and UNAVAILABLE. A RANKED group has usable
alternatives and a surviving recommendation; an UNRANKED group may retain
usable offers but has no recommendation; an UNAVAILABLE group has no usable
customer offer. PARTIAL exposes only that results are incomplete, never which
supplier failed.

## Public safety and identity

Independent review verified no public provider, `providerOfferRef`, supplier
identity or operation ID, supplier-native economics, margin, uplift,
commission, HAJIZ net margin, canonical USD/FX internals, ranking score,
weights, policy internals, quality metrics, diagnostics, trace ID, private
fingerprint, `internalOfferId`, or `preferredInternalOfferId`.

Recommendation is represented only by a customer-safe `recommended` boolean
and an opaque preferred alternative ID. The contract makes no “best supplier”,
reliability, or quality-ranking claim.

Customer IDs use deterministic one-way SHA-256 digests:

- group: `hcg_v1_<digest>`
- alternative: `hca_v1_<digest>`

No provider string, provider reference, internal offer ID, or reversible
encoding is exposed. These IDs are not ready to become public selection handles
until B6-02 canonical serialization is completed in the endpoint batch.

## Public duplicate behavior

Customer-identical private alternatives with the same public fare and price may
collapse to one public option. A customer-visible fare or price difference
retains distinct options. All private supplier alternatives remain intact; no
destructive supplier winner selection occurs.

## Gap and regression status

- MS-08: **CLOSED FOR FLIGHT PRICING + FX + RANKING/SELECTION SCOPE**
- MS-09: **PARTIAL — CUSTOMER APPLICATION CONTRACT COMPLETE; HTTP ENDPOINT + FRONTEND NOT WIRED**
- B5-01: **CLOSED**
- B5-02: **CLOSED**
- B5-03: **DEFERRED / LOW OBSERVABILITY**

Pricing, Model B, F-03, FX, grouping, exact-money ranking, Backend Core,
payment/Bankak, supplier operations, historical migrations, and Travelport are
unchanged. Travelport remains disabled. No HTTP endpoint or frontend wiring was
added.
