/**
 * Status presentation foundation. Tones map to the Figma status tokens read
 * from node 17:88. This component renders a caller-supplied label only: it
 * does not interpret, derive or infer any payment or booking state.
 */
const TONES = ["neutral", "info", "success", "warning", "error"]

export function StatusBadge({ tone = "neutral", label, className = "", ...rest }) {
  const resolved = TONES.includes(tone) ? tone : "neutral"
  return (
    <span
      className={`v2-badge v2-status-badge--${resolved} ${className}`.trim()}
      data-tone={resolved}
      {...rest}
    >
      {label}
    </span>
  )
}
