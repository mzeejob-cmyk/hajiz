import { useMemo } from "react"
import { createFlightSearchClientV1 } from "./flightSearchClientV1.js"
import { FlightSearchClientContext } from "./flightSearchClientContext.js"

export function FlightSearchClientProvider({ transport, children }) {
  const client = useMemo(() => transport ? createFlightSearchClientV1({ transport }) : null, [transport])
  return <FlightSearchClientContext.Provider value={client}>{children}</FlightSearchClientContext.Provider>
}
