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
        <NavLink className="brand" to="/" aria-label="حاجز — الرئيسية"><span className="brand-latin" dir="ltr">HAJIZ</span><span>حاجز</span></NavLink>
        <nav className="desktop-nav" aria-label="التنقل الرئيسي">{PRIMARY_NAVIGATION.slice(1).map(item => <NavLink key={item.id} className={navClass} to={item.to}>{item.label}</NavLink>)}</nav>
        <div className="header-utilities"><span className="latin-text" dir="ltr">AED</span><button type="button">العربية</button><NavLink to="/bookings/demo-reference">حجوزاتي</NavLink></div>
        <button className="menu-button" type="button" aria-label="فتح قائمة التنقل" aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(open => !open)}><span/><span/><span/></button>
      </Container>
      <nav id="mobile-navigation" className={`mobile-nav${mobileOpen ? " mobile-nav--open" : ""}`} aria-label="التنقل عبر الهاتف" hidden={!mobileOpen}><Container>{PRIMARY_NAVIGATION.slice(1).map(item => <NavLink key={item.id} className={navClass} to={item.to} onClick={() => setMobileOpen(false)}>{item.label}</NavLink>)}</Container></nav>
    </header>
    <main id="main-content" tabIndex="-1">{children ?? <Outlet />}</main>
    <footer className="site-footer"><Container className="simple-footer"><div className="brand brand--footer"><span className="brand-latin" dir="ltr">HAJIZ</span><span>حاجز</span></div><nav aria-label="روابط التذييل">{PRIMARY_NAVIGATION.slice(1).map((item, index) => <span key={item.id}><NavLink to={item.to}>{item.label}</NavLink>{index < PRIMARY_NAVIGATION.length - 2 && " · "}</span>)}</nav><p>السفر أقرب ليك.</p></Container></footer>
  </div>
}
