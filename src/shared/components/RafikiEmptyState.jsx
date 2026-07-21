
export default function RafikiEmptyState({ icon = "📋", title = "Sin información", description, action }) {
  return (
    <div className="rafiki-empty-state">
      <div className="rafiki-empty-state-icon" aria-hidden="true">{icon}</div>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="rafiki-empty-state-action">{action}</div> : null}
    </div>
  );
}
