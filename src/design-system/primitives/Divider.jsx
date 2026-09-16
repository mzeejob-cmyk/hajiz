/** `network` draws the brand journey line instead of a plain rule. */
export function Divider({ network = false, className = "", ...rest }) {
  return <hr className={`v2-divider${network ? " v2-divider--network" : ""} ${className}`.trim()} {...rest} />
}
