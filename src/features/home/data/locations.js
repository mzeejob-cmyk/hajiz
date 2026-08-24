export const DUBAI = Object.freeze({ label: "دبي", code: "DXB" })
export const KHARTOUM = Object.freeze({ label: "الخرطوم", code: "KRT" })

export const DEFAULT_FLIGHT_LOCATIONS = Object.freeze({
  from: DUBAI,
  to: KHARTOUM,
})

export const createCustomLocation = label => ({ label, code: "" })
export const locationSearchValue = location => location.code || location.label
