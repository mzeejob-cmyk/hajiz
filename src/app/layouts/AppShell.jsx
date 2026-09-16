import { useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { Container } from "../../design-system/primitives/Container.jsx"
import { NetworkMark } from "../../design-system/primitives/NetworkMark.jsx"
import { useDirection } from "../../design-system/direction/directionContext.js"
import { PRIMARY_NAVIGATION } from "../../services/contracts/navigation.js"
import { useAuthSession } from "../../features/auth/authSessionContext.js"

/**
 * HAJIZ V2 global shell.
 *
 * Desktop header follows Figma node 14:25 - brand, primary navigation,
 * utilities - at 88px. Mobile header follows node 16:35 at 68px with the menu
 * affordance, centred brand and login entry.
 *
 * Routing is unchanged: navigation still renders PRIMARY_NAVIGATION through
 * NavLink and the shell still renders <Outlet />. Nothing here is mocked.
 *
 * The canonical V2 Home frames contain no footer, so the existing footer
 * structure is preserved and only re-skinned onto V2 tokens.
 */

const navClass = ({ isActive }) =>
  `nav-link v2-nav__link${isActive ? " nav-link--active v2-nav__link--active" : ""}`

export function AppShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const session = useAuthSession()
  const { locale, toggleLocale, next } = useDirection()

  const accountLink = session.status === "signed_in"
    ? <NavLink className="v2-utilities__item" to="/account/trips">حسابي</NavLink>
    : session.status === "signed_out"
      ? <NavLink className="v2-utilities__item" to="/login">تسجيل الدخول</NavLink>
      : <span className="v2-utilities__item" aria-live="polite">الحساب</span>

  const tripsLink = session.status === "signed_in"
    ? <NavLink className="v2-utilities__item desktop-only" to="/account/trips">رحلاتي</NavLink>
    : null

  const languageControl = (
    <button
      type="button"
      className="v2-utilities__item"
      onClick={toggleLocale}
      lang={next.code}
      aria-label={`Switch to ${next.label}`}
    >
      {locale.label}
      <span className="v2-brand__latin" dir="ltr"> · AED</span>
    </button>
  )

  const navigationItems = PRIMARY_NAVIGATION.slice(1)

  return (
    <div className="app-shell v2-shell" data-locale={locale.code}>
      <a className="skip-link" href="#main-content">تجاوز إلى المحتوى</a>

      <header className="site-header v2-header">
        <Container className="header-inner v2-header__inner">
          <NavLink className="brand v2-brand" to="/" aria-label="حاجز — الرئيسية">
            <NetworkMark size="sm" animated={false} className="v2-brand__mark" />
            <span className="v2-brand__word">حاجز</span>
            <span className="brand-latin v2-brand__latin" dir="ltr">HAJIZ</span>
          </NavLink>

          <nav className="desktop-nav v2-nav" aria-label="التنقل الرئيسي">
            {navigationItems.map(item => (
              <NavLink key={item.id} className={navClass} to={item.to}>{item.label}</NavLink>
            ))}
          </nav>

          <div className="header-utilities v2-utilities">
            {tripsLink}
            {languageControl}
            {accountLink}
          </div>

          <button
            className="menu-button v2-menu-button"
            type="button"
            aria-label="فتح قائمة التنقل"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen(open => !open)}
          >
            <span className="v2-menu-button__glyph" aria-hidden="true">☰</span>
          </button>
        </Container>

        <nav
          id="mobile-navigation"
          className={`mobile-nav v2-mobile-nav${mobileOpen ? " mobile-nav--open" : ""}`}
          aria-label="التنقل عبر الهاتف"
          hidden={!mobileOpen}
        >
          {navigationItems.map(item => (
            <NavLink key={item.id} className={navClass} to={item.to} onClick={() => setMobileOpen(false)}>
              {item.label}
            </NavLink>
          ))}
          {accountLink}
        </nav>
      </header>

      <main id="main-content" className="v2-shell__main" tabIndex="-1">
        {children ?? <Outlet />}
      </main>

      <footer className="site-footer v2-footer">
        <Container className="simple-footer v2-footer__inner">
          <div className="brand brand--footer v2-brand">
            <span className="v2-brand__word">حاجز</span>
            <span className="brand-latin v2-brand__latin" dir="ltr">HAJIZ</span>
          </div>
          <nav className="v2-footer__nav" aria-label="روابط التذييل">
            {navigationItems.map(item => (
              <NavLink key={item.id} to={item.to}>{item.label}</NavLink>
            ))}
          </nav>
          <p className="v2-footer__tagline">السفر أقرب ليك.</p>
        </Container>
      </footer>
    </div>
  )
}
