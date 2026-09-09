const PROJECT_HOST = "pdnuswmljownjzjzpoop.supabase.co"
const TYPES = new Set(["package", "offer"])
const FIELDS = ["id", "type", "title", "summary", "state", "version", "dynamicBuilder", "supplierAvailability"]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function endpointFrom(value) {
  let url
  try { url = new URL(value) } catch { throw new Error("PUBLIC_CATALOG_NOT_CONFIGURED") }
  if (url.protocol !== "https:" || url.hostname !== PROJECT_HOST || url.port || url.username || url.password || !["", "/"].includes(url.pathname) || url.search || url.hash) throw new Error("PUBLIC_CATALOG_NOT_CONFIGURED")
  return `https://${PROJECT_HOST}/functions/v1/catalog-public`
}

function validText(value, max) { return typeof value === "string" && value.length > 0 && value.length <= max && !/[\p{Cc}]/u.test(value) }
function validateRow(row, type) {
  if (!row || typeof row !== "object" || Array.isArray(row) || Object.getPrototypeOf(row) !== Object.prototype) throw new Error("PUBLIC_CATALOG_RESPONSE_INVALID")
  const keys = Object.keys(row)
  if (keys.length !== FIELDS.length || keys.some(key => !FIELDS.includes(key))) throw new Error("PUBLIC_CATALOG_RESPONSE_INVALID")
  if (!UUID.test(row.id) || row.type !== type || row.state !== "published" || !validText(row.title, 120) || !validText(row.summary, 1000) || !Number.isSafeInteger(row.version) || row.version < 1 || row.dynamicBuilder !== false || row.supplierAvailability !== null) throw new Error("PUBLIC_CATALOG_RESPONSE_INVALID")
  return Object.freeze({ id: row.id, type: row.type, title: row.title, summary: row.summary, state: row.state, version: row.version, dynamicBuilder: false, supplierAvailability: null })
}

export function createPublicCatalogDataSource({ fetchImpl = globalThis.fetch, supabaseUrl = import.meta.env?.VITE_SUPABASE_URL } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("PUBLIC_CATALOG_NOT_CONFIGURED")
  const endpoint = endpointFrom(supabaseUrl)
  async function load(type) {
    if (!TYPES.has(type)) throw new Error("PUBLIC_CATALOG_REQUEST_FAILED")
    let response
    try { response = await fetchImpl(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }) }) }
    catch { throw new Error("PUBLIC_CATALOG_REQUEST_FAILED") }
    if (!response?.ok) throw new Error("PUBLIC_CATALOG_REQUEST_FAILED")
    let value
    try { value = await response.json() } catch { throw new Error("PUBLIC_CATALOG_RESPONSE_INVALID") }
    if (!Array.isArray(value)) throw new Error("PUBLIC_CATALOG_RESPONSE_INVALID")
    return Object.freeze(value.map(row => validateRow(row, type)))
  }
  return Object.freeze({ loadPackages: () => load("package"), loadOffers: () => load("offer") })
}

export const publicCatalogDataSource = Object.freeze({
  loadPackages: () => createPublicCatalogDataSource().loadPackages(),
  loadOffers: () => createPublicCatalogDataSource().loadOffers(),
})
