import type { InsightRecord } from '../api/backend'

type InsightDetailProps = {
  insight: InsightRecord
  onClose: () => void
  onDismiss: () => void
  onAction: () => void
}

const typeIcons: Record<string, string> = {
  memory: 'history',
  pattern: 'insights',
  goal_progress: 'trending_up',
  upcoming: 'event',
  wellness: 'spa',
  general: 'lightbulb',
}

const typeColors: Record<string, string> = {
  memory: '#8b5cf6',
  pattern: '#3b82f6',
  goal_progress: '#22c55e',
  upcoming: '#f59e0b',
  wellness: '#ec4899',
  general: '#6366f1',
}

const typeLabels: Record<string, string> = {
  memory: 'Memory',
  pattern: 'Pattern Detected',
  goal_progress: 'Goal Progress',
  upcoming: 'Upcoming Event',
  wellness: 'Wellness Insight',
  general: 'Insight',
}

export default function InsightDetail({
  insight,
  onClose,
  onDismiss,
  onAction,
}: InsightDetailProps) {
  const icon = typeIcons[insight.type] ?? 'lightbulb'
  const color = typeColors[insight.type] ?? '#6366f1'
  const label = typeLabels[insight.type] ?? 'Insight'

  return (
    <div className="detail-backdrop" style={{ zIndex: 1000 }}>
      <div
        className="detail-modal"
        style={{
          maxWidth: 420,
          background: '#fff',
        }}
      >
        <div className="detail-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20, color }}
              >
                {icon}
              </span>
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--reflect-muted)',
                }}
              >
                {label}
              </div>
              <div style={{ fontWeight: 600 }}>{insight.title}</div>
            </div>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div
            style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              color: 'rgba(0,0,0,0.8)',
              marginBottom: 16,
            }}
          >
            {insight.content}
          </div>

          {insight.reasoning && (
            <div
              style={{
                padding: 12,
                background: 'rgba(0,0,0,0.03)',
                borderRadius: 8,
                borderLeft: `3px solid ${color}`,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--reflect-muted)',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  psychology
                </span>
                Why this insight?
              </div>
              <div style={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.7)' }}>
                {insight.reasoning}
              </div>
            </div>
          )}

          {insight.createdAt && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--reflect-muted)',
                marginBottom: 16,
              }}
            >
              Generated{' '}
              {new Date(insight.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button
            className="button"
            onClick={onDismiss}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: 8,
              color: 'var(--reflect-muted)',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Dismiss
          </button>
          {insight.actionLabel && (
            <button
              className="button button--primary"
              onClick={onAction}
              style={{
                padding: '10px 16px',
                background: color,
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {insight.actionLabel}
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                arrow_forward
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
