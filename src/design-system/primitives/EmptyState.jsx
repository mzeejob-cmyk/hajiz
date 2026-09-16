export function EmptyState({ title, description = "", actions = null, className = "" }) {
  return (
    <div className={`v2-state ${className}`.trim()}>
      <p className="v2-state__title">{title}</p>
      {description && <p className="v2-state__body">{description}</p>}
      {actions && <div className="v2-state__actions">{actions}</div>}
    </div>
  )
}
