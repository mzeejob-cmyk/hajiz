import { useId } from "react"

/**
 * Select-like trigger: a labelled button that opens a chooser elsewhere.
 * Presentation only — it owns no option list and no business behaviour.
 */
export function SelectTrigger({ label, value, className = "", id, ...rest }) {
  const generated = useId()
  const triggerId = id ?? `v2-select-${generated}`
  const labelId = `${triggerId}-label`
  return (
    <div className={`v2-field-shell ${className}`.trim()}>
      <span className="v2-field-label" id={labelId}>{label}</span>
      <button
        type="button"
        id={triggerId}
        className="v2-select-trigger"
        aria-labelledby={`${labelId} ${triggerId}`}
        aria-haspopup="listbox"
        {...rest}
      >
        <span>{value}</span>
      </button>
    </div>
  )
}
