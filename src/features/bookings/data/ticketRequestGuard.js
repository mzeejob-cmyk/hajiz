export function createTicketRequestGuard(initialReference = "") {
  let activeReference = initialReference
  let generation = 0

  return Object.freeze({
    activate(reference) {
      activeReference = reference
      generation += 1
    },
    begin(reference) {
      generation += 1
      return Object.freeze({ reference, generation })
    },
    accepts(request) {
      return request?.reference === activeReference && request?.generation === generation
    },
    isActiveReference(reference) {
      return reference === activeReference
    },
  })
}

export function hasAuthoritativeAmount(amount) {
  return amount !== null && amount !== undefined
}
