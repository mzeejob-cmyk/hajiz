export function Card({ as: Tag = "div", className = "", children, ...rest }) {
  return <Tag className={`v2-card ${className}`.trim()} {...rest}>{children}</Tag>
}
