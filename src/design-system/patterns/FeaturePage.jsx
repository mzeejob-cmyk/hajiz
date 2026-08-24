import { Container } from "../primitives/Container.jsx"

export function FeaturePage({ eyebrow, title, description, children }) {
  return <><section className="page-hero"><Container><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></Container></section><Container><section className="placeholder-panel">{children || <><span className="placeholder-icon">✦</span><h2>مساحة الميزة جاهزة</h2><p>سيُبنى هذا المسار في المهمة التالية باستخدام بيانات اصطناعية وعقود واجهة آمنة.</p></>}</section></Container></>
}
