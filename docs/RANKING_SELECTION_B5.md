# HAJIZ Flight Ranking + Selection Policy Batch 5

## Scope and pipeline position

Batch 5 ranks flight supplier alternatives only after canonical grouping, HAJIZ pricing, customer FX, and authoritative `CustomerPriceV1` creation:

`grouped alternatives -> independently priced alternatives -> CustomerPriceV1 -> private ranking -> preferred alternative`

It does not wire an HTTP/RPC endpoint, frontend results, recommendation badge, ranking persistence, Travelport, supplier calls, or database work.

## Active ranking policy

`flight-ranking-policy/v1` is a strict server-owned policy with a version, fixed `price_only` mode, and validity window. Unknown fields, alternate modes, client-selected suppliers, weights, thresholds, or tie-break changes are rejected. If policy is missing, malformed, unsupported, or inactive, valid alternatives are preserved in an explicit `UNRANKED` result and no preferred alternative is declared.

The only active Batch 5 ranking dimension is authoritative final customer price. Reliability, ticketing success, operational latency, and support/SLA are documented future versioned dimensions only. No quality-signal runtime, fake production metric, or quality weighting exists.

## Exact money comparison

Ranking compares `CustomerPriceV1.amount` in the requested customer currency. This is the authoritative rounded display/payment amount produced by Batch 4; the current contract has no separate exact pre-round display fraction. The decimal string is parsed by the existing BigInt fraction machinery, so comparison uses no `Number`, `parseFloat`, floating-point subtraction, or additional rounding. All rankable alternatives in one fare group must use the same customer currency or ranking fails closed.

Supplier net, native currency, canonical USD intermediate amounts, margins, commissions, provider-reported prices, and provider identity never influence ranking.

## Cheapest and preferred

`cheapestInternalOfferId` and `preferredInternalOfferId` are separate private fields. In the current truthful price-only implementation they are equal. This is an implementation state, not a permanent product rule. A future reviewed policy version with trusted quality signals may choose a preferred alternative that is not cheapest.

The preferred ID must reference a retained alternative. All alternatives remain in deterministic first-seen order and receive private rankability/rank/preferred metadata; ranking never changes itinerary or fare fingerprints and never collapses supplier alternatives.

## Determinism and degraded inputs

Rank ordering is exact customer price, then original first-seen alternative order, then internal offer ID only as a final deterministic fallback. No randomness, current-time tie-break, provider-name lexical ordering, completion speed, or object enumeration determines selection. Identical inputs with the same trusted ranking time produce identical output.

`COMPLETE` and `PARTIAL` searches with valid priced alternatives can rank. `UNAVAILABLE` produces no preferred alternative. An invalid, missing, future-dated, or expired customer price leaves its alternative retained but marks it unrankable; it cannot become preferred and does not destroy unaffected valid alternatives. Timed-out/failed supplier outcomes are not alternatives and are never assigned low ranks.

## F-03 pricing-policy hardening

`pricing-policy/v1` now requires trusted `maxMarginPct` and `maxAgentUpliftAmountUsd` capabilities. The maxima are supplied by versioned business configuration, not hardcoded guesses. Margin below or equal to its positive maximum and uplift below or equal to its non-negative maximum are accepted. Missing, malformed, negative, or exceeded maxima fail closed before pricing output. Model B formulas are unchanged.

## Public and operational safety

The ranked result is private. Batch 5 adds no public projection fields and exposes no provider identity, supplier references/economics, ranking internals, policy values, or future quality dimensions. Existing public projection behavior remains unchanged.

Supplier pricing currency coverage remains USD, AED, and SDG. Other currencies fail closed and remain a pre-real-supplier-enablement item. No customer endpoint, persistence, supplier network, FX provider, Staging, or Production contact is part of this batch.
