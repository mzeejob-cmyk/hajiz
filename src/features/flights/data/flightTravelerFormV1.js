const readRequired = (read, key) => {
  const value = read(key)
  if (typeof value !== "string") throw new TypeError("traveler form is incomplete")
  return value
}

export function toFlightTravelerDataV1({ read, expectedPassengers }) {
  if (typeof read !== "function" || !expectedPassengers) throw new TypeError("traveler form authority is required")
  const travelers = []
  for (const [type, count] of [["ADT", expectedPassengers.ADT], ["CHD", expectedPassengers.CHD], ["INF", expectedPassengers.INF]]) {
    if (!Number.isInteger(count) || count < 0) throw new TypeError("traveler composition is invalid")
    for (let index = 0; index < count; index += 1) {
      const prefix = `travelers-${type}-${index}`
      travelers.push(Object.freeze({
        travelerKey: readRequired(read, `${prefix}-travelerKey`),
        travelerType: readRequired(read, `${prefix}-travelerType`),
        title: readRequired(read, `${prefix}-title`),
        firstName: readRequired(read, `${prefix}-firstName`),
        middleName: readRequired(read, `${prefix}-middleName`),
        lastName: readRequired(read, `${prefix}-lastName`),
        dateOfBirth: readRequired(read, `${prefix}-dateOfBirth`),
        document: Object.freeze({
          documentType: readRequired(read, `${prefix}-documentType`),
          documentNumber: readRequired(read, `${prefix}-documentNumber`),
          issuingCountry: readRequired(read, `${prefix}-issuingCountry`),
          nationality: readRequired(read, `${prefix}-nationality`),
          expiryDate: readRequired(read, `${prefix}-expiryDate`),
        }),
      }))
    }
  }
  return Object.freeze({
    contractVersion: "flight-travelers/v1",
    travelers: Object.freeze(travelers),
    contact: Object.freeze({
      email: readRequired(read, "contact-email"),
      phoneCountryCode: readRequired(read, "contact-phoneCountryCode"),
      phoneNumber: readRequired(read, "contact-phoneNumber"),
    }),
  })
}
