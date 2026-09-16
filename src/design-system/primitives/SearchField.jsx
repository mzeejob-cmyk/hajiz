import { useId } from "react"

/** Search control foundation. Presentation only; submission is the caller's. */
export function SearchField({ label, className = "", id, children, ...rest }) {
  const generated = useId()
  const fieldId = id ?? `v2-search-${generated}`
  return (
    <div className={`v2-search ${className}`.trim()} role="search">
      <label className="v2-field-label" htmlFor={fieldId}>{label}</label>
      <input id={fieldId} type="search" className="v2-search-input" {...rest} />
      {children}
    </div>
  )
}
