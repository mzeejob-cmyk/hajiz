import { Link } from "react-router-dom"
import { Container } from "../primitives/Container.jsx"

export function RouteLoading() {
  return <Container><div className="route-state" role="status" aria-live="polite"><span className="loader" />جارٍ تحميل الصفحة…</div></Container>
}

export function NotFound() {
  return <Container><section className="route-state route-state--stack"><span className="eyebrow">404</span><h1>الصفحة غير موجودة</h1><p>ربما تغيّر الرابط أو لم تعد الصفحة متاحة.</p><Link className="button" to="/">العودة للرئيسية</Link></section></Container>
}

export function RouteError({ reset }) {
  return <Container><section className="route-state route-state--stack" role="alert"><span className="eyebrow">خطأ</span><h1>تعذّر عرض الصفحة</h1><p>حاول مرة أخرى، أو ارجع إلى الصفحة الرئيسية.</p>{reset ? <button className="button" onClick={reset}>إعادة المحاولة</button> : <Link className="button" to="/">العودة للرئيسية</Link>}</section></Container>
}
