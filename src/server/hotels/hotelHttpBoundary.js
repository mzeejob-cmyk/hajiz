// Host application supplies a verified-session resolver. No cookie/JWT decoding here.
// All operations use POST bodies: no guest PII or supplier references in URLs.
export function createHotelHttpBoundary({ service, authenticate }) {
  const operations = new Set(["search", "detail", "rates", "reprice"])
  return async function handle(request) {
    const headers = { "Cache-Control": "no-store", "Content-Type": "application/json" }
    if (request.method !== "POST") return { status: 405, headers, body: { error: "METHOD_NOT_ALLOWED" } }
    if (!operations.has(request.operation)) return { status: 404, headers, body: { error: "NOT_FOUND" } }
    try {
      const session = await authenticate(request)
      if (!session?.userId) return { status: 401, headers, body: { error: "AUTH_REQUIRED" } }
      const body = await service[request.operation]({ userId: session.userId }, request.body)
      return { status: 200, headers, body }
    } catch {
      // Adapter errors can contain credentials: never reflect message/stack/headers.
      return { status: 422, headers, body: { error: "HOTEL_REQUEST_REJECTED" } }
    }
  }
}
