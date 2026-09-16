/**
 * HAJIZ V2 trust strip - Figma node 16:2.
 * Wording is taken verbatim from nodes 16:4/16:5, 16:7/16:8, 16:10/16:11 and
 * 16:13/16:14. These are brand value statements only. Nothing here asserts a
 * technical capability, and nothing may be added that current product truth
 * does not already support - the suite in scripts/home-v2-tests.mjs fails
 * this file if a capability claim appears in it.
 */
const TRUST_VALUES = Object.freeze([
  { id: "connected", title: "متصل بالعالم", text: "رحلة واحدة، كل التفاصيل" },
  { id: "trusted", title: "موثوق بأمان", text: "صلاحيات واضحة وبيانات محمية" },
  { id: "fast", title: "سريع وسهل", text: "خطوات أقل وقرارات أوضح" },
  { id: "services", title: "كل خدمات السفر", text: "رحلات وفنادق وتجارب" },
])

export function TrustStrip() {
  return (
    <section className="home-trust-strip" data-home-trust="v2" aria-label="قيم حاجز">
      <div className="home-trust-strip__inner">
        {TRUST_VALUES.map(value => (
          <div className="home-trust-strip__item" key={value.id} data-trust-value={value.id}>
            <h2 className="home-trust-strip__title">{value.title}</h2>
            <p className="home-trust-strip__text">{value.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
