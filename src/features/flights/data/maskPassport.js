export function maskPassport(value = "") {
  const passport = String(value).trim()
  if (!passport) return "••••"
  if (passport.length <= 4) return `${passport[0]}•••`
  return `${passport[0]}${"•".repeat(Math.max(3, passport.length - 4))}${passport.slice(-3)}`
}
