export function makeBookingRequestState(reference, status, booking = null) {
  return Object.freeze({ reference, status, booking })
}

export function selectVisibleBookingRequest(request, reference, valid) {
  if (request?.reference === reference) return request
  return makeBookingRequestState(reference, valid ? "loading" : "invalid_reference")
}
