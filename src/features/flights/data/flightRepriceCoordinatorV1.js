export function createFlightRepriceCoordinatorV1({ client, onState }) {
  let sequence = 0
  let controller
  return Object.freeze({
    async select(request) {
      controller?.abort()
      const id = ++sequence
      const current = new AbortController()
      controller = current
      onState(Object.freeze({ status: "repricing", request }))
      try {
        const result = await client.reprice(request, { signal: current.signal })
        if (id !== sequence || current.signal.aborted) return
        const status = result.repriceStatus === "UNAVAILABLE" ? "unavailable" : result.repriceStatus === "PRICE_CHANGED" ? "price_changed" : "available"
        onState(Object.freeze({ status, request, result }))
      } catch (error) {
        if (id !== sequence || current.signal.aborted) return
        onState(Object.freeze({ status: error?.kind ?? "internal_error", request }))
      }
    },
    cancel() { sequence += 1; controller?.abort() },
  })
}
