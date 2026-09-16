export function Section({ as: Tag = "section", className = "", children, ...rest }) {
  return <Tag className={`v2-section ${className}`.trim()} {...rest}>{children}</Tag>
}
