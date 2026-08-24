import { FILTER_GROUPS } from "../data/filterGroups.js"

export function FlightsFilters({ selected, onChange, onClear, mobile = false }) {
  const toggle = option => onChange(selected.includes(option) ? selected.filter(item => item !== option) : [...selected, option])
  return <div className={`flights-filters${mobile ? " flights-filters--mobile" : ""}`}><div className="filters-heading"><h2>{mobile ? "تصفية الرحلات" : "تصفية النتائج"}</h2><button type="button" onClick={onClear}>مسح الكل</button></div>{FILTER_GROUPS.map(group => <fieldset className={group.desktopOnly && mobile ? "desktop-only" : ""} key={group.title}><legend>{group.title}</legend>{group.options.map(option => <label className="filter-check" key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)}/><span>{option}</span></label>)}</fieldset>)}{!mobile && <div className="price-range"><strong>نطاق السعر</strong><input type="range" min="700" max="2500" defaultValue="2500" aria-label="نطاق السعر"/><span dir="ltr">AED 700 — 2,500</span></div>}</div>
}
