const SAFE_KEYS = Object.freeze(["VITE_APP_ENV", "VITE_PUBLIC_SITE_URL"])

export function validatePublicEnvironment(source = import.meta.env) {
  const appEnv = source.VITE_APP_ENV || "development"
  if (!["development", "staging", "production", "test"].includes(appEnv)) throw new Error("VITE_APP_ENV is invalid")
  const siteUrl = source.VITE_PUBLIC_SITE_URL || "http://localhost:5173"
  let parsed
  try { parsed = new URL(siteUrl) } catch { throw new Error("VITE_PUBLIC_SITE_URL must be a valid URL") }
  return Object.freeze({ appEnv, siteUrl: parsed.toString(), safeKeys: SAFE_KEYS })
}
