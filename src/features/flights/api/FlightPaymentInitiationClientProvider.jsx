import { useMemo } from "react"
import { createFlightPaymentInitiationClientV1 } from "./flightPaymentInitiationClientV1.js"
import { FlightPaymentInitiationClientContext } from "./flightPaymentInitiationClientContext.js"

export function FlightPaymentInitiationClientProvider({ transport, children }) {
  const client = useMemo(() => transport ? createFlightPaymentInitiationClientV1({ transport }) : null, [transport])
  return <FlightPaymentInitiationClientContext.Provider value={client}>{children}</FlightPaymentInitiationClientContext.Provider>
}
