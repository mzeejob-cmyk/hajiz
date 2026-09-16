/** Placeholder shell shown while content loads. Always hidden from AT. */
export function Skeleton({ variant = "text", width, height, className = "", style }) {
  return (
    <span
      className={`v2-skeleton v2-skeleton--${variant === "block" ? "block" : "text"} ${className}`.trim()}
      style={{ inlineSize: width, blockSize: height, ...style }}
      aria-hidden="true"
    />
  )
}
