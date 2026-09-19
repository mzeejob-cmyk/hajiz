/**
 * Hotels capability note — Figma node 18:4.
 *
 * Wording is taken verbatim from nodes 18:5 and 18:6. Hotels are a
 * Fixture / Offline / Sandbox boundary: search, detail, rates and reprice are
 * the read boundary, and every transactional capability beyond it stays
 * disabled in H2. This note states that plainly and is rendered on every
 * hotel screen so the experience can never be mistaken for a live
 * transactional marketplace.
 */
export function HotelSandboxNotice() {
  return (
    <aside className="hotels-v2__capability v2-no-motion" data-hotel-sandbox="true" aria-label="حدود القدرة الحالية">
      <p className="hotels-v2__capability-title">نموذج واجهة احترافي — الفنادق ما زالت ضمن Fixture / Offline / Sandbox boundary</p>
      <p className="hotels-v2__capability-note">الحجز الحي، حجز الغرفة، والدفع للمورد غير مفعّلة في H2 حاليًا.</p>
    </aside>
  )
}
