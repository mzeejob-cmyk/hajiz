/**
 * Brand geometry: origin node -> journey line -> destination node.
 * Geometry from Figma nodes 14:45-14:48 (desktop) and 16:45-16:48 (mobile).
 * Motion keyframes are transcribed in design-system/motion/motion.css from the
 * 2000ms Figma timeline cohort on 14:24 and stop under prefers-reduced-motion.
 *
 * Decorative by default: aria-hidden unless the caller supplies a label.
 */
export function NetworkMark({ size = "md", animated = true, label = "", className = "" }) {
  const scale = size === "sm" ? { origin: 18, line: 160, dest: 28 } : { origin: 24, line: 300, dest: 38 }
  return (
    <span
      className={`v2-network-mark ${className}`.trim()}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : "true"}
    >
      <span
        className={`v2-network-mark__node${animated ? " v2-motion-origin" : ""}`}
        style={{ inlineSize: scale.origin, blockSize: scale.origin }}
      />
      <span
        className={`v2-network-mark__line${animated ? " v2-motion-line" : ""}`}
        style={{ inlineSize: scale.line, maxInlineSize: "100%" }}
      />
      <span
        className={`v2-network-mark__node${animated ? " v2-motion-arrive" : ""}`}
        style={{ inlineSize: scale.dest, blockSize: scale.dest }}
      />
    </span>
  )
}
