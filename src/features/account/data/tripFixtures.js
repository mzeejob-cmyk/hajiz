export const MY_TRIPS_SUPPORTED_STATES = Object.freeze(["pending_payment", "payment_confirmed", "processing", "confirmed", "ticketed", "completed"])

// Synthetic presentation fixtures only. Never use these records as booking, payment, or supplier authority.
export const SYNTHETIC_TRIP_FIXTURES = Object.freeze([
  Object.freeze({ key: "demo-ek735-processing", bookingState: "processing", paymentState: "confirmed", reference: "HJZ-9K4M2-DEMO", route: "DXB → KRT", airline: "طيران الإمارات", flight: "EK 735", date: "15 سبتمبر", time: "08:30 – 10:50", traveler: "MOHAMED AHMED", fare: "اقتصادية · أمتعة 23 كجم" }),
  Object.freeze({ key: "demo-ek735-confirmed", bookingState: "confirmed", paymentState: "confirmed", reference: "HJZ-4N7Q1-DEMO", route: "DXB → KRT", airline: "طيران الإمارات", flight: "EK 735", date: "20 سبتمبر", time: "08:30 – 10:50", traveler: "MOHAMED AHMED", fare: "اقتصادية · أمتعة 23 كجم" }),
  Object.freeze({ key: "demo-ek735-ticketed", bookingState: "ticketed", paymentState: "confirmed", reference: "HJZ-8T2L6-DEMO", route: "DXB → KRT", airline: "طيران الإمارات", flight: "EK 735", date: "25 سبتمبر", time: "08:30 – 10:50", traveler: "MOHAMED AHMED", fare: "اقتصادية · أمتعة 23 كجم" }),
  Object.freeze({ key: "demo-ek735-completed", bookingState: "completed", paymentState: "confirmed", reference: "HJZ-3C5R9-DEMO", route: "DXB → KRT", airline: "طيران الإمارات", flight: "EK 735", date: "12 أغسطس", time: "08:30 – 10:50", traveler: "MOHAMED AHMED", fare: "اقتصادية · أمتعة 23 كجم" }),
])

export function resolveTripFixtures(fixtureKey) { if (fixtureKey === "empty") return []; if (fixtureKey && fixtureKey !== "default") return null; return SYNTHETIC_TRIP_FIXTURES }
export function buildTripDetailTarget(trip) { const safeTrip = SYNTHETIC_TRIP_FIXTURES.find(({ key }) => key === trip?.key); if (!safeTrip || !MY_TRIPS_SUPPORTED_STATES.includes(safeTrip.bookingState)) return "/account/trips"; return `/flights?view=booking-detail&booking=${encodeURIComponent(safeTrip.key)}&state=${encodeURIComponent(safeTrip.bookingState)}` }
