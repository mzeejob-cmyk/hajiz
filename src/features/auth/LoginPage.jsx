import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { authSessionDataSource } from "../../services/authSessionDataSource.js"
import { useAuthSession } from "./authSessionContext.js"
import { normalizeInternalReturnTo } from "./returnTo.js"

/**
 * HAJIZ V2 login — Figma nodes 19:3 to 19:14.
 *
 * Presentation migration only. Sign-in still goes through the existing
 * authSessionDataSource, which reuses the shared account session client; no
 * second client, no browser storage, no custom token handling. The returnTo
 * target is still normalised to an internal path before any navigation.
 *
 * Node 19:14 states plainly that signup, password recovery, OTP and OAuth are
 * future surfaces. They are rendered as static text: no link, no button, and
 * nothing that could look like a working control.
 */
export default function LoginPage({ dataSource = authSessionDataSource }) {
  const session = useAuthSession()
  const location = useLocation()
  const navigate = useNavigate()
  const [submitState, setSubmitState] = useState("idle")
  if (session.status === "signed_in") return <main className="auth-v2" data-auth-state="signed_in"><section className="auth-v2__card"><h1 className="auth-v2__title">تسجيل الدخول</h1><p className="auth-v2__lede">أنت مسجل الدخول بالفعل.</p><Link className="v2-button v2-button--primary auth-v2__action" to="/account/trips">الانتقال إلى حسابي</Link></section></main>
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
  return <main className="auth-v2" data-auth-state={submitState}>
    <section className="auth-v2__card">
      <h1 className="auth-v2__title">مرحبًا بعودتك</h1>
      <p className="auth-v2__lede">رحلاتك ومستنداتك في مكان واحد.</p>
      <form className="auth-v2__form" onSubmit={submit}>
        <label className="auth-v2__field"><span className="auth-v2__label">البريد الإلكتروني</span><input className="auth-v2__input auth-v2__input--latin" name="email" type="email" dir="ltr" autoComplete="email" maxLength="254" required /></label>
        <label className="auth-v2__field"><span className="auth-v2__label">كلمة المرور</span><input className="auth-v2__input auth-v2__input--latin" name="password" type="password" dir="ltr" autoComplete="current-password" maxLength="1024" required /></label>
        <button className="auth-v2__action" type="submit" aria-busy={submitState === "submitting" || undefined} disabled={submitState === "submitting"}>{submitState === "submitting" ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}</button>
      </form>
      {submitState === "error" && <p className="auth-v2__error v2-no-motion" role="alert">تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.</p>}
      <p className="auth-v2__note v2-no-motion">الإنشاء واستعادة كلمة المرور وOTP وOAuth: أسطح مستقبلية غير مفعّلة</p>
      <p className="auth-v2__note v2-no-motion">إنشاء حساب جديد غير متاح من هذه الواجهة حاليًا.</p>
    </section>
  </main>
}
