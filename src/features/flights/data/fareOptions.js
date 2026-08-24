import { FLIGHT_FIXTURES } from "./flightFixtures.js"

export const FARE_OPTIONS = Object.freeze([
  { key: "cabin", title: "اقتصادية · حقيبة مقصورة", subtitle: "الدرجة السياحية", amount: "1,120", currency: "AED", baggage: "حقيبة مقصورة", flexibility: "تطبق الشروط" },
  { key: "checked", title: "اقتصادية · أمتعة مشمولة", subtitle: "الدرجة السياحية", amount: "1,205", currency: "AED", baggage: "أمتعة مشمولة · 23 كجم", flexibility: "تطبق الشروط" },
])
export function resolveItinerary(key) { return FLIGHT_FIXTURES.find((offer) => offer.key === key) }
export function resolveFare(key) { return FARE_OPTIONS.find((fare) => fare.key === key) }
