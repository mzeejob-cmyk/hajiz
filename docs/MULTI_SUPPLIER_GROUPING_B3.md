# HAJIZ Multi-Supplier Grouping Batch 3

## Scope

Batch 3 adds an application-layer-only private grouping contract and a mandatory public projection boundary. It performs marketed-itinerary grouping, not ranking, provider selection, pricing, FX, or cross-codeshare physical-flight reconciliation. Every supplier alternative remains available for later authoritative evaluation.

## Marketed-itinerary fingerprint

`ItineraryFingerprintV1` is emitted as `ifp_v1_<sha256>`. Its canonical payload is an explicit ordered array containing, for every segment: marketing carrier, marketing flight number, origin, destination, departure instant, and arrival instant. Date-times are normalized with UTC ISO-8601 before hashing. Provider identity, references, internal offer IDs, price/currency, expiry, capabilities, metadata, telemetry, aircraft, and execution order are excluded.

Different marketing carriers or marketing flight numbers remain separate even when route and times match. Batch 3 performs marketed-itinerary grouping, not cross-codeshare physical-flight reconciliation. Reliable operating-flight identity would require an explicit future fingerprint-version decision.

## Fare fingerprint and conservative equivalence

`FareFingerprintV1` is emitted as `ffp_v1_<sha256>`. The comparison-critical fields available in `FlightOfferV1` are:

- canonical offer cabin;
- ordered per-segment cabins;
- exact normalized `fareBrand` equality;
- baggage entitlement;
- refundability;
- changeability.

Provider identity/references, supplier-native economics, internal IDs, expiry, private metadata, capabilities, and telemetry are excluded. There is no fuzzy fare-brand matching.

Equivalence is incomplete when `fareBrand` is absent or refundability/changeability is `unknown`. Such offers receive deterministic isolated fare-group occurrences and are not merged across alternatives. This deliberately prefers missed deduplication over false equivalence.

## Fare completeness gate

The comparison-critical fields are fare cabin, every segment cabin, `fareBrand`, baggage, refundability, and changeability. `FareFingerprintV1` can contain textual values, but grouping treats a fare as safely comparable only when all critical semantics are meaningfully known.

Placeholder detection is exact after trimming and case normalization; it is neither fuzzy nor substring-based. Baggage values `Subject to fare terms` and `unknown`, and cabin values `Unspecified` and `unknown`, are incomplete. An `unknown` fare brand is also incomplete. Any such value forces conservative non-merge, including a placeholder on any segment cabin.

This is a transitional compatibility rule because `FlightOfferV1` currently requires textual cabin and baggage fields. A cleaner nullable or structured representation of unknown semantics requires a versioned contract change and is outside this fix pack.

## Grouping and duplicates

`grouped-flight-search/v1` retains trace/status/timing and private supplier outcomes. It groups in deterministic first-seen order: itinerary groups, then fare groups, then alternatives. It never sorts by supplier price, provider, speed, carrier, duration, or fare brand.

Every distinct supplier alternative is retained. Repeated `provider + providerOfferRef` with identical canonical private content keeps the first occurrence. The same identity with conflicting canonical content fails closed.

## Public projection

`public-grouped-flight-search/v1` is produced only through `toPublicGroupedFlightSearchV1`. Every alternative passes through the canonical `toPublicFlightOffer` mapper. The caller must supply an authoritative customer price for every internal offer; missing pricing fails closed. Supplier-native amounts are never substituted, so raw grouped search cannot be wired directly to customers before the future pricing/FX stage.

The public result exposes only status, opaque HAJIZ group/fare keys, and public search offers. It excludes supplier outcomes, provider identity and references, supplier economics, private metadata, capabilities, and supplier errors. `COMPLETE`, `PARTIAL`, and `UNAVAILABLE` are preserved; for example, a partial search with no offers remains `PARTIAL` with an empty group list and no provider failure detail.

## Intentionally unsolved

- HAJIZ pricing, FX, final-price ranking, preferred/winning supplier selection
- frontend/customer endpoint reconciliation
- booking/reprice provider execution
- Travelport enablement, persistent Travelport references, and C-02
- circuit breakers, health scoring, global search deadline, and production SLA policy
- semantic fare-family mapping and physical-flight codeshare reconciliation
- hotel supplier contracts

Before endpoint wiring, B3-02 must reduce the blast radius of a conflicting duplicate: isolate or drop the conflicting identity/provider attempt, preserve unaffected alternatives, degrade the internal provider/search outcome, and never silently choose conflicting content. The current Batch 3 behavior intentionally remains fail-closed.

B3-03 belongs to the Pricing/FX batch: authoritative price resolution must replace raw indexed lookup with an own-property-safe check such as `Object.hasOwn`. This fix pack does not change the price resolver.

B2-04 is closed by fail-closed empty aggregation at both helper and orchestrator boundaries. B2-07 is closed only for the tested application public-projection boundary; no customer endpoint or frontend integration is claimed.
