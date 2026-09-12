import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseFlightSelectionResolverV1 } from "../src/server/search/flightSelectionResolverV1.js"
import { createSupabaseFlightPricedSelectionStoreV1 } from "../src/server/search/flightPricedSelectionStoreV1.js"

const STAGING_PROJECT_REF = "pdnuswmljownjzjzpoop"
const STAGING_URL = `https://${STAGING_PROJECT_REF}.supabase.co`

function required(name, fallbackName = null) {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined)
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name}_REQUIRED`)
  return value
}

const supabaseUrl = required("HAJIZ_STAGING_SUPABASE_URL", "SUPABASE_URL")
const serviceRoleKey = required("HAJIZ_STAGING_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY")
const confirmation = required("HAJIZ_CONFIRM_STAGING_EVIDENCE")

if (supabaseUrl !== STAGING_URL) throw new Error("STAGING_URL_MISMATCH")
if (confirmation !== STAGING_PROJECT_REF) throw new Error("STAGING_CONFIRMATION_MISMATCH")

const options = Object.freeze({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const clientA = createClient(supabaseUrl, serviceRoleKey, options)
const clientB = createClient(supabaseUrl, serviceRoleKey, options)
assert.notEqual(clientA, clientB, "client A and B must be distinct instances")

const seed = `${Date.now()}:${process.pid}:${randomBytes(32).toString("hex")}`
const digest = (label) => createHash("sha256").update(`${label}:${seed}`).digest("hex")
const alternativeId = `hca_v2_${digest("search").slice(0, 32)}`
const pricedSelectionId = `hpr_v1_${digest("priced").slice(0, 40)}`
const marker = digest("marker").slice(0, 20)

const now = Date.now()
const validUntil = new Date(now + 15 * 60 * 1000).toISOString()
const offerExpiresAt = new Date(now + 10 * 60 * 1000).toISOString()
const pricedExpiresAt = validUntil

const itinerary = Object.freeze({ origin: "DXB", destination: "KRT", tripType: "one_way", evidenceMarker: marker })
const fare = Object.freeze({ cabin: "economy", fareBasis: "EVIDENCE", evidenceMarker: marker })
const passengerComposition = Object.freeze({ ADT: 1, CHD: 0, INF: 0 })
const customerPrice = Object.freeze({ amount: "123.45", currency: "AED", validUntil })
const representative = Object.freeze({
  internalOfferId: `durability-evidence-${marker}`,
  provider: "mock",
  providerOfferRef: `durability-evidence-${marker}`,
})

const searchEntry = Object.freeze({
  alternativeId,
  offer: Object.freeze({ ...representative, validity: Object.freeze({ expiresAt: offerExpiresAt }) }),
  itinerary,
  fare,
  previousCustomerPrice: customerPrice,
  passengerComposition,
})

const pricedRecord = Object.freeze({
  pricedSelectionId,
  alternativeId,
  ...representative,
  customerPrice,
  itinerary,
  fare,
  passengerComposition,
  expiresAt: pricedExpiresAt,
})

const resolverA = createSupabaseFlightSelectionResolverV1({ client: clientA })
const resolverB = createSupabaseFlightSelectionResolverV1({ client: clientB })
const pricedStoreA = createSupabaseFlightPricedSelectionStoreV1({ client: clientA })
const pricedStoreB = createSupabaseFlightPricedSelectionStoreV1({ client: clientB })

assert.equal(resolverA.durability, "supabase-private-persistence")
assert.equal(resolverB.durability, "supabase-private-persistence")

await resolverA.remember(searchEntry)
const resolvedSearch = await resolverB.resolve(alternativeId)
assert.equal(resolvedSearch.alternativeId, alternativeId)
assert.equal(resolvedSearch.offer.internalOfferId, representative.internalOfferId)
assert.equal(resolvedSearch.offer.provider, representative.provider)
assert.equal(resolvedSearch.offer.providerOfferRef, representative.providerOfferRef)
assert.deepEqual(resolvedSearch.itinerary, itinerary)
assert.deepEqual(resolvedSearch.fare, fare)
assert.deepEqual(resolvedSearch.previousCustomerPrice, customerPrice)
assert.deepEqual(resolvedSearch.passengerComposition, passengerComposition)
assert.equal(resolvedSearch.expiresAt, offerExpiresAt)

const firstPricedWrite = await pricedStoreA.createOrGet(pricedRecord)
assert.equal(firstPricedWrite.pricedSelectionId, pricedSelectionId)
assert.equal(firstPricedWrite.replayed, false)

const resolvedPriced = await pricedStoreB.resolve(pricedSelectionId)
assert.equal(resolvedPriced.alternativeId, alternativeId)
assert.equal(resolvedPriced.internalOfferId, representative.internalOfferId)
assert.equal(resolvedPriced.provider, representative.provider)
assert.equal(resolvedPriced.providerOfferRef, representative.providerOfferRef)
assert.deepEqual(resolvedPriced.customerPrice, customerPrice)
assert.deepEqual(resolvedPriced.itinerary, itinerary)
assert.deepEqual(resolvedPriced.fare, fare)
assert.deepEqual(resolvedPriced.passengerComposition, passengerComposition)
assert.equal(resolvedPriced.expiresAt, pricedExpiresAt)

const replayFromClientB = await pricedStoreB.createOrGet(pricedRecord)
assert.equal(replayFromClientB.pricedSelectionId, pricedSelectionId)
assert.equal(replayFromClientB.replayed, true)

process.stdout.write(`${JSON.stringify({
  gate: "flight-selection-durability-staging-js-adapter-cross-instance",
  projectRef: STAGING_PROJECT_REF,
  clientObjectsDistinct: true,
  search: { writtenBy: "A", resolvedBy: "B", alternativeId, expiresAt: offerExpiresAt },
  priced: { writtenBy: "A", resolvedBy: "B", replayedByB: true, pricedSelectionId, expiresAt: pricedExpiresAt },
  cleanup: {
    required: true,
    alternativeId,
    pricedSelectionId,
    note: "Delete only these two evidence identities from app_private after capturing this PASS output, then verify both durability tables return to their pre-run counts.",
  },
  result: "PASS",
}, null, 2)}\n`)
