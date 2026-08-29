import { useMemo } from "react"
import { createFlightCheckoutClientV1 } from "./flightCheckoutClientV1.js"
import { FlightCheckoutClientContext } from "./flightCheckoutClientContext.js"
export function FlightCheckoutClientProvider({ transport, children }) { const client = useMemo(() => transport ? createFlightCheckoutClientV1({ transport }) : null, [transport]); return <FlightCheckoutClientContext.Provider value={client}>{children}</FlightCheckoutClientContext.Provider> }
