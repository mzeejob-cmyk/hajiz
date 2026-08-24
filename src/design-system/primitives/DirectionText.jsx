export function DirectionText({ children, className = "" }) {
  return <bdi className={`latin-text ${className}`.trim()} dir="ltr">{children}</bdi>
}
