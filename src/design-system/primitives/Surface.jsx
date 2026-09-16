const TONES = ["primary", "canvas", "subtle", "inverse"]
const ELEVATIONS = ["flat", "raised", "floating"]

export function Surface({ tone = "primary", elevation = "flat", as: Tag = "div", className = "", children, ...rest }) {
  const t = TONES.includes(tone) ? tone : "primary"
  const e = ELEVATIONS.includes(elevation) ? elevation : "flat"
  const classes = [
    "v2-surface",
    t === "primary" ? "" : `v2-surface--${t}`,
    e === "flat" ? "" : `v2-surface--${e}`,
    className,
  ].filter(Boolean).join(" ")
  return <Tag className={classes} {...rest}>{children}</Tag>
}
