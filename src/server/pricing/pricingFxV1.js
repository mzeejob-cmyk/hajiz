import { assertFlightOfferV1 } from "../suppliers/flightOfferV1.js"
import {
  addDecimal, compareDecimal, divideDecimal, formatDecimal, fractionRecord, fromFractionRecord,
  multiplyDecimal, parseDecimal, subtractDecimal,
} from "./decimal.js"

export const PRICING_POLICY_CONTRACT_VERSION = "pricing-policy/v1"
export const PRICED_FLIGHT_OFFER_VERSION = "priced-flight-offer/v1"
export const FX_SNAPSHOT_CONTRACT_VERSION = "fx-snapshot/v1"
export const CUSTOMER_PRICE_CONTRACT_VERSION = "customer-price/v1"
export const SUPPORTED_PRICING_CURRENCIES = Object.freeze(["USD", "AED", "SDG"])
export const CURRENCY_ROUNDING_PLACES = Object.freeze({ USD: 2, AED: 2, SDG: 0 })

const ZERO = parseDecimal("0")
const ONE = parseDecimal("1")
const HUNDRED = parseDecimal("100")
const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value)) deepFreeze(nested)
  }
  return value
}
const date = (value, field) => {
  if (typeof value !== "string" || !value.includes("T") || !Number.isFinite(Date.parse(value))) throw new TypeError(`${field} must be an ISO date-time`)
  return new Date(value).toISOString()
}
const text = (value, field, pattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/) => {
  if (typeof value !== "string" || !pattern.test(value)) throw new TypeError(`${field} is invalid`)
  return value
}
const currency = (value, field) => {
  if (!SUPPORTED_PRICING_CURRENCIES.includes(value)) throw new TypeError(`${field} is unsupported`)
  return value
}
const positive = (value, field) => {
  const parsed = parseDecimal(value, field)
  if (compareDecimal(parsed, ZERO) <= 0) throw new TypeError(`${field} must be positive`)
  return parsed
}
const nonNegative = (value, field) => {
  const parsed = parseDecimal(value, field)
  if (compareDecimal(parsed, ZERO) < 0) throw new TypeError(`${field} cannot be negative`)
  return parsed
}
const activeAt = (from, until, now, field) => {
  const instant = Date.parse(date(now, "trusted now"))
  if (instant < Date.parse(from) || instant >= Date.parse(until)) throw new TypeError(`${field} is not active`)
}

export function createPricingPolicyV1(input) {
  if (!input || typeof input !== "object") throw new TypeError("trusted pricing policy is required")
  if (input.contractVersion !== PRICING_POLICY_CONTRACT_VERSION) throw new TypeError("unsupported pricing policy version")
  const margin = positive(input.marginPct, "marginPct")
  const commission = nonNegative(input.partnerCommissionRatePct, "partnerCommissionRatePct")
  if (compareDecimal(commission, HUNDRED) > 0) throw new TypeError("partnerCommissionRatePct cannot exceed 100")
  const uplift = nonNegative(input.agentUpliftAmountUsd, "agentUpliftAmountUsd")
  const validFrom = date(input.validFrom, "pricing policy validFrom")
  const validUntil = date(input.validUntil, "pricing policy validUntil")
  if (Date.parse(validUntil) <= Date.parse(validFrom)) throw new TypeError("pricing policy validity is invalid")
  return deepFreeze({
    contractVersion: PRICING_POLICY_CONTRACT_VERSION,
    pricingPolicyVersion: text(input.pricingPolicyVersion, "pricingPolicyVersion"),
    marginPct: formatDecimal(margin, 8, { trim: true }),
    partnerCommissionRatePct: formatDecimal(commission, 8, { trim: true }),
    agentUpliftAmountUsd: formatDecimal(uplift, 8, { trim: true }),
    validFrom, validUntil,
  })
}

