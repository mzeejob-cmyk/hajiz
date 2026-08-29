const key = () => `hbi_req_${globalThis.crypto.randomUUID().replaceAll("-", "")}`

export function createFlightBookingIntentCoordinatorV1({ client, onState, createIdempotencyKey = key }) {
  if (!client?.create || typeof onState !== "function" || typeof createIdempotencyKey !== "function") throw new TypeError("booking intent coordinator dependencies are required")
  let sequence = 0; let controller; let active; let lastFingerprint; let lastIdempotencyKey
  return Object.freeze({
    create({ pricedSelectionId, travelerData }) {
      const fingerprint = JSON.stringify([pricedSelectionId, travelerData])
      if (active?.fingerprint === fingerprint) return active.promise
      controller?.abort(); const id = ++sequence; const current = new AbortController(); controller = current
      if (fingerprint !== lastFingerprint) { lastFingerprint = fingerprint; lastIdempotencyKey = createIdempotencyKey() }
      onState(Object.freeze({ status: "creating" }))
      const request = Object.freeze({ contractVersion: "flight-booking-intent-request/v1", pricedSelectionId, idempotencyKey: lastIdempotencyKey, travelers: travelerData.travelers, bookingContact: travelerData.contact })
      const promise = client.create(request, { signal: current.signal }).then((result) => {
        if (id !== sequence || current.signal.aborted) return
        const status = result.intentStatus === "READY_FOR_PAYMENT" ? "ready_for_payment" : result.intentStatus === "PRICE_CHANGED" ? "price_changed" : "unavailable"
        onState(Object.freeze({ status, result }))
      }).catch((error) => { if (id === sequence && !current.signal.aborted) onState(Object.freeze({ status: error?.kind ?? "internal_error" })) }).finally(() => { if (active?.promise === promise) active = null })
      active = Object.freeze({ fingerprint, promise })
      return promise
    },
    cancel() { sequence += 1; controller?.abort(); active = null },
  })
}
