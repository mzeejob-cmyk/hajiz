export const MAX_PUBLIC_CATALOG_REQUEST_BYTES = 256
const TYPES = new Set(["package", "offer"])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RAW_FIELDS = ["id", "type", "title", "summary", "state", "version", "created_at", "updated_at", "published_at"]
const RPC_PARAMETERS = Object.freeze({ p_actor_id: null, p_operation: "published", p_record_id: null, p_type: null, p_title: null, p_summary: null, p_expected_version: null })

function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)) }
function validText(value, max) { return typeof value === "string" && value.length > 0 && value.length <= max && !/[\p{Cc}]/u.test(value) }
function validDate(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)) }
function validateRequest(value) { if (!plain(value) || Object.keys(value).length !== 1 || !TYPES.has(value.type)) throw new Error("INVALID_REQUEST"); return value.type }
function validateRawRow(row) {
  if (!plain(row) || Object.keys(row).length !== RAW_FIELDS.length || Object.keys(row).some(key => !RAW_FIELDS.includes(key))) throw new Error("PUBLIC_CATALOG_UNAVAILABLE")
  if (!UUID.test(row.id) || !TYPES.has(row.type) || !["draft", "published"].includes(row.state) || !Number.isSafeInteger(row.version) || row.version < 1 || !validText(row.title, 120) || !validText(row.summary, 1000)) throw new Error("PUBLIC_CATALOG_UNAVAILABLE")
  if (!validDate(row.created_at) || !validDate(row.updated_at) || (row.published_at !== null && !validDate(row.published_at))) throw new Error("PUBLIC_CATALOG_UNAVAILABLE")
  if (row.state === "published" && row.published_at === null) throw new Error("PUBLIC_CATALOG_UNAVAILABLE")
  return row
}

export function createPublicCatalogRead({ rpc }) {
  if (typeof rpc !== "function") throw new Error("PUBLIC_CATALOG_CONFIGURATION_INVALID")
  return Object.freeze({
    async read(input) {
      const type = validateRequest(input)
      let value
      try { value = await rpc("p2_catalog_v1", RPC_PARAMETERS) } catch { throw new Error("PUBLIC_CATALOG_UNAVAILABLE") }
      if (!Array.isArray(value)) throw new Error("PUBLIC_CATALOG_UNAVAILABLE")
      return Object.freeze(value.map(validateRawRow).filter(row => row.state === "published" && row.type === type).map(row => Object.freeze({ id: row.id, type: row.type, title: row.title, summary: row.summary, state: "published", version: row.version, dynamicBuilder: false, supplierAvailability: null })))
    },
  })
}

function response(status, body, corsHeaders) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Cache-Control": "no-store", "Content-Type": "application/json" } }) }
async function boundedJson(request) {
  const declared = request.headers.get("content-length")
  if (declared !== null) { const bytes = Number(declared); if (!Number.isSafeInteger(bytes) || bytes < 0) return { error: "INVALID_REQUEST", status: 400 }; if (bytes > MAX_PUBLIC_CATALOG_REQUEST_BYTES) return { error: "INPUT_TOO_LARGE", status: 413 } }
  const reader = request.body?.getReader(), chunks = []; let total = 0
  try {
    if (reader) while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_PUBLIC_CATALOG_REQUEST_BYTES) { try { await reader.cancel() } catch { /* best effort */ } return { error: "INPUT_TOO_LARGE", status: 413 } } chunks.push(value) }
    const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) }
  } catch { return { error: "INVALID_REQUEST", status: 400 } } finally { reader?.releaseLock() }
}

export function createPublicCatalogEdgeHandler({ service, corsHeaders }) {
  if (!service?.read || !plain(corsHeaders)) throw new Error("PUBLIC_CATALOG_CONFIGURATION_INVALID")
  return async request => {
    if (request.method === "OPTIONS") return response(200, { ok: true }, corsHeaders)
    if (request.method !== "POST") return response(405, { error: "METHOD_NOT_ALLOWED" }, corsHeaders)
    const parsed = await boundedJson(request)
    if (parsed.error) return response(parsed.status, { error: parsed.error }, corsHeaders)
    try { return response(200, await service.read(parsed.value), corsHeaders) }
    catch (error) { return response(error?.message === "INVALID_REQUEST" ? 400 : 503, { error: error?.message === "INVALID_REQUEST" ? "INVALID_REQUEST" : "PUBLIC_CATALOG_UNAVAILABLE" }, corsHeaders) }
  }
}
