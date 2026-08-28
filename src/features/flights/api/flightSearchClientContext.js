import { createContext, useContext } from "react"

export const FlightSearchClientContext = createContext(null)
export const useFlightSearchClientV1 = () => useContext(FlightSearchClientContext)
