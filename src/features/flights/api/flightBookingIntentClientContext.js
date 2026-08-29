import { createContext, useContext } from "react"
export const FlightBookingIntentClientContext = createContext(null)
export const useFlightBookingIntentClientV1 = () => useContext(FlightBookingIntentClientContext)
