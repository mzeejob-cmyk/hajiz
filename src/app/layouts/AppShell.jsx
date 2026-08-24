import { useEffect, useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { Container } from "../../design-system/primitives/Container.jsx"
import { PRIMARY_NAVIGATION } from "../../services/contracts/navigation.js"

const navClass = ({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`

export function AppShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { document.documentElement.lang = "ar"; document.documentElement.dir = "rtl" }, [])
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">تجاوز إلى المحتوى</a>
    <header className="site-header">
      <Container className="header-inner">
        <NavLink className="brand" to="/" aria-label="حاجز — الرئيسية"><span className="brand-mark">ح</span><span>حاجز</span></NavLink>
        <nav className="desktop-nav" aria-label="التنقل الرئيسي">{PRIMARY_NAVIGATION.map(item => <NavLink key={item.id} className={navClass} to={item.to}>{item.label}</NavLink>)}</nav>
        <div className="header-actions">
          <NavLink className="account-link" to="/account">حسابي</NavLink>
          <button className="menu-button" type="button" aria-label="فتح قائمة التنقل" aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(open => !open)}><span /><span /><span /></button>
        </div>
      </Container>
      <nav id="mobile-navigation" className={`mobile-nav${mobileOpen ? " mobile-nav--open" : ""}`} aria-label="التنقل عبر الهاتف" hidden={!mobileOpen}>
        <Container>{PRIMARY_NAVIGATION.map(item => <NavLink key={item.id} className={navClass} to={item.to} onClick={() => setMobileOpen(false)}>{item.label}</NavLink>)}</Container>
      </nav>
    </header>
    <main id="main-content" tabIndex="-1">{children ?? <Outlet />}</main>
    <footer className="site-footer"><Container className="footer-grid"><div><div className="brand brand--footer"><span className="brand-mark">ح</span><span>حاجز</span></div><p>واجهة V1 تجريبية للبحث والتخطيط لرحلتك.</p></div><div><h2>خدمات V1</h2><div className="footer-links">{PRIMARY_NAVIGATION.slice(1).map(item => <NavLink key={item.id} to={item.to}>{item.label}</NavLink>)}</div></div><div><h2>روابط</h2><div className="footer-links"><NavLink to="/account">الحساب</NavLink><NavLink to="/bookings/demo-reference">متابعة حجز</NavLink></div></div></Container><Container><p className="copyright">© <span className="latin-text" dir="ltr">2026</span> حاجز. بيئة واجهة معزولة.</p></Container></footer>
  </div>
}
