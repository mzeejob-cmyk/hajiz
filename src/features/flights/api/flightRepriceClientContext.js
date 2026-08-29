import { createContext, useContext } from "react"
export const FlightRepriceClientContext = createContext(null)
export const useFlightRepriceClientV1 = () => useContext(FlightRepriceClientContext)
