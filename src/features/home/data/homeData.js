export const SEARCH_SERVICES = Object.freeze([
  { id: "flights", label: "الطيران", icon: "✈" },
  { id: "hotels", label: "الفنادق", icon: "⌂" },
  { id: "insurance", label: "التأمين", icon: "◇" },
  { id: "packages", label: "الباقات", icon: "▣" },
])

export const SELECTED_OFFERS = Object.freeze([
  { id: "flight", title: "عرض رحلة مختار", text: "استكشف تفاصيل العرض وشروطه.", mobileText: "تفاصيل وشروط واضحة قبل الحجز.", to: "/flights" },
  { id: "hotel", title: "فنادق مختارة", text: "اعثر على خيارات إقامة ضمن العرض.", mobileText: "استكشف الإقامة المشمولة.", to: "/hotels" },
  { id: "insurance", title: "ميزة تأمين السفر", text: "قارن التغطية عند توفر المزود.", to: "/insurance", desktopOnly: true },
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

export const CURATED_PACKAGES = Object.freeze([
  { title: "أيام القاهرة", duration: "4 أيام / 3 ليالٍ", displayPrice: "ابتداءً من 1,850 AED" },
  { title: "إسطنبول المختارة", duration: "6 أيام / 5 ليالٍ", displayPrice: "ابتداءً من 2,750 AED" },
  { title: "عطلة دبي", duration: "4 أيام / 3 ليالٍ", displayPrice: "ابتداءً من 1,980 AED", desktopOnly: true },
])
