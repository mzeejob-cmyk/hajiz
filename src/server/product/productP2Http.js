export function createProductP2Http(service) {
  const operations = new Set(["collection", "adminReads", "partner", "catalog", "artifact"])
  return async request => {
    const headers = { "Cache-Control": "no-store" }
    if (request.method !== "POST") return { status: 405, headers, body: { error: "METHOD_NOT_ALLOWED" } }
    if (!operations.has(request.operation)) return { status: 404, headers, body: { error: "NOT_FOUND" } }
    try {
      if (JSON.stringify(request.body).length > 4096) return { status: 413, headers, body: { error: "INPUT_TOO_LARGE" } }
      const body = await service[request.operation](request, request.body)
      return { status: 200, headers, body }
    } catch (error) {
      const safe = new Set(["AUTH_REQUIRED", "ADMIN_REQUIRED", "P2_SCHEMA_NOT_APPLIED", "NOTIFICATION_PROVIDER_NOT_CONFIGURED", "ARTIFACT_PROVIDER_NOT_CONFIGURED"])
      const code = safe.has(error?.message) ? error.message : "P2_REQUEST_REJECTED"
      return { status: code === "AUTH_REQUIRED" ? 401 : code === "ADMIN_REQUIRED" ? 403 : code.endsWith("CONFIGURED") || code === "P2_SCHEMA_NOT_APPLIED" ? 503 : 422, headers, body: { error: code } }
    }
  }
}
