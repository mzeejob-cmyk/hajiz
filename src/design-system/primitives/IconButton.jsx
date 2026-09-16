/** Icon-only action. Requires an accessible label; the glyph is decorative. */
export function IconButton({ label, type = "button", className = "", children, ...rest }) {
  return (
    <button type={type} className={`v2-icon-button ${className}`.trim()} aria-label={label} {...rest}>
      <span aria-hidden="true">{children}</span>
    </button>
  )
}
