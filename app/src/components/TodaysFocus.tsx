import { useEffect, useState } from 'react'
import { generateTodaysFocus, type FocusItem } from '../services/focusGenerator'

type TodaysFocusProps = {
  displayName?: string
  onItemClick?: (item: FocusItem) => void
}

const typeIcons: Record<string, string> = {
  goal: 'flag',
  action: 'task_alt',
  milestone: 'check_circle',
  insight: 'lightbulb',
}

const typeColors: Record<string, string> = {
  goal: '#22c55e',
  action: '#3b82f6',
  milestone: '#8b5cf6',
  insight: '#f59e0b',
}

export default function TodaysFocus({ displayName, onItemClick }: TodaysFocusProps) {
  const [items, setItems] = useState<FocusItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadFocus = async () => {
      try {
        const result = await generateTodaysFocus(displayName)
        setItems(result.items)
      } catch (error) {
        console.error('Failed to generate focus:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadFocus()
  }, [displayName])

  if (loading) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: 'center',
          color: 'var(--reflect-muted)',
        }}
      >
        <div className="loading-spinner" />
        <div style={{ marginTop: 8, fontSize: '0.9rem' }}>
          Preparing your focus...
        </div>
      </div>
    )
  }

  return (
    <div className="todays-focus">
      {items.length === 0 ? null : (
        <>
          <div
            style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--reflect-muted)',
              marginBottom: 12,
            }}
          >
            Today's Focus
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {items.map((item) => {
              const icon = typeIcons[item.type] ?? 'task_alt'
              const color = typeColors[item.type] ?? '#3b82f6'

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onItemClick?.(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 10,
                    cursor: onItemClick ? 'pointer' : 'default',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'box-shadow 0.2s, border-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: `${color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 18, color }}
                    >
                      {icon}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        lineHeight: 1.3,
                      }}
                    >
                      {item.title}
                    </div>
                    {item.context && (
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--reflect-muted)',
                          marginTop: 2,
                          lineHeight: 1.3,
                        }}
                      >
                        {item.context}
                      </div>
                    )}
                  </div>
                  {item.dueWindow && (
                    <div
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background:
                          item.dueWindow === 'Today'
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(0,0,0,0.05)',
                        color:
                          item.dueWindow === 'Today' ? '#ef4444' : 'var(--reflect-muted)',
                        fontWeight: 500,
                        flexShrink: 0,
                      }}
                    >
                      {item.dueWindow}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