export function createFxSnapshotV1(input) {
  if (!input || typeof input !== "object") throw new TypeError("trusted FX snapshot is required")
  if (input.contractVersion !== FX_SNAPSHOT_CONTRACT_VERSION) throw new TypeError("unsupported FX snapshot version")
  const baseCurrency = currency(input.baseCurrency, "baseCurrency")
  const quoteCurrency = currency(input.quoteCurrency, "quoteCurrency")
  const referenceRate = positive(input.referenceRate, "referenceRate")
  const bufferPct = nonNegative(input.bufferPct, "bufferPct")
  const volatilityGuardPct = nonNegative(input.volatilityGuardPct, "volatilityGuardPct")
  const observedVolatilityPct = nonNegative(input.observedVolatilityPct, "observedVolatilityPct")
  if (compareDecimal(observedVolatilityPct, volatilityGuardPct) > 0) throw new TypeError("FX volatility guard exceeded")
  if (baseCurrency === quoteCurrency && (compareDecimal(referenceRate, ONE) !== 0 || compareDecimal(bufferPct, ZERO) !== 0)) throw new TypeError("identity FX must use rate 1 and zero buffer")
  const effectiveRate = multiplyDecimal(referenceRate, addDecimal(ONE, divideDecimal(bufferPct, HUNDRED)))
  if (input.effectiveRateExact !== undefined && compareDecimal(fromFractionRecord(input.effectiveRateExact, "effectiveRateExact"), effectiveRate) !== 0) throw new TypeError("effectiveRateExact does not match reference rate and buffer")
  if (input.effectiveRateExact === undefined && input.effectiveRate !== undefined && formatDecimal(effectiveRate, 8, { trim: true }) !== input.effectiveRate) throw new TypeError("effectiveRate does not match reference rate and buffer")
  const fetchedAt = date(input.fetchedAt, "fetchedAt")
  const effectiveAt = date(input.effectiveAt, "effectiveAt")
  const expiresAt = date(input.expiresAt, "expiresAt")
  if (Date.parse(effectiveAt) < Date.parse(fetchedAt) || Date.parse(expiresAt) <= Date.parse(effectiveAt)) throw new TypeError("FX snapshot timing is invalid")
  return deepFreeze({
    contractVersion: FX_SNAPSHOT_CONTRACT_VERSION,
    snapshotId: text(input.snapshotId, "snapshotId", /^hfx_[A-Za-z0-9_-]{8,100}$/),
    baseCurrency, quoteCurrency,
    referenceRate: formatDecimal(referenceRate, 8, { trim: true }),
    effectiveRate: formatDecimal(effectiveRate, 8, { trim: true }),
    effectiveRateExact: fractionRecord(effectiveRate),
    source: text(input.source, "source"),
    bufferPct: formatDecimal(bufferPct, 8, { trim: true }),
    volatilityGuardPct: formatDecimal(volatilityGuardPct, 8, { trim: true }),
    observedVolatilityPct: formatDecimal(observedVolatilityPct, 8, { trim: true }),
    roundingPolicy: `${quoteCurrency}-${CURRENCY_ROUNDING_PLACES[quoteCurrency]}dp-half-up-once`,
    fetchedAt, effectiveAt, expiresAt,
    policyVersion: text(input.policyVersion, "FX policyVersion"),
  })
}

export function assertActiveFxSnapshotV1(input, { baseCurrency, quoteCurrency, now }) {
  const snapshot = createFxSnapshotV1(input)
  if (snapshot.baseCurrency !== baseCurrency || snapshot.quoteCurrency !== quoteCurrency) throw new TypeError("FX snapshot direction does not match conversion purpose")
  activeAt(snapshot.effectiveAt, snapshot.expiresAt, now, "FX snapshot")
  return snapshot
}

export function priceFlightOfferV1(privateOffer, { pricingPolicy, supplierFxSnapshot, now }) {
  const offer = assertFlightOfferV1(privateOffer)
  const policy = createPricingPolicyV1(pricingPolicy)
  const calculatedAt = date(now, "pricing calculatedAt")
  activeAt(policy.validFrom, policy.validUntil, calculatedAt, "pricing policy")
  const supplierFx = assertActiveFxSnapshotV1(supplierFxSnapshot, { baseCurrency: offer.economics.supplierCurrency, quoteCurrency: "USD", now: calculatedAt })
  if (offer.validity.expiresAt && Date.parse(offer.validity.expiresAt) <= Date.parse(calculatedAt)) throw new TypeError("supplier offer is expired")

  const supplierNative = positive(offer.economics.supplierAmount, "supplierAmount")
  const supplierNet = multiplyDecimal(supplierNative, fromFractionRecord(supplierFx.effectiveRateExact, "supplier FX effective rate"))
  const marginRate = divideDecimal(parseDecimal(policy.marginPct), HUNDRED)
  const commissionRate = divideDecimal(parseDecimal(policy.partnerCommissionRatePct), HUNDRED)
  const marketSelling = multiplyDecimal(supplierNet, addDecimal(ONE, marginRate))
  const baseMargin = subtractDecimal(marketSelling, supplierNet)
  const uplift = parseDecimal(policy.agentUpliftAmountUsd)
  const finalSelling = addDecimal(marketSelling, uplift)
  const basePartnerCommission = multiplyDecimal(baseMargin, commissionRate)
  const partnerCommission = addDecimal(basePartnerCommission, uplift)
  const hajizNetMargin = subtractDecimal(baseMargin, basePartnerCommission)
  const grossMargin = subtractDecimal(finalSelling, supplierNet)
  const amount = (value) => formatDecimal(value, 8, { trim: true })

  return deepFreeze({
    contractVersion: PRICED_FLIGHT_OFFER_VERSION,
    internalOfferId: offer.internalOfferId,
    canonicalCurrency: "USD",
    supplierNativeAmount: offer.economics.supplierAmount,
    supplierNativeCurrency: offer.economics.supplierCurrency,
    supplierFxSnapshotId: supplierFx.snapshotId,
    supplierNetAmount: amount(supplierNet),
    marketSellingAmount: amount(marketSelling),
    finalSellingAmount: amount(finalSelling),
    finalSellingAmountExact: fractionRecord(finalSelling),
    baseMargin: amount(baseMargin),
    agentUplift: amount(uplift),
    basePartnerCommission: amount(basePartnerCommission),
    partnerCommission: amount(partnerCommission),
    hajizNetMargin: amount(hajizNetMargin),
    grossMargin: amount(grossMargin),
    pricingPolicyVersion: policy.pricingPolicyVersion,
    calculatedAt,
    validUntil: [offer.validity.expiresAt, policy.validUntil, supplierFx.expiresAt].filter(Boolean).sort((a, b) => Date.parse(a) - Date.parse(b))[0],
  })
}

