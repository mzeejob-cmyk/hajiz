const key = () => `hpi_req_${globalThis.crypto.randomUUID().replaceAll("-", "")}`

export function createFlightPaymentInitiationCoordinatorV1({ client, onState, createIdempotencyKey = key }) {
  if (!client?.initiate || typeof onState !== "function" || typeof createIdempotencyKey !== "function") throw new TypeError("payment initiation coordinator dependencies are required")
  let sequence = 0
  let controller
  let active
  let lastFingerprint
  let lastIdempotencyKey

  return Object.freeze({
    initiate({ bookingIntentId, paymentMethod }) {
      const fingerprint = JSON.stringify([bookingIntentId, paymentMethod])
      if (active?.fingerprint === fingerprint) return active.promise
      controller?.abort()
      const id = ++sequence
      const current = new AbortController()
      controller = current
      if (fingerprint !== lastFingerprint) { lastFingerprint = fingerprint; lastIdempotencyKey = createIdempotencyKey() }
      onState(Object.freeze({ status: "initiating", paymentMethod }))
      const request = Object.freeze({ contractVersion: "flight-payment-initiation-request/v1", bookingIntentId, paymentMethod, idempotencyKey: lastIdempotencyKey })
      const promise = client.initiate(request, { signal: current.signal }).then((result) => {
        if (id !== sequence || current.signal.aborted) return
        onState(Object.freeze({ status: result.paymentMethod === "bankak" ? "bankak_handoff" : "psp_handoff", result }))
      }).catch((error) => {
        if (id === sequence && !current.signal.aborted) onState(Object.freeze({ status: error?.kind ?? "internal_error", paymentMethod }))
      }).finally(() => { if (active?.promise === promise) active = null })
      active = Object.freeze({ fingerprint, promise })
      return promise
    },
    cancel() { sequence += 1; controller?.abort(); active = null },
  })
}
