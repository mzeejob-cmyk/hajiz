import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"

export function hotelGate(condition, code) {
  if (!condition) throw new Error(code)
}
export const hotelId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
export const hotelDigest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex")

// Server-provisioned, versioned snapshots. No browser mapping writes or name matching.
export function createHotelMappingStore(snapshot) {
  const data = structuredClone(snapshot)
  hotelGate(data?.version === 1 && Array.isArray(data.records), "MAPPING_SNAPSHOT_INVALID")
  for (const r of data.records) {
    hotelGate([r.provider, r.supplierPropertyId, r.canonicalHotelId].every(hotelId), "MAPPING_ID_INVALID")
    hotelGate(/^hjz_htl_/.test(r.canonicalHotelId), "MAPPING_ID_INVALID")
    hotelGate(r.supplierRoomId == null || (hotelId(r.supplierRoomId) && /^hjz_room_[a-z0-9_]+$/.test(r.canonicalRoomId)), "ROOM_MAPPING_INVALID")
    hotelGate(["mapped", "ambiguous", "review", "unmapped"].includes(r.status), "MAPPING_STATUS_INVALID")
    hotelGate(Number.isFinite(r.confidence) && r.confidence >= 0 && r.confidence <= 1, "MAPPING_CONFIDENCE_INVALID")
    hotelGate(typeof r.provenance === "string" && r.provenance.length > 0, "MAPPING_PROVENANCE_REQUIRED")
    hotelGate(Number.isFinite(Date.parse(r.createdAt)) && Number.isFinite(Date.parse(r.updatedAt)) && Date.parse(r.updatedAt) >= Date.parse(r.createdAt), "MAPPING_TIME_INVALID")
  }
  function resolve(provider, property, room = null) {
    const matches = data.records.filter(r => r.provider === provider && r.supplierPropertyId === property && (r.supplierRoomId ?? null) === room)
    hotelGate(matches.length > 0, "MAPPING_MISSING")
    hotelGate(matches.every(r => r.status === "mapped"), "MAPPING_REVIEW_REQUIRED")
    const ids = new Set(matches.map(r => JSON.stringify([r.canonicalHotelId, r.canonicalRoomId ?? null])))
    hotelGate(ids.size === 1, "MAPPING_AMBIGUOUS")
    const value = matches[0]
    if (room !== null) hotelGate(resolve(provider, property).canonicalHotelId === value.canonicalHotelId, "ROOM_PARENT_MISMATCH")
    return structuredClone(value)
  }
  return Object.freeze({ resolve, revision: hotelDigest(data) })
}

// Path supplied by server composition only, never by an HTTP request.
// Durable mapping authority survives restart; runtime selections deliberately expire on restart.
export function loadHotelMappingStore(path) {
  hotelGate(typeof path === "string" && path.length > 0, "MAPPING_PATH_REQUIRED")
  try { return createHotelMappingStore(JSON.parse(readFileSync(path, "utf8"))) }
  catch { throw new Error("MAPPING_SNAPSHOT_INVALID") }
}
