import { createContext, useContext } from "react"

export const FlightPaymentInitiationClientContext = createContext(null)
export const useFlightPaymentInitiationClientV1 = () => useContext(FlightPaymentInitiationClientContext)
