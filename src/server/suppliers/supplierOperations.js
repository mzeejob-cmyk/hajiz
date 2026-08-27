export const SUPPLIER_OPERATIONS = Object.freeze([
  "search_flights", "reprice", "create_booking", "confirm_booking", "get_booking_status",
  "retrieve_ticket", "cancel", "change", "hold",
])

export const OPERATION_METHODS = Object.freeze({
  search_flights: "searchFlights",
  reprice: "repriceOffer",
  create_booking: "createBooking",
  confirm_booking: "confirmBooking",
  get_booking_status: "getBookingStatus",
  retrieve_ticket: "retrieveTicket",
  cancel: "cancelBooking",
  change: "changeBooking",
  hold: "holdOffer",
})

export class SupplierCapabilityError extends Error {
  constructor(provider, operation) {
    super(`supplier capability is not enabled: ${provider}:${operation}`)
    this.name = "SupplierCapabilityError"
    this.code = "SUPPLIER_CAPABILITY_UNAVAILABLE"
    this.provider = provider
    this.operation = operation
  }
}

export function assertSupplierOperation(operation) {
  if (!SUPPLIER_OPERATIONS.includes(operation)) throw new TypeError(`unknown supplier operation: ${operation}`)
  return operation
}
