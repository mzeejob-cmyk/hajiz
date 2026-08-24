import { AppProviders } from "./providers/AppProviders.jsx"
import { AppRouter } from "./router/AppRouter.jsx"
import { validatePublicEnvironment } from "../services/contracts/environment.js"
validatePublicEnvironment()
export default function App() { return <AppProviders><AppRouter /></AppProviders> }
