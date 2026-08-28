# HAJIZ Pricing + FX Core Batch 4

## Scope and pipeline

Batch 4 introduces the first authoritative, server-owned flight pricing pipeline:

`FlightOfferV1 -> supplier-native FX -> canonical USD economics -> customer-display FX -> CustomerPriceV1 -> public projection`

It prices every grouped supplier alternative independently and preserves deterministic first-seen order. It does not rank, recommend, choose a winner, select a cheapest supplier, enable Travelport, contact an FX provider, or wire a customer endpoint.

## Canonical USD economics

`priced-flight-offer/v1` uses USD as HAJIZ's canonical economic currency. Supplier economics remain supplier-native until a trusted, purpose-specific FX snapshot converts them into canonical USD supplier net. A USD supplier still uses an explicit USD-to-USD identity snapshot; no non-identity conversion may silently fall back to 1:1.

The server-owned `pricing-policy/v1` supplies policy version, positive margin percentage, partner commission rate, agent uplift amount in USD, and validity window. Missing, invalid, inactive, zero-margin, or client-controlled policy input fails closed. No production margin is hardcoded.

Model B is applied exactly:

- `market_selling_amount = supplier_net × (1 + margin_pct / 100)`
- `base_margin = market_selling_amount - supplier_net`
- `agent_uplift = final_selling_amount - market_selling_amount`
- `base_partner_commission = base_margin × partner_commission_rate`
- `partner_commission = base_partner_commission + agent_uplift`
- `hajiz_net_margin = base_margin - base_partner_commission`
- `gross_margin = final_selling_amount - supplier_net`

All arithmetic uses exact BigInt fractions parsed from bounded decimal strings. JavaScript floating-point arithmetic is not used for money.

## FX snapshot and safety

`fx-snapshot/v1` records snapshot ID, base/quote currencies, reference and effective rates, source, explicit buffer, volatility observation/guard, rounding policy, fetched/effective/expiry times, and policy version. The effective rate is derived as `referenceRate × (1 + bufferPct / 100)` and a supplied effective rate must agree. Buffering therefore occurs exactly once and there is no hidden legacy percentage.

Supplier-native FX and customer-display FX are separate snapshots with explicit directions; one cannot be reused in the wrong direction. Supported V1 currencies are USD, AED, and SDG. USD identity requires rate 1 and zero buffer. AED uses the same injected trusted snapshot contract. SDG supports an automated reference or Finance override through the declared source, an explicit safety buffer, expiry/stale guard, and a fail-closed volatility threshold. Batch 4 makes no live provider call.

Snapshots fail closed for unsupported/malformed currencies, non-positive rates, missing metadata, direction mismatch, inactivity/expiry, invalid identity semantics, or volatility beyond the declared guard.

## Rounding and CustomerPriceV1

FX conversion and any explicit buffer are applied to the exact canonical amount before rounding. The final customer amount is rounded once, half-up: USD and AED use two decimal places; SDG uses a documented whole-unit policy. There is no intermediate customer-money rounding and no double rounding.

`customer-price/v1` contains the internal offer identity, authoritative amount/currency, canonical USD amount, FX snapshot ID, pricing and FX policy versions, calculation time, and `validUntil`. Its validity is the earliest applicable supplier-offer, pricing-policy, supplier-FX, and display-FX expiry. An already expired dependency fails closed.

The grouped public projection accepts only an own `CustomerPriceV1` property matching the offer identity, then delegates to `toPublicFlightOffer`. Supplier amount is never a fallback. Public serialization excludes supplier economics, provider identity/references, HAJIZ margins, commissions, pricing policy internals, and FX source internals.

## B3 follow-ups resolved

- **B3-02 CLOSED:** conflicting repeated `provider + providerOfferRef` content is isolated and dropped as an unusable identity. Unaffected provider alternatives survive, internal provider/search outcome degrades, public status becomes `PARTIAL` where another source completed or a valid alternative remains, and raw conflict details never enter public output. Conflicting content is never silently selected.
- **B3-03 CLOSED:** public price resolution uses `Object.hasOwn`; inherited, missing, and prototype-related properties cannot satisfy the lookup, while a valid own `CustomerPriceV1` succeeds.

## Intentionally unsolved

- Ranking, scoring, recommendation, cheapest/best selection, or a primary/winning alternative
- Production pricing policy source or live FX provider integration
- Customer endpoint and frontend reconciliation (MS-09 remains partial)
- Persistence of pricing/FX snapshots
- Travelport enablement and supplier network execution
- Hotel pricing

MS-08 is partial: authoritative pricing, FX, and final customer price contracts exist and are behaviorally tested, but ranking is deliberately absent.
