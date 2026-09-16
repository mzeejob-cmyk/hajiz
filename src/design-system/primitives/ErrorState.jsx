/** Error shell. Announced politely; never animated (see .v2-no-motion). */
export function ErrorState({ title, description = "", actions = null, className = "" }) {
  return (
    <div className={`v2-state v2-state--error v2-no-motion ${className}`.trim()} role="alert">
      <p className="v2-state__title">{title}</p>
      {description && <p className="v2-state__body">{description}</p>}
      {actions && <div className="v2-state__actions">{actions}</div>}
    </div>
  )
}
