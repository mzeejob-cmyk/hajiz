/**
 * V2 direction/language presentation contract.
 * Presentation only: this decides document direction and font family.
 * It is NOT a localization system and holds no translated product copy.
 */
export const DIRECTION_LOCALES = Object.freeze({
  ar: Object.freeze({ code: "ar", dir: "rtl", label: "العربية", font: "arabic" }),
  en: Object.freeze({ code: "en", dir: "ltr", label: "English", font: "latin" }),
})

/** Arabic-first: the product's primary presentation, per the V2 audit frame. */
export const DEFAULT_LOCALE = "ar"

export function resolveLocale(code) {
  return DIRECTION_LOCALES[code] ?? DIRECTION_LOCALES[DEFAULT_LOCALE]
}

export function oppositeLocale(code) {
  return code === "en" ? DIRECTION_LOCALES.ar : DIRECTION_LOCALES.en
}
