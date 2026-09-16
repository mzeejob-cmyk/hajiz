/**
 * HAJIZ V2 Button — Figma component set "HAJIZ / Button" (node 12:2).
 * Styles: Primary | Secondary | Ghost.
 * States: default, hover, focus, pressed, disabled, loading.
 * Figma component note: one primary action per section, minimum 48px touch
 * target, no bounce or position shift while loading.
 */
const STYLES = ["primary", "secondary", "ghost"]

export function Button({
  variant = "primary",
  type = "button",
  loading = false,
  disabled = false,
  block = false,
  className = "",
  children,
  ...rest
}) {
  const style = STYLES.includes(variant) ? variant : "primary"
  const classes = [
    "v2-button",
    `v2-button--${style}`,
    block ? "v2-button--block" : "",
    className,
  ].filter(Boolean).join(" ")
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      data-loading={loading ? "true" : "false"}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="v2-spinner" aria-hidden="true" />}
      <span className="v2-button__label">{children}</span>
    </button>
  )
}
