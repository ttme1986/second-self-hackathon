import type { ActionPermission } from '../api/backend'

type PermissionOption = {
  value: ActionPermission
  title: string
  description: string
  icon: string
}

const permissionOptions: PermissionOption[] = [
  {
    value: 'suggest',
    title: 'Suggest Only',
    description: 'Save to Follow ups for you to complete manually',
    icon: 'lightbulb',
  },
  {
    value: 'draft',
    title: 'Draft & Review',
    description: 'AI creates a draft for you to review before sending',
    icon: 'edit_note',
  },
  {
    value: 'execute',
    title: 'Execute Now',
    description: 'AI completes this action immediately',
    icon: 'bolt',
  },
]

type PermissionSelectorProps = {
  actionTitle: string
  onSelect: (permission: ActionPermission) => void
  onCancel: () => void
  defaultPermission?: ActionPermission
}

export default function PermissionSelector({
  actionTitle,
  onSelect,
  onCancel,
  defaultPermission = 'suggest',
}: PermissionSelectorProps) {
  return (
    <div className="detail-backdrop" style={{ zIndex: 1000 }}>
      <div
        className="detail-modal"
        style={{
          maxWidth: 360,
          background: 'var(--chat-surface, #1a1a2e)',
          color: 'var(--chat-text, #fff)',
        }}
      >
        <div className="detail-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7 }}>
              Action Permission
            </div>
            <div style={{ fontWeight: 600, fontSize: '1rem', marginTop: 4 }}>{actionTitle}</div>
          </div>
          <button
            className="icon-button"
            aria-label="Cancel"
            onClick={onCancel}
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            x
          </button>
        </div>

        <div style={{ padding: '16px 0' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: 16, padding: '0 20px' }}>
            How would you like this action to be handled?
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {permissionOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSelect(option.value)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 20px',
                  background: option.value === defaultPermission ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: 'none',
                  borderLeft: option.value === defaultPermission ? '3px solid var(--chat-accent, #6366f1)' : '3px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  color: 'inherit',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (option.value !== defaultPermission) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (option.value !== defaultPermission) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 24,
                    color: option.value === 'execute' ? '#f59e0b' : option.value === 'draft' ? '#3b82f6' : '#22c55e',
                    marginTop: 2,
                  }}
                >
                  {option.icon}
                </span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{option.title}</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4 }}>
                    {option.description}
                  </div>
                </div>
                {option.value === defaultPermission && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      background: 'rgba(255,255,255,0.15)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      alignSelf: 'center',
                    }}
                  >
                    Default
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={onCancel}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
