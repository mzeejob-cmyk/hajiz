import { createContext, useContext } from "react"
export const FlightCheckoutClientContext = createContext(null)
export const useFlightCheckoutClientV1 = () => useContext(FlightCheckoutClientContext)
