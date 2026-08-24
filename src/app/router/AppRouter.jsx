import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router-dom"
import { AppShell } from "../layouts/AppShell.jsx"
import { RouteLoading, NotFound } from "../../design-system/patterns/RouteState.jsx"

const HomePage = lazy(() => import("../../features/home/HomePage.jsx"))
const FlightsPage = lazy(() => import("../../features/flights/FlightsPage.jsx"))
const HotelsPage = lazy(() => import("../../features/hotels/HotelsPage.jsx"))
const InsurancePage = lazy(() => import("../../features/insurance/InsurancePage.jsx"))
const PackagesPage = lazy(() => import("../../features/packages/PackagesPage.jsx"))
const OffersPage = lazy(() => import("../../features/offers/OffersPage.jsx"))
const CheckoutPage = lazy(() => import("../../features/checkout/CheckoutPage.jsx"))
const BookingPage = lazy(() => import("../../features/bookings/BookingPage.jsx"))
const AccountPage = lazy(() => import("../../features/account/AccountPage.jsx"))
const PartnersPage = lazy(() => import("../../features/partners/PartnersPage.jsx"))
const AdminPage = lazy(() => import("../../features/admin/AdminPage.jsx"))

export function AppRouter() { return <Suspense fallback={<RouteLoading />}><Routes><Route element={<AppShell />}><Route index element={<HomePage />} /><Route path="flights" element={<FlightsPage />} /><Route path="hotels" element={<HotelsPage />} /><Route path="insurance" element={<InsurancePage />} /><Route path="packages" element={<PackagesPage />} /><Route path="offers" element={<OffersPage />} /><Route path="checkout/*" element={<CheckoutPage />} /><Route path="bookings/:reference" element={<BookingPage />} /><Route path="account/*" element={<AccountPage />} /><Route path="partners/*" element={<PartnersPage />} /><Route path="admin/*" element={<AdminPage />} /><Route path="*" element={<NotFound />} /></Route></Routes></Suspense> }
