const KNOWN_LOCATIONS = Object.freeze({
  DXB: "دبي",
  KRT: "الخرطوم",
  JED: "جدة",
  PZU: "بورتسودان",
  CAI: "القاهرة",
})

const cleanCode = (value, fallback) => {
  const code = String(value || "").toUpperCase()
  return Object.hasOwn(KNOWN_LOCATIONS, code) ? code : fallback
}

export function parseFlightQuery(source) {
  const params = source instanceof URLSearchParams ? source : new URLSearchParams(source)
  const from = cleanCode(params.get("from"), "DXB")
  const to = cleanCode(params.get("to"), "KRT")
  return {
    from,
    to,
    fromLabel: KNOWN_LOCATIONS[from],
    toLabel: KNOWN_LOCATIONS[to],
    departure: params.get("departure") || "2026-09-15",
    returnDate: params.get("returnDate") || "",
    travelers: params.get("travelers") || "1",
    tripType: params.get("tripType") === "oneway" ? "oneway" : "round",
  }
}
