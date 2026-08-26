import { Navigate, Route, Routes } from "react-router-dom"
import { MyTripsPage } from "./components/MyTripsPage.jsx"

export default function AccountPage() { return <Routes><Route index element={<Navigate to="trips" replace />} /><Route path="trips" element={<MyTripsPage />} /><Route path="*" element={<Navigate to="trips" replace />} /></Routes> }
