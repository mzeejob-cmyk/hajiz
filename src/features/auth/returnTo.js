export const DEFAULT_AUTH_RETURN_TO = "/account/trips"

export function normalizeInternalReturnTo(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 2048) return DEFAULT_AUTH_RETURN_TO
  if (!/^\/(?!\/)/.test(value) || value.includes("\\") || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return DEFAULT_AUTH_RETURN_TO
  return value
}
