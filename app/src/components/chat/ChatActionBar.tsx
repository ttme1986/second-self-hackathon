import type { SuggestedAction } from '../../hooks/useSuggestedActions'

type ChatActionBarProps = {
  shownActions: SuggestedAction[]
  remainingCount: number
  onTapAction: (actionId: string) => void
  onDismissAction: (actionId: string) => void
}

export default function ChatActionBar({
  shownActions,
  remainingCount,
  onTapAction,
  onDismissAction,
}: ChatActionBarProps) {
  if (shownActions.length === 0) {
    return (
      <section className="chat-actions">
        <div className="chat-action-card">
          <div className="chat-action-content">
            <div className="chat-action-icon">
              <span className="material-symbols-outlined">event_available</span>
            </div>
            <div>
              <p className="chat-action-title">No suggested actions yet</p>
              <p className="chat-action-meta">Tap mic to generate</p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="chat-actions">
      <div className="chat-action-card is-accent">
        {remainingCount > 0 ? (
          <span
            className="chat-action-count"
            aria-label={`${remainingCount} more pending actions`}
          >
            +{remainingCount}
          </span>
        ) : null}

        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 10 }}>
          {shownActions.map((action) => (
            <div key={action.id} className="chat-action-body">
              <div className="chat-action-content">
                <div className="chat-action-icon">
                  <span className="material-symbols-outlined">event_available</span>
                </div>
                <div className="chat-action-title-wrap">
                  <p className="chat-action-title">{action.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {shownActions.length > 0 && (
          <div className="chat-action-controls">
            <button
              className="chat-action-add"
              aria-label={`Add ${shownActions[0].title}`}
              onClick={() => onTapAction(shownActions[0].id)}
              type="button"
            >
              <span className="material-symbols-outlined">add</span>
            </button>
            <button
              className="chat-action-dismiss"
              aria-label={`Dismiss ${shownActions[0].title}`}
              onClick={() => onDismissAction(shownActions[0].id)}
              type="button"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
