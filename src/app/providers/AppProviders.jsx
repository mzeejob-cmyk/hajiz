import { BrowserRouter } from "react-router-dom"
import { AppErrorBoundary } from "./AppErrorBoundary.jsx"
import { FlightSearchClientProvider } from "../../features/flights/api/FlightSearchClientContext.jsx"
import { FlightRepriceClientProvider } from "../../features/flights/api/FlightRepriceClientProvider.jsx"

export function AppProviders({ children, flightSearchTransport, flightRepriceTransport }) {
  return <BrowserRouter><AppErrorBoundary><FlightSearchClientProvider transport={flightSearchTransport}><FlightRepriceClientProvider transport={flightRepriceTransport}>{children}</FlightRepriceClientProvider></FlightSearchClientProvider></AppErrorBoundary></BrowserRouter>
}
