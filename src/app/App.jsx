import { AppProviders } from "./providers/AppProviders.jsx"
import { AppRouter } from "./router/AppRouter.jsx"
import { createFlightBrowserHttpTransportsV1 } from "../features/flights/api/flightBrowserHttpTransportsV1.js"
import { validatePublicEnvironment } from "../services/contracts/environment.js"
validatePublicEnvironment()
const flightTransports = createFlightBrowserHttpTransportsV1()
export default function App() {
  return <AppProviders
    flightSearchTransport={flightTransports.flightSearchTransport}
    flightRepriceTransport={flightTransports.flightRepriceTransport}
    flightCheckoutTransport={flightTransports.flightCheckoutTransport}
    flightBookingIntentTransport={flightTransports.flightBookingIntentTransport}
    flightPaymentInitiationTransport={flightTransports.flightPaymentInitiationTransport}
  ><AppRouter /></AppProviders>
}
