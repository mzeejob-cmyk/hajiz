import { Navigate, NavLink, Route, Routes } from "react-router-dom"
import { Container } from "../../design-system/primitives/Container.jsx"
import { MyTripsPage } from "./components/MyTripsPage.jsx"
import { FavoritesFoundation, ProfileFoundation, TravelersFoundation } from "./components/AccountOverview.jsx"
import { AccountCapabilities } from "./components/AccountCapabilities.jsx"
import { ACCOUNT_SECTIONS } from "./data/accountPresentation.js"

/**
 * HAJIZ V2 account shell — Figma nodes 19:15 to 19:26.
 *
 * Shell presentation only. Every section route is unchanged, My Trips is
 * mounted exactly as Execution 07 left it, and no data authority is touched
 * here. Personal data stays out of the URL and out of browser storage.
 */
export default function AccountPage() {
  const sectionClass = ({ isActive }) => `account-v2__nav-link${isActive ? " account-v2__nav-link--active" : ""}`
  return <div className="account-foundation account-v2" dir="rtl" data-privacy="no-url-or-browser-storage"><Container className="account-v2__layout">
    <aside className="account-v2__nav" aria-label="أقسام الحساب">
      <strong className="account-v2__nav-title">حسابي</strong>
      <p className="account-v2__nav-note">بيانات العميل الموثوقة فقط</p>
      {ACCOUNT_SECTIONS.map(item => <NavLink className={sectionClass} key={item.id} to={item.path} data-contract-state={item.state}>{item.label}</NavLink>)}
      <AccountCapabilities/>
    </aside>
    <main className="account-v2__main">
      <Routes>
        <Route index element={<Navigate to="trips" replace />} />
        <Route path="trips" element={<MyTripsPage />} />
        <Route path="profile" element={<ProfileFoundation />} />
        <Route path="travelers" element={<TravelersFoundation />} />
        <Route path="favorites" element={<FavoritesFoundation />} />
        <Route path="*" element={<Navigate to="trips" replace />} />
      </Routes>
    </main>
  </Container></div>
}
