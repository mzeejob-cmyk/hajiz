import { Navigate, NavLink, Route, Routes } from "react-router-dom"
import { MyTripsPage } from "./components/MyTripsPage.jsx"
import { FavoritesFoundation, ProfileFoundation, TravelersFoundation } from "./components/AccountOverview.jsx"
import { ACCOUNT_SECTIONS } from "./data/accountPresentation.js"

export default function AccountPage() { return <div className="account-foundation" dir="rtl" data-privacy="no-url-or-browser-storage"><aside aria-label="أقسام الحساب"><strong>حسابي</strong>{ACCOUNT_SECTIONS.map(item => <NavLink key={item.id} to={item.path} data-contract-state={item.state}>{item.label}</NavLink>)}</aside><main><Routes><Route index element={<Navigate to="trips" replace />} /><Route path="trips" element={<MyTripsPage />} /><Route path="profile" element={<ProfileFoundation />} /><Route path="travelers" element={<TravelersFoundation />} /><Route path="favorites" element={<FavoritesFoundation />} /><Route path="*" element={<Navigate to="trips" replace />} /></Routes></main></div> }
