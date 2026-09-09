export const SEARCH_SERVICES = Object.freeze([
  { id: "flights", label: "الطيران", icon: "✈" },
  { id: "hotels", label: "الفنادق", icon: "⌂" },
  { id: "insurance", label: "التأمين", icon: "◇" },
  { id: "packages", label: "الباقات", icon: "▣" },
])

export const POPULAR_ROUTES = Object.freeze([
  { from: "دبي", to: "الخرطوم", caption: "رحلات دولية", fromCode: "DXB", toCode: "KRT" },
  { from: "جدة", to: "بورتسودان", caption: "رحلات إلى السودان", fromCode: "JED", toCode: "PZU" },
  { from: "القاهرة", to: "الخرطوم", caption: "رحلات إقليمية", fromCode: "CAI", toCode: "KRT" },
])

export const HOTEL_DESTINATIONS = Object.freeze([
  { city: "دبي", code: "DXB" },
  { city: "القاهرة", code: "CAI" },
  { city: "جدة", code: "JED" },
])
