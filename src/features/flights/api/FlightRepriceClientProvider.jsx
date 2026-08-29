import { useMemo } from "react"
import { createFlightRepriceClientV1 } from "./flightRepriceClientV1.js"
import { FlightRepriceClientContext } from "./flightRepriceClientContext.js"
export function FlightRepriceClientProvider({ transport, children }) {
  const client = useMemo(() => transport ? createFlightRepriceClientV1({ transport }) : null, [transport])
  return <FlightRepriceClientContext.Provider value={client}>{children}</FlightRepriceClientContext.Provider>
}
