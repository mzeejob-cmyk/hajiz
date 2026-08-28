const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d{1,8})?$/

const gcd = (left, right) => {
  let a = left < 0n ? -left : left
  let b = right < 0n ? -right : right
  while (b) [a, b] = [b, a % b]
  return a || 1n
}
const fraction = (numerator, denominator = 1n) => {
  if (denominator === 0n) throw new RangeError("decimal denominator cannot be zero")
  const sign = denominator < 0n ? -1n : 1n
  const divisor = gcd(numerator, denominator)
  return Object.freeze({ numerator: numerator * sign / divisor, denominator: denominator * sign / divisor })
}

export function parseDecimal(value, field = "decimal") {
  if (typeof value !== "string" || !DECIMAL.test(value)) throw new TypeError(`${field} must be a decimal string with at most 8 places`)
  const negative = value.startsWith("-")
  const unsigned = negative ? value.slice(1) : value
  const [whole, decimals = ""] = unsigned.split(".")
  const denominator = 10n ** BigInt(decimals.length)
  const numerator = BigInt(whole) * denominator + BigInt(decimals || "0")
  return fraction(negative ? -numerator : numerator, denominator)
}

export const addDecimal = (a, b) => fraction(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator)
export const subtractDecimal = (a, b) => fraction(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator)
export const multiplyDecimal = (a, b) => fraction(a.numerator * b.numerator, a.denominator * b.denominator)
export const divideDecimal = (a, b) => fraction(a.numerator * b.denominator, a.denominator * b.numerator)
export const compareDecimal = (a, b) => {
  const difference = a.numerator * b.denominator - b.numerator * a.denominator
  return difference < 0n ? -1 : difference > 0n ? 1 : 0
}

export const fractionRecord = (value) => Object.freeze({ numerator: String(value.numerator), denominator: String(value.denominator) })
export const fromFractionRecord = (value, field = "fraction") => {
  if (!value || typeof value !== "object" || !/^-?\d+$/.test(value.numerator) || !/^\d+$/.test(value.denominator)) throw new TypeError(`${field} is invalid`)
  return fraction(BigInt(value.numerator), BigInt(value.denominator))
}

export function formatDecimal(value, places, { trim = false } = {}) {
  if (!Number.isInteger(places) || places < 0 || places > 8) throw new TypeError("decimal places are invalid")
  const scale = 10n ** BigInt(places)
  const negative = value.numerator < 0n
  const absolute = negative ? -value.numerator : value.numerator
  let units = absolute * scale / value.denominator
  const remainder = absolute * scale % value.denominator
  if (remainder * 2n >= value.denominator) units += 1n
  const whole = units / scale
  if (places === 0) return `${negative ? "-" : ""}${whole}`
  let decimals = String(units % scale).padStart(places, "0")
  if (trim) decimals = decimals.replace(/0+$/, "")
  return `${negative ? "-" : ""}${whole}${decimals ? `.${decimals}` : ""}`
}
