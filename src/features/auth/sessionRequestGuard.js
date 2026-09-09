export function createSessionRequestGuard() {
  let generation = 0
  let mounted = true
  return Object.freeze({
    begin() { generation += 1; return generation },
    invalidate() { generation += 1 },
    accepts(token) { return mounted && token === generation },
    stop() { mounted = false; generation += 1 },
  })
}
