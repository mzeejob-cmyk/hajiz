import { getAccountSessionClient } from "./myTripsDataSource.js"

const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
function gate(ok, code = "ACCOUNT_P2_INPUT_INVALID") { if (!ok) throw new Error(code) }
function exact(input, allowed) { gate(plain(input) && Object.keys(input).every(key => allowed.includes(key))) }
function name(value) { gate(typeof value === "string" && value.trim().length > 0 && value.trim().length <= 80 && !/[\p{Cc}]/u.test(value)); return value.trim() }
function canonicalId(value) { gate(typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value)); return value }
function safeRows(value) { gate(Array.isArray(value), "ACCOUNT_P2_RESPONSE_INVALID"); return value }

export function createAccountP2DataSource({ getClient = getAccountSessionClient, createId = () => globalThis.crypto.randomUUID() } = {}) {
  async function invoke(command) {
    const client = getClient()
    const identity = await client.auth.getUser()
    gate(!identity.error && uuid(identity.data?.user?.id), "ACCOUNT_P2_AUTH_REQUIRED")
    const result = await client.functions.invoke("product-p2", { body: { operation: "collection", body: command } })
    gate(!result.error, "ACCOUNT_P2_REQUEST_FAILED")
    return result.data
  }
  function recordId(value) { const id = value ?? createId(); gate(uuid(id)); return id }
  function traveler(row) { exact(row, ["id", "firstName", "lastName"]); gate(uuid(row.id), "ACCOUNT_P2_RESPONSE_INVALID"); return Object.freeze({ id: row.id, firstName: name(row.firstName), lastName: name(row.lastName) }) }
  function favorite(row) { exact(row, ["id", "kind", "canonicalId"]); gate(uuid(row.id) && ["hotel", "package", "offer"].includes(row.kind), "ACCOUNT_P2_RESPONSE_INVALID"); return Object.freeze({ id: row.id, kind: row.kind, canonicalId: canonicalId(row.canonicalId) }) }
  return Object.freeze({
    async listTravelers() { return safeRows(await invoke({ collection: "travelers", operation: "list" })).map(traveler) },
    async saveTraveler(input) { exact(input, ["id", "firstName", "lastName"]); return traveler(await invoke({ collection: "travelers", operation: "save", id: recordId(input.id), data: { firstName: name(input.firstName), lastName: name(input.lastName) } })) },
    async deleteTraveler(id) { gate(uuid(id)); const value = await invoke({ collection: "travelers", operation: "delete", id }); gate(value?.deleted === true, "ACCOUNT_P2_RESPONSE_INVALID"); return Object.freeze({ deleted: true }) },
    async listFavorites() { return safeRows(await invoke({ collection: "favorites", operation: "list" })).map(favorite) },
    async saveFavorite(input) { exact(input, ["id", "kind", "canonicalId"]); gate(["hotel", "package", "offer"].includes(input.kind)); return favorite(await invoke({ collection: "favorites", operation: "save", id: recordId(input.id), data: { kind: input.kind, canonicalId: canonicalId(input.canonicalId) } })) },
    async deleteFavorite(id) { gate(uuid(id)); const value = await invoke({ collection: "favorites", operation: "delete", id }); gate(value?.deleted === true, "ACCOUNT_P2_RESPONSE_INVALID"); return Object.freeze({ deleted: true }) },
    async loadPreference() { const rows = safeRows(await invoke({ collection: "preferences", operation: "list" })); gate(rows.length <= 1, "ACCOUNT_P2_RESPONSE_INVALID"); if (!rows.length) return null; const row = rows[0]; exact(row, ["id", "locale"]); gate(uuid(row.id) && ["ar", "en"].includes(row.locale), "ACCOUNT_P2_RESPONSE_INVALID"); return Object.freeze({ id: row.id, locale: row.locale }) },
    async savePreference(locale) { gate(["ar", "en"].includes(locale)); const value = await invoke({ collection: "preferences", operation: "save", id: recordId(), data: { locale } }); exact(value, ["id", "locale"]); gate(uuid(value.id) && value.locale === locale, "ACCOUNT_P2_RESPONSE_INVALID"); return Object.freeze({ id: value.id, locale: value.locale }) },
  })
}

export const accountP2DataSource = createAccountP2DataSource()
