import { getAccountSessionClient } from "./myTripsDataSource.js"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TYPES = new Set(["package", "offer"]), STATES = new Set(["draft", "published"])
function gate(ok, code = "ADMIN_CATALOG_RESPONSE_INVALID") { if (!ok) throw new Error(code) }
function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)) }
function exact(value, fields, code) { gate(plain(value) && Object.keys(value).length === fields.length && Object.keys(value).every(key => fields.includes(key)), code) }
function text(value, max) { gate(typeof value === "string" && value.length > 0 && value.length <= max && !/[\p{Cc}]/u.test(value), "ADMIN_CATALOG_INPUT_INVALID"); return value }
function id(value) { gate(typeof value === "string" && UUID.test(value), "ADMIN_CATALOG_INPUT_INVALID"); return value }
function version(value) { gate(Number.isSafeInteger(value) && value >= 0, "ADMIN_CATALOG_INPUT_INVALID"); return value }
function record(value) {
  const fields = ["id", "type", "title", "summary", "state", "version", "dynamicBuilder", "supplierAvailability"]
  exact(value, fields)
  gate(UUID.test(value.id) && TYPES.has(value.type) && STATES.has(value.state) && Number.isSafeInteger(value.version) && value.version >= 1)
  gate(value.dynamicBuilder === false && value.supplierAvailability === null)
  return Object.freeze({ id: value.id, type: value.type, title: text(value.title, 120), summary: text(value.summary, 1000), state: value.state, version: value.version, dynamicBuilder: false, supplierAvailability: null })
}
function acknowledgement(value, expectedState) { exact(value, ["state", "version"]); gate(value.state === expectedState && Number.isSafeInteger(value.version) && value.version >= 1); return Object.freeze({ state: value.state, version: value.version }) }

export function createAdminCatalogP2DataSource({ getClient = getAccountSessionClient, createId = () => globalThis.crypto.randomUUID() } = {}) {
  async function invoke(command, errorCode = "ADMIN_CATALOG_REQUEST_FAILED") {
    const client = getClient(), identity = await client.auth.getUser()
    gate(!identity.error && UUID.test(identity.data?.user?.id ?? ""), "ADMIN_CATALOG_AUTH_REQUIRED")
    const result = await client.functions.invoke("product-p2", { body: { operation: "catalog", body: command } })
    gate(!result.error, errorCode)
    return result.data
  }
  async function list(operation) { const value = await invoke({ operation }); gate(Array.isArray(value)); return Object.freeze(value.map(record)) }
  function draft(input, allowId) { const fields = allowId ? ["id", "type", "title", "summary", "version"] : ["type", "title", "summary"]; exact(input, fields, "ADMIN_CATALOG_INPUT_INVALID"); gate(TYPES.has(input.type), "ADMIN_CATALOG_INPUT_INVALID"); return { ...(allowId ? { id: id(input.id), expectedVersion: version(input.version) } : { id: id(createId()), expectedVersion: 0 }), type: input.type, title: text(input.title, 120), summary: text(input.summary, 1000) } }
  return Object.freeze({
    listDrafts: () => list("drafts"),
    listPublished: () => list("published"),
    async createDraft(input) { const value = draft(input, false); return acknowledgement(await invoke({ operation: "save", ...value }, "ADMIN_CATALOG_SAVE_FAILED"), "draft") },
    async updateDraft(input) { const value = draft(input, true); gate(value.expectedVersion >= 1, "ADMIN_CATALOG_INPUT_INVALID"); return acknowledgement(await invoke({ operation: "save", ...value }, "ADMIN_CATALOG_SAVE_FAILED"), "draft") },
    async publishDraft(input) { exact(input, ["id", "version"], "ADMIN_CATALOG_INPUT_INVALID"); return acknowledgement(await invoke({ operation: "publish", id: id(input.id), expectedVersion: version(input.version) }, "ADMIN_CATALOG_PUBLISH_FAILED"), "published") },
  })
}

export const adminCatalogP2DataSource = createAdminCatalogP2DataSource()
