import { createNotificationOutbox, createP2RpcAdapter, createP2SupabaseAuthenticator, createProductP2Service } from "./productP2Service.js"
import { createProductP2Http } from "./productP2Http.js"

export const HAJIZ_STAGING_PROJECT_REF = "pdnuswmljownjzjzpoop"
export const HAJIZ_STAGING_SUPABASE_URL = `https://${HAJIZ_STAGING_PROJECT_REF}.supabase.co`
export const MAX_P2_EDGE_ENVELOPE_BYTES = 8192

function requireStaging(value, code) {
  if (!value) throw new Error(code)
}

// This composition is deliberately server-only. The privileged client is used
// only by the reviewed RPC adapter and is never returned to an HTTP caller.
export function createProductP2StagingComposition({ environment, projectRef, supabaseUrl, userClient, serviceClient }) {
  requireStaging(environment === "staging", "P2_STAGING_ENVIRONMENT_REQUIRED")
  requireStaging(projectRef === HAJIZ_STAGING_PROJECT_REF, "P2_STAGING_PROJECT_REQUIRED")
  requireStaging(supabaseUrl === HAJIZ_STAGING_SUPABASE_URL, "P2_STAGING_URL_REQUIRED")
  requireStaging(userClient && serviceClient && userClient !== serviceClient, "P2_CLIENT_SEPARATION_REQUIRED")

  const authenticate = createP2SupabaseAuthenticator(userClient)
  const rpc = createP2RpcAdapter(serviceClient)
  const service = createProductP2Service({ authenticate, rpc, schemaReady: true })

  return Object.freeze({
    http: createProductP2Http(service),
    notificationOutbox: createNotificationOutbox({ rpc, schemaReady: true }),
  })
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
}

function edgeResponse(status, body, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store", "Content-Type": "application/json" },
  })
}

async function readBoundedEnvelope(request) {
  const declared = request.headers.get("content-length")
  if (declared !== null) {
    const bytes = Number(declared)
    if (!Number.isSafeInteger(bytes) || bytes < 0) return { error: "INVALID_REQUEST", status: 400 }
    if (bytes > MAX_P2_EDGE_ENVELOPE_BYTES) return { error: "INPUT_TOO_LARGE", status: 413 }
  }

  const reader = request.body?.getReader()
  const chunks = []
  let total = 0
  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > MAX_P2_EDGE_ENVELOPE_BYTES) {
          try { await reader.cancel() } catch { /* cancellation is best effort */ }
          return { error: "INPUT_TOO_LARGE", status: 413 }
        }
        chunks.push(value)
      }
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const envelope = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    if (!plainObject(envelope) || Object.keys(envelope).some(key => !["operation", "body"].includes(key)) ||
      typeof envelope.operation !== "string" || envelope.operation.length === 0 || !plainObject(envelope.body)) {
      return { error: "INVALID_REQUEST", status: 400 }
    }
    return { envelope }
  } catch {
    return { error: "INVALID_REQUEST", status: 400 }
  } finally {
    reader?.releaseLock()
  }
}

// Transport-only adapter. Gateway JWT verification remains enabled at deploy time;
// the inner service also verifies the bearer token with auth.getUser().
export function createProductP2EdgeHandler({ getComposition, corsHeaders }) {
  requireStaging(typeof getComposition === "function" && plainObject(corsHeaders), "P2_EDGE_CONFIGURATION_REQUIRED")
  return async request => {
    if (request.method === "OPTIONS") return edgeResponse(200, { ok: true }, corsHeaders)
    if (request.method !== "POST") return edgeResponse(405, { error: "METHOD_NOT_ALLOWED" }, corsHeaders)

    const parsed = await readBoundedEnvelope(request)
    if (parsed.error) return edgeResponse(parsed.status, { error: parsed.error }, corsHeaders)

    try {
      const composition = await getComposition()
      const result = await composition.http({
        method: request.method,
        operation: parsed.envelope.operation,
        body: parsed.envelope.body,
        headers: { authorization: request.headers.get("authorization") ?? undefined },
      })
      return edgeResponse(result.status, result.body, { ...corsHeaders, ...result.headers })
    } catch {
      return edgeResponse(503, { error: "P2_STAGING_COMPOSITION_UNAVAILABLE" }, corsHeaders)
    }
  }
}
