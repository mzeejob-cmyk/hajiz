import { useCallback, useEffect, useMemo, useState } from "react"
import { DirectionContext } from "./directionContext.js"
import { DEFAULT_LOCALE, oppositeLocale, resolveLocale } from "./directionContract.js"

/**
 * Applies document direction and language for the V2 shell.
 * Default is Arabic RTL, matching index.html and the canonical V2 frames.
 * Components must use logical CSS properties rather than reading `dir`.
 */
export function DirectionProvider({ initialLocale = DEFAULT_LOCALE, children }) {
  const [code, setCode] = useState(() => resolveLocale(initialLocale).code)
  const locale = resolveLocale(code)

  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.lang = locale.code
    document.documentElement.dir = locale.dir
  }, [locale.code, locale.dir])

  const setLocale = useCallback(next => { setCode(resolveLocale(next).code) }, [])
  const toggleLocale = useCallback(() => { setCode(current => oppositeLocale(current).code) }, [])

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, next: oppositeLocale(code) }),
    [locale, setLocale, toggleLocale, code],
  )

  return <DirectionContext.Provider value={value}>{children}</DirectionContext.Provider>
}
