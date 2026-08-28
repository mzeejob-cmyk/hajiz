export const CUSTOMER_CURRENCIES = Object.freeze(["USD", "AED", "SDG"])
export const CABIN_CLASSES = Object.freeze(["economy", "premium_economy", "business", "first"])

const calendarDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
const count = (value, fallback) => value === null || value === undefined || value === "" ? fallback : Number(value)

export function mapFlightSearchRequestV1(form) {
  const tripType = form.tripType === "round" || form.tripType === "round_trip" ? "round_trip" : form.tripType === "oneway" || form.tripType === "one_way" ? "one_way" : null
  const request = {
    tripType,
    origin: typeof form.from === "string" ? form.from.toUpperCase() : "",
    destination: typeof form.to === "string" ? form.to.toUpperCase() : "",
    departureDate: form.departure,
    returnDate: tripType === "one_way" ? null : form.returnDate,
    adults: count(form.adults ?? form.travelers, 1), children: count(form.children, 0), infants: count(form.infants, 0),
    cabinClass: form.cabinClass ?? "economy", customerCurrency: form.currency ?? form.customerCurrency ?? "AED",
  }
  if (!tripType || !/^[A-Z]{3}$/.test(request.origin) || !/^[A-Z]{3}$/.test(request.destination) || request.origin === request.destination || !calendarDate(request.departureDate) || (tripType === "round_trip" && (!calendarDate(request.returnDate) || request.returnDate < request.departureDate)) || !Number.isInteger(request.adults) || request.adults < 1 || !Number.isInteger(request.children) || request.children < 0 || !Number.isInteger(request.infants) || request.infants < 0 || !CABIN_CLASSES.includes(request.cabinClass) || !CUSTOMER_CURRENCIES.includes(request.customerCurrency)) throw new TypeError("flight search input is invalid")
  return Object.freeze(request)
}
