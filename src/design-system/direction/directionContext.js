import { createContext, useContext } from "react"
import { DEFAULT_LOCALE, oppositeLocale, resolveLocale } from "./directionContract.js"

/**
 * Split from DirectionProvider.jsx so that the provider file exports only a
 * component, matching the existing authSessionContext.js convention and
 * keeping fast refresh working.
 */
export const DirectionContext = createContext(null)

/** Safe outside a provider: falls back to the Arabic-first default. */
export function useDirection() {
  const value = useContext(DirectionContext)
  if (value) return value
  const locale = resolveLocale(DEFAULT_LOCALE)
  return { locale, setLocale: () => {}, toggleLocale: () => {}, next: oppositeLocale(locale.code) }
}
