import { assertFlightSupplier } from "../suppliers/flightSupplierContract.js"
import { assertSupplierExecutionPrecondition, nextBookingTransition } from "../suppliers/bookingOrchestration.js"
import { assertPspAdapter } from "../../services/payments/psp/adapter.js"
import { toApplyPaymentEventArgs, validatePaymentSessionRequest } from "../../services/payments/psp/contract.js"

const TERMINAL_VISIBLE_STATE = "ticketed"

function requireGateway(gateway) {
  for (const method of ["getBookingAuthority", "applyPaymentEvent", "applyBookingTransition", "getMyBookings"]) {
    if (typeof gateway?.[method] !== "function") throw new TypeError(`authority gateway must implement ${method}`)
  }
  return gateway
}

function transitionMetadata(result) {
  return Object.freeze({
    synthetic: true,
    providerName: result.providerName,
    providerStatusRaw: result.providerStatusRaw,
    ticketMetadata: result.ticketMetadata ?? null,
  })
}

/**
 * Trusted server-only orchestration for the deterministic Staging proof.
 * The gateway owns every database read/write and must call the existing
 * service-role-only RPCs. Adapters never receive a database client.
 */
export async function runStagingMockBookingV1(input, dependencies) {
  const gateway = requireGateway(dependencies?.gateway)
  const psp = assertPspAdapter(dependencies?.psp)
  const supplier = assertFlightSupplier(dependencies?.supplier)
  const trustedPayment = validatePaymentSessionRequest(input?.trustedPayment)
  const required = ["bookingId", "bookingExecutionKey", "supplierOfferRef", "trustedTravelerToken"]
  for (const field of required) if (typeof input?.[field] !== "string" || !input[field]) throw new TypeError(`${field} is required`)

  let booking = await gateway.getBookingAuthority(input.bookingId)
  if (!booking || booking.id !== input.bookingId) throw new Error("trusted booking is unavailable")
  if (booking.paymentId !== trustedPayment.paymentId) throw new Error("payment does not belong to trusted booking")
  if (booking.status === TERMINAL_VISIBLE_STATE || booking.status === "completed") {
    return visibleResult(gateway, booking)
  }

  if (booking.status === "pending_payment") {
    const session = await psp.createPaymentSession(trustedPayment)
    const event = await psp.capture({ providerPaymentId: session.providerPaymentId, trustedPayment })
    await gateway.applyPaymentEvent(toApplyPaymentEventArgs(psp.getMetadata().name, event, trustedPayment, session.providerPaymentId))
    booking = await gateway.getBookingAuthority(input.bookingId)
  }

  assertSupplierExecutionPrecondition(booking)
  const created = await supplier.createBooking({
    supplierOfferRef: input.supplierOfferRef,
    idempotencyKey: input.bookingExecutionKey,
    trustedTravelerToken: input.trustedTravelerToken,
  })
  const processing = nextBookingTransition(booking.status, created)
  await gateway.applyBookingTransition({
    bookingId: booking.id, target: processing, supplierReference: created.supplierBookingRef,
    supplierMetadata: transitionMetadata(created),
  })

  const confirmedResult = await supplier.getBookingStatus(created.supplierBookingRef)
  const confirmed = nextBookingTransition(processing, confirmedResult)
  await gateway.applyBookingTransition({
    bookingId: booking.id, target: confirmed, supplierReference: created.supplierBookingRef,
    supplierMetadata: transitionMetadata(confirmedResult),
  })

  const ticketedResult = await supplier.getBookingStatus(created.supplierBookingRef)
  const ticketed = nextBookingTransition(confirmed, ticketedResult)
  await gateway.applyBookingTransition({
    bookingId: booking.id, target: ticketed, supplierReference: created.supplierBookingRef,
    supplierMetadata: transitionMetadata(ticketedResult),
  })
  booking = await gateway.getBookingAuthority(input.bookingId)
  return visibleResult(gateway, booking)
}

async function visibleResult(gateway, booking) {
  const trips = await gateway.getMyBookings()
  const trip = trips.find(item => item.booking_ref === booking.bookingRef)
  if (!trip || trip.status !== booking.status) throw new Error("My Trips boundary did not expose the trusted booking state")
  return Object.freeze({ bookingId: booking.id, bookingRef: booking.bookingRef, status: booking.status, trip: Object.freeze({ ...trip }) })
}
