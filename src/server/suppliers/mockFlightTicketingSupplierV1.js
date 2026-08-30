import { createServerDigestV1 } from "../security/serverDigestV1.js"
import { SUPPLIER_OPERATIONS } from "./supplierOperations.js"

const freeze = (value) => Object.freeze(value)
const safe = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/

export function createMockFlightTicketingSupplierV1({ env = process.env, clock = Date.now } = {}) {
  if (env?.NODE_ENV === "production") throw new Error("synthetic ticketing supplier is forbidden in production")
  const capabilities = freeze(Object.fromEntries(SUPPLIER_OPERATIONS.map((operation) => [operation, ["confirm_booking", "retrieve_ticket"].includes(operation)])))
  const resultsByKey = new Map()
  const resultsByBooking = new Map()

  const issuedResult = ({ supplierBookingRef, idempotencyKey, travelerKeys }) => freeze({
    providerName: "mock",
    supplierBookingRef,
    providerStatusRaw: "MOCK_TICKETS_ISSUED",
    operationalOutcome: "ticketed",
    tickets: freeze(travelerKeys.map((travelerKey, index) => {
      const suffix = createServerDigestV1([idempotencyKey, travelerKey]).slice(0, 12).toUpperCase()
      return freeze({
        travelerKey,
        ticketNumber: `MOCK-${suffix}`,
        supplierTicketRef: `MOCK-TKT-${index + 1}-${suffix}`,
        issuedAt: new Date(clock()).toISOString(),
        artifact: freeze({ availability: "METADATA_ONLY", artifactRef: null, mediaType: null, digest: null }),
      })
    })),
  })

  const adapter = {
    providerName: "mock",
    capabilities,
    async health() { return freeze({ providerName: "mock", healthy: true, synthetic: true, network: false, productionAllowed: false, capabilities }) },
    async confirmBooking(request) {
      if (!request || !safe.test(request.supplierBookingRef ?? "") || !/^hst_req_[A-Za-z0-9_-]{16,80}$/.test(request.idempotencyKey ?? "") || !Array.isArray(request.travelerKeys) || request.travelerKeys.length < 1 || request.travelerKeys.some((key) => !/^[A-Za-z0-9_-]{1,40}$/.test(key))) throw new TypeError("trusted synthetic ticketing request is required")
      if (!resultsByKey.has(request.idempotencyKey)) {
        const result = issuedResult(request)
        resultsByKey.set(request.idempotencyKey, result)
        resultsByBooking.set(request.supplierBookingRef, result)
      }
      return resultsByKey.get(request.idempotencyKey)
    },
    async retrieveTicket(supplierBookingRef) {
      if (!safe.test(supplierBookingRef ?? "") || !resultsByBooking.has(supplierBookingRef)) throw new Error("synthetic ticket evidence is unavailable")
      return resultsByBooking.get(supplierBookingRef)
    },
  }
  return freeze(adapter)
}
