import { BrowserRouter } from "react-router-dom"
import { AppErrorBoundary } from "./AppErrorBoundary.jsx"
import { FlightSearchClientProvider } from "../../features/flights/api/FlightSearchClientContext.jsx"

export function AppProviders({ children, flightSearchTransport }) {
  return <BrowserRouter><AppErrorBoundary><FlightSearchClientProvider transport={flightSearchTransport}>{children}</FlightSearchClientProvider></AppErrorBoundary></BrowserRouter>
}
