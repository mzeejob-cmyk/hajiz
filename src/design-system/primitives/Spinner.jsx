/** Loading indicator. Decorative by default; pass a label to announce it. */
export function Spinner({ label = "", className = "" }) {
  return (
    <span className={`v2-spinner ${className}`.trim()} role={label ? "status" : undefined} aria-hidden={label ? undefined : "true"}>
      {label && <span className="v2-visually-hidden">{label}</span>}
    </span>
  )
}
