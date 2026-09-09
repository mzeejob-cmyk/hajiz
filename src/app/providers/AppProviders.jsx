import { BrowserRouter } from "react-router-dom"
import { AppErrorBoundary } from "./AppErrorBoundary.jsx"
import { FlightSearchClientProvider } from "../../features/flights/api/FlightSearchClientContext.jsx"
import { FlightRepriceClientProvider } from "../../features/flights/api/FlightRepriceClientProvider.jsx"
import { FlightCheckoutClientProvider } from "../../features/flights/api/FlightCheckoutClientProvider.jsx"
import { FlightBookingIntentClientProvider } from "../../features/flights/api/FlightBookingIntentClientProvider.jsx"
import { FlightPaymentInitiationClientProvider } from "../../features/flights/api/FlightPaymentInitiationClientProvider.jsx"
import { AuthSessionProvider } from "../../features/auth/AuthSessionProvider.jsx"

export function AppProviders({ children, authDataSource, flightSearchTransport, flightRepriceTransport, flightCheckoutTransport, flightBookingIntentTransport, flightPaymentInitiationTransport }) {
  return <BrowserRouter><AppErrorBoundary><AuthSessionProvider dataSource={authDataSource}><FlightSearchClientProvider transport={flightSearchTransport}><FlightRepriceClientProvider transport={flightRepriceTransport}><FlightCheckoutClientProvider transport={flightCheckoutTransport}><FlightBookingIntentClientProvider transport={flightBookingIntentTransport}><FlightPaymentInitiationClientProvider transport={flightPaymentInitiationTransport}>{children}</FlightPaymentInitiationClientProvider></FlightBookingIntentClientProvider></FlightCheckoutClientProvider></FlightRepriceClientProvider></FlightSearchClientProvider></AuthSessionProvider></AppErrorBoundary></BrowserRouter>
}
