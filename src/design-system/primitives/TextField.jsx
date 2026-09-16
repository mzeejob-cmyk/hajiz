import { useId } from "react"

/**
 * Labelled text input on the V2 field shell (Figma journey fields, node 15:9).
 * The label is always rendered and associated — never a placeholder-only field.
 */
export function TextField({ label, error = "", className = "", id, ...rest }) {
  const generated = useId()
  const fieldId = id ?? `v2-field-${generated}`
  const errorId = `${fieldId}-error`
  return (
    <div className={`v2-field-shell ${className}`.trim()} data-invalid={error ? "true" : "false"}>
      <label className="v2-field-label" htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        className="v2-field"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error && <span className="v2-field-error" id={errorId} role="alert">{error}</span>}
    </div>
  )
}
