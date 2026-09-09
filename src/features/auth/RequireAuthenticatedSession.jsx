import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuthSession } from "./authSessionContext.js"

export function RequireAuthenticatedSession({ children }) {
  const session = useAuthSession()
  const location = useLocation()
  if (session.status === "checking") return <section role="status">جارٍ التحقق من الجلسة…</section>
  if (session.status === "error") return <section role="alert"><p>تعذر التحقق من الجلسة.</p><button type="button" onClick={session.retry}>إعادة المحاولة</button></section>
  if (session.status === "signed_out") return <Navigate to="/login" replace state={{ returnTo: location.pathname + location.search + location.hash }} />
  if (session.status !== "signed_in") return null
  return children ?? <Outlet />
}
