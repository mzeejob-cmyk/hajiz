/** Small non-interactive label. `accent` matches the Figma editorial eyebrow. */
export function Badge({ accent = false, className = "", children, ...rest }) {
  return (
    <span className={`v2-badge${accent ? " v2-badge--accent" : ""} ${className}`.trim()} {...rest}>
      {children}
    </span>
  )
}
