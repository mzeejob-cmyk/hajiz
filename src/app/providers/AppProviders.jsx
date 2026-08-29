import { BrowserRouter } from "react-router-dom"
import { AppErrorBoundary } from "./AppErrorBoundary.jsx"
import { FlightSearchClientProvider } from "../../features/flights/api/FlightSearchClientContext.jsx"
import { FlightRepriceClientProvider } from "../../features/flights/api/FlightRepriceClientProvider.jsx"
import { FlightCheckoutClientProvider } from "../../features/flights/api/FlightCheckoutClientProvider.jsx"

export function AppProviders({ children, flightSearchTransport, flightRepriceTransport, flightCheckoutTransport }) {
  return <BrowserRouter><AppErrorBoundary><FlightSearchClientProvider transport={flightSearchTransport}><FlightRepriceClientProvider transport={flightRepriceTransport}><FlightCheckoutClientProvider transport={flightCheckoutTransport}>{children}</FlightCheckoutClientProvider></FlightRepriceClientProvider></FlightSearchClientProvider></AppErrorBoundary></BrowserRouter>
}
