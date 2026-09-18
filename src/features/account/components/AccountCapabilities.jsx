/**
 * Account capability notes — Figma nodes 19:27 to 19:32.
 *
 * Both entries are rendered as static text, never as controls.
 *
 * Currency: node 19:29 reads "العربية · AED", but the P2 preference contract
 * stores locale only. Persisting a currency choice, or presenting AED as a
 * saved account preference, would invent a contract that does not exist, so
 * the capability is stated as not configurable and the language preference is
 * left where it actually works — the favorites/preferences surface.
 *
 * Notifications: node 19:32 already states the truth, and there is no
 * delivery provider, worker, scheduler or customer settings authority behind
 * it. Nothing here toggles, saves or schedules anything.
 */
const CAPABILITY_NOTES = Object.freeze([
  { id: "currency", title: "اللغة والعملة", note: "تفضيل اللغة يُحفظ للحساب. تفضيل العملة غير قابل للضبط في هذه المرحلة." },
  { id: "notifications", title: "الإشعارات", note: "المزوّد غير مهيأ بالكامل" },
])

export function AccountCapabilities() {
  return (
    <section className="account-v2__capabilities" data-account-capabilities="preview" aria-labelledby="account-capabilities-title">
      <h2 className="account-v2__capabilities-title" id="account-capabilities-title">قدرات غير مفعّلة بعد</h2>
      {CAPABILITY_NOTES.map(item => (
        <div className="account-v2__capability" key={item.id} data-capability={item.id}>
          <h3 className="account-v2__capability-title">{item.title}</h3>
          <p className="account-v2__capability-note">{item.note}</p>
        </div>
      ))}
    </section>
  )
}
