import { useMemo } from "react"
import { createFlightBookingIntentClientV1 } from "./flightBookingIntentClientV1.js"
import { FlightBookingIntentClientContext } from "./flightBookingIntentClientContext.js"
export function FlightBookingIntentClientProvider({ transport, children }) { const client = useMemo(() => transport ? createFlightBookingIntentClientV1({ transport }) : null, [transport]); return <FlightBookingIntentClientContext.Provider value={client}>{children}</FlightBookingIntentClientContext.Provider> }