export function assertPricedFlightOfferV1(value) {
  if (!value || typeof value !== "object" || value.contractVersion !== PRICED_FLIGHT_OFFER_VERSION) throw new TypeError("valid PricedFlightOfferV1 is required")
  if (typeof value.internalOfferId !== "string" || value.canonicalCurrency !== "USD") throw new TypeError("priced offer identity is invalid")
  positive(value.finalSellingAmount, "finalSellingAmount")
  const exactFinalSelling = fromFractionRecord(value.finalSellingAmountExact, "finalSellingAmountExact")
  const canonicalFinalSelling = formatDecimal(exactFinalSelling, 8, { trim: true })
  if (value.finalSellingAmount !== canonicalFinalSelling) throw new TypeError("finalSellingAmount does not match its exact canonical value")
  date(value.calculatedAt, "priced calculatedAt")
  date(value.validUntil, "priced validUntil")
  return value
}

export function createCustomerPriceV1(pricedInput, { displayFxSnapshot, customerCurrency, now }) {
  const priced = assertPricedFlightOfferV1(pricedInput)
  const calculatedAt = date(now, "customer price calculatedAt")
  if (Date.parse(priced.validUntil) <= Date.parse(calculatedAt)) throw new TypeError("priced offer is expired")
  if (!displayFxSnapshot || typeof displayFxSnapshot !== "object") throw new TypeError("display FX snapshot is required")
  const requestedCurrency = currency(customerCurrency, "customerCurrency")
  if (displayFxSnapshot.baseCurrency !== "USD" || displayFxSnapshot.quoteCurrency !== requestedCurrency) throw new TypeError("display FX snapshot does not match requested customer currency")
  const displayFx = assertActiveFxSnapshotV1(displayFxSnapshot, { baseCurrency: "USD", quoteCurrency: requestedCurrency, now: calculatedAt })
  const exactDisplay = multiplyDecimal(fromFractionRecord(priced.finalSellingAmountExact), fromFractionRecord(displayFx.effectiveRateExact))
  const validUntil = [priced.validUntil, displayFx.expiresAt].sort((a, b) => Date.parse(a) - Date.parse(b))[0]
  return deepFreeze({
    contractVersion: CUSTOMER_PRICE_CONTRACT_VERSION,
    internalOfferId: priced.internalOfferId,
    amount: formatDecimal(exactDisplay, CURRENCY_ROUNDING_PLACES[displayFx.quoteCurrency]),
    currency: displayFx.quoteCurrency,
    canonicalUsdAmount: formatDecimal(fromFractionRecord(priced.finalSellingAmountExact), 8, { trim: true }),
    fxSnapshotId: displayFx.snapshotId,
    pricingPolicyVersion: priced.pricingPolicyVersion,
    fxPolicyVersion: displayFx.policyVersion,
    calculatedAt,
    validUntil,
  })
}

export function assertCustomerPriceV1(value, expectedInternalOfferId) {
  if (!value || typeof value !== "object" || value.contractVersion !== CUSTOMER_PRICE_CONTRACT_VERSION) throw new TypeError("authoritative CustomerPriceV1 is required")
  if (value.internalOfferId !== expectedInternalOfferId) throw new TypeError("customer price offer identity mismatch")
  positive(value.amount, "customer price amount")
  currency(value.currency, "customer price currency")
  positive(value.canonicalUsdAmount, "canonicalUsdAmount")
  text(value.fxSnapshotId, "customer price fxSnapshotId", /^hfx_[A-Za-z0-9_-]{8,100}$/)
  text(value.pricingPolicyVersion, "customer price pricingPolicyVersion")
  text(value.fxPolicyVersion, "customer price fxPolicyVersion")
  const calculatedAt = date(value.calculatedAt, "customer price calculatedAt")
  const validUntil = date(value.validUntil, "customer price validUntil")
  if (Date.parse(validUntil) <= Date.parse(calculatedAt)) throw new TypeError("customer price validity is invalid")
  return value
}
