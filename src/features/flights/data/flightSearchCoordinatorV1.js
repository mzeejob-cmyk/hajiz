export function createFlightSearchCoordinatorV1({ client, onState }) {
  let sequence = 0
  let controller
  const publish = (id, state) => { if (id === sequence) onState(Object.freeze(state)) }
  return Object.freeze({
    async search(request) {
      controller?.abort()
      const id = ++sequence
      controller = new AbortController()
      publish(id, { status: "loading", request })
      try {
        const result = await client.search(request, { signal: controller.signal })
        const status = result.searchStatus === "PARTIAL" ? "partial" : result.groups.length === 0 ? "empty" : "success"
        publish(id, { status, request, result })
      } catch (error) {
        if (controller.signal.aborted || id !== sequence) return
        publish(id, { status: error?.kind ?? "internal_error", request })
      }
    },
    cancel() { sequence += 1; controller?.abort() },
  })
}
