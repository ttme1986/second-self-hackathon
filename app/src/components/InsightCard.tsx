import type { InsightRecord } from '../api/backend'

type InsightCardProps = {
  insight: InsightRecord
  onDismiss: () => void
  onAction: () => void
  onClick?: () => void
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

export default function InsightCard({
  insight,
  onDismiss,
  onAction,
  onClick,
}: InsightCardProps) {
  const icon = typeIcons[insight.type] ?? 'lightbulb'
  const color = typeColors[insight.type] ?? '#6366f1'

  return (
    <div
      className="insight-card"
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        cursor: onClick ? 'pointer' : 'default',
        border: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 20, color }}
          >
            {icon}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--reflect-muted)',
              marginBottom: 4,
            }}
          >
            {insight.type.replace('_', ' ')}
          </div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{insight.title}</div>
          <div
            style={{
              fontSize: '0.9rem',
              color: 'rgba(0,0,0,0.7)',
              lineHeight: 1.4,
            }}
          >
            {insight.content}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
            }}
          >
            {insight.actionLabel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onAction()
                }}
                style={{
                  padding: '6px 12px',
                  background: color,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {insight.actionLabel}
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  arrow_forward
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDismiss()
              }}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                color: 'var(--reflect-muted)',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 6,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
