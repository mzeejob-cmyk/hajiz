export const ROUTE_MANIFEST = Object.freeze([
  { id: "home", path: "/", feature: "home" },
  { id: "flights", path: "/flights", feature: "flights" },
  { id: "hotels", path: "/hotels", feature: "hotels" },
  { id: "insurance", path: "/insurance", feature: "insurance" },
  { id: "packages", path: "/packages", feature: "packages" },
  { id: "offers", path: "/offers", feature: "offers" },
  { id: "checkout", path: "/checkout/*", feature: "checkout" },
  { id: "booking", path: "/bookings/:reference", feature: "bookings" },
  { id: "account", path: "/account/*", feature: "account" },
  { id: "partners", path: "/partners/*", feature: "partners" },
  { id: "admin", path: "/admin/*", feature: "admin" },
])
