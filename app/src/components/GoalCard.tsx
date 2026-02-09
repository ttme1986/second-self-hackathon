import type { GoalRecord } from '../api/backend'

type GoalCardProps = {
  goal: GoalRecord
  onClick?: () => void
}

const categoryIcons: Record<GoalRecord['category'], string> = {
  health: 'favorite',
  career: 'work',
  learning: 'school',
  relationships: 'group',
  finance: 'account_balance',
  personal: 'person',
  other: 'flag',
}

const categoryColors: Record<GoalRecord['category'], string> = {
  health: '#ef4444',
  career: '#3b82f6',
  learning: '#8b5cf6',
  relationships: '#ec4899',
  finance: '#22c55e',
  personal: '#f59e0b',
  other: '#6b7280',
}

export default function GoalCard({ goal, onClick }: GoalCardProps) {
  const icon = categoryIcons[goal.category] || 'flag'
  const color = categoryColors[goal.category] || '#6b7280'

  const formatTargetDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getNextMilestone = () => {
    const incomplete = goal.milestones.filter((m) => !m.completed)
    return incomplete[0]?.title ?? null
  }

  const targetDateFormatted = formatTargetDate(goal.targetDate)
  const nextMilestone = getNextMilestone()

  return (
    <button
      className="reflect-card"
      onClick={onClick}
      style={{ textAlign: 'left', cursor: 'pointer' }}
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
          <span className="material-symbols-outlined" style={{ color, fontSize: 20 }}>
            {icon}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{goal.title}</span>
            {goal.status !== 'active' && (
              <span
                className="reflect-chip"
                style={{
                  background: goal.status === 'completed' ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)',
                  color: goal.status === 'completed' ? 'rgb(34,197,94)' : 'rgb(107,114,128)',
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {goal.status}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span
              className="reflect-chip"
              style={{
                background: `${color}15`,
                color,
                fontSize: '0.7rem',
                textTransform: 'capitalize',
              }}
            >
              {goal.category}
            </span>
            {targetDateFormatted && (
              <span style={{ fontSize: '0.8rem', color: 'var(--reflect-muted)' }}>
                Target: {targetDateFormatted}
              </span>
            )}
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--reflect-muted)' }}>Progress</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{goal.progress}%</span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: 'rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(0, goal.progress))}%`,
                  background: color,
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {nextMilestone && (
            <div style={{ fontSize: '0.8rem', color: 'var(--reflect-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>
                arrow_right
              </span>
              Next: {nextMilestone}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
