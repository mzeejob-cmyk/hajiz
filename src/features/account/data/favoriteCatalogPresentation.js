const labels = Object.freeze({ hotel: "فندق", package: "باقة", offer: "عرض" })

export function requiredFavoriteCatalogTypes(favorites) {
  return Object.freeze({
    package: favorites.some(favorite => favorite.kind === "package"),
    offer: favorites.some(favorite => favorite.kind === "offer"),
  })
}

export function resolveFavoritePresentation({ favorite, packages = [], offers = [], packageStatus = "ready", offerStatus = "ready" }) {
  if (favorite.kind === "hotel") return Object.freeze({
    label: labels.hotel,
    title: "فندق محفوظ",
    summary: "تفاصيل الفندق غير متاحة في هذه المرحلة.",
    published: false,
  })
  const rows = favorite.kind === "package" ? packages : offers
  const status = favorite.kind === "package" ? packageStatus : offerStatus
  const match = rows.find(row => row.type === favorite.kind && row.id === favorite.canonicalId)
  if (match) return Object.freeze({ label: labels[favorite.kind], title: match.title, summary: match.summary, published: true })
  if (status === "loading" || status === "idle") return Object.freeze({
    label: labels[favorite.kind],
    title: favorite.kind === "package" ? "باقة محفوظة" : "عرض محفوظ",
    summary: "جارٍ تحميل تفاصيل العنصر المحفوظ.",
    published: false,
  })
  if (status === "error") return Object.freeze({
    label: labels[favorite.kind],
    title: favorite.kind === "package" ? "باقة محفوظة" : "عرض محفوظ",
    summary: "تعذر تحميل تفاصيل هذا العنصر المحفوظ.",
    published: false,
  })
  return Object.freeze({
    label: labels[favorite.kind],
    title: favorite.kind === "package" ? "باقة محفوظة" : "عرض محفوظ",
    summary: "هذا العنصر لم يعد منشورًا حاليًا.",
    published: false,
  })
}

export function joinFavoriteCatalogPresentation({ favorites, packages = [], offers = [], packageStatus = "ready", offerStatus = "ready" }) {
  return favorites.map(favorite => Object.freeze({
    favorite,
    presentation: resolveFavoritePresentation({ favorite, packages, offers, packageStatus, offerStatus }),
  }))
}
