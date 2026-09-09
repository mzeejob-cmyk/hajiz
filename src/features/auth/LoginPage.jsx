import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { authSessionDataSource } from "../../services/authSessionDataSource.js"
import { useAuthSession } from "./authSessionContext.js"
import { normalizeInternalReturnTo } from "./returnTo.js"

export default function LoginPage({ dataSource = authSessionDataSource }) {
  const session = useAuthSession()
  const location = useLocation()
  const navigate = useNavigate()
  const [submitState, setSubmitState] = useState("idle")
  if (session.status === "signed_in") return <main data-auth-state="signed_in"><h1>تسجيل الدخول</h1><p>أنت مسجل الدخول بالفعل.</p><Link to="/account/trips">الانتقال إلى حسابي</Link></main>
  const submit = async event => {
    event.preventDefault()
    if (submitState === "submitting") return
    setSubmitState("submitting")
    const form = event.currentTarget
    const fields = new FormData(form)
    try {
      await dataSource.signIn({ email: fields.get("email"), password: fields.get("password") })
      form.reset()
      setSubmitState("signed_in")
      navigate(normalizeInternalReturnTo(location.state?.returnTo), { replace: true })
    } catch {
      form.reset()
      setSubmitState("error")
    }
  }
  return <main data-auth-state={submitState}><h1>تسجيل الدخول</h1><form onSubmit={submit}><label>البريد الإلكتروني<input name="email" type="email" autoComplete="email" maxLength="254" required /></label><label>كلمة المرور<input name="password" type="password" autoComplete="current-password" maxLength="1024" required /></label><button type="submit" disabled={submitState === "submitting"}>{submitState === "submitting" ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}</button></form>{submitState === "error" && <p role="alert">تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.</p>}<p>إنشاء حساب جديد غير متاح من هذه الواجهة حاليًا.</p></main>
}
