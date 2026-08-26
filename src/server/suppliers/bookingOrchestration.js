import { FROZEN_BOOKING_STATES } from "./flightSupplierContract.js"

const TRANSITIONS = Object.freeze({ payment_confirmed: "processing", processing: "confirmed", confirmed: "ticketed", ticketed: "completed" })

export function assertSupplierExecutionPrecondition(booking) {
  if (booking?.status !== "payment_confirmed") throw new Error("supplier execution requires payment_confirmed")
  return true
}

export function nextBookingTransition(currentState, supplierResult) {
  if (!FROZEN_BOOKING_STATES.includes(currentState)) throw new Error("unsupported HAJIZ booking state")
  if (!supplierResult || typeof supplierResult !== "object") throw new TypeError("supplier result is required")
  if (currentState === "payment_confirmed" && supplierResult.operationalOutcome === "processing") return "processing"
  if (currentState === "processing" && supplierResult.operationalOutcome === "confirmed") return "confirmed"
  if (currentState === "confirmed" && supplierResult.operationalOutcome === "ticketed" && supplierResult.ticketMetadata?.available === true) return "ticketed"
  throw new Error("supplier result cannot authorize this booking transition")
}

export function assertAllowedTrustedTransition(from, to) {
  if (!FROZEN_BOOKING_STATES.includes(from) || !FROZEN_BOOKING_STATES.includes(to) || TRANSITIONS[from] !== to) throw new Error("invalid frozen booking transition")
  return true
}
