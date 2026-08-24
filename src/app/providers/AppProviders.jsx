import { BrowserRouter } from "react-router-dom"
import { AppErrorBoundary } from "./AppErrorBoundary.jsx"

export function AppProviders({ children }) {
  return <BrowserRouter><AppErrorBoundary>{children}</AppErrorBoundary></BrowserRouter>
}
