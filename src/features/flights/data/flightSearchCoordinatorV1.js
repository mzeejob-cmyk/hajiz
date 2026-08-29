export function createFlightSearchCoordinatorV1({ client, onState }) {
  let sequence = 0
  let controller
  const publish = (id, state) => { if (id === sequence) onState(Object.freeze(state)) }
  return Object.freeze({
    async search(request) {
      controller?.abort()
      const id = ++sequence
      const requestController = new AbortController()
      controller = requestController
      publish(id, { status: "loading", request })
      try {
        const result = await client.search(request, { signal: requestController.signal })
        const status = result.searchStatus === "PARTIAL" ? (result.groups.length === 0 ? "partial_empty" : "partial") : result.groups.length === 0 ? "empty" : "success"
        publish(id, { status, request, result })
      } catch (error) {
        if (requestController.signal.aborted || id !== sequence) return
        publish(id, { status: error?.kind ?? "internal_error", request })
      }
    },
    cancel() { sequence += 1; controller?.abort() },
  })
}
