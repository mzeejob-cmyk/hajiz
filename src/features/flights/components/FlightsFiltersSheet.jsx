import { useEffect, useRef } from "react"
import { FlightsFilters } from "./FlightsFilters.jsx"
export function FlightsFiltersSheet({ open, onClose, selected, onChange, onClear }) {
  const closeRef = useRef(null)
  useEffect(() => { if (!open) return; closeRef.current?.focus(); const key = event => event.key === "Escape" && onClose(); document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key) }, [open, onClose])
  if (!open) return null
  return <div className="filters-overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="filters-sheet" role="dialog" aria-modal="true" aria-labelledby="filters-sheet-title"><div className="sheet-grabber"/><button ref={closeRef} className="sheet-close" type="button" onClick={onClose} aria-label="إغلاق الفلاتر">×</button><div id="filters-sheet-title" className="visually-hidden">تصفية الرحلات</div><FlightsFilters mobile selected={selected} onChange={onChange} onClear={onClear}/><button className="show-results" type="button" onClick={onClose}>عرض 48 نتيجة</button></section></div>
}
