import { useState } from 'react'
import type { ActionRecord } from '../api/backend'
import { createEvidenceSnippet } from '../lib/evidence'

type DraftReviewModalProps = {
  action: ActionRecord
  onClose: () => void
  onApprove: () => void
  onEdit: (newContent: string) => void
  onDismiss: () => void
}

const actionTypeLabels: Record<string, string> = {
  email: 'Email Draft',
  calendar: 'Calendar Event',
  reminder: 'Reminder',
  goal: 'Goal Action',
  reading: 'Reading Item',
  general: 'Action Item',
}

const statusLabels: Record<string, { label: string; color: string }> = {
  approved: { label: 'Ready for Review', color: '#3b82f6' },
  executing: { label: 'Processing...', color: '#f59e0b' },
  completed: { label: 'Completed', color: '#22c55e' },
  failed: { label: 'Failed', color: '#ef4444' },
}

export default function DraftReviewModal({
  action,
  onClose,
  onApprove,
  onEdit,
  onDismiss,
}: DraftReviewModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(action.draftContent ?? '')

  const typeLabel = action.actionType
    ? actionTypeLabels[action.actionType] ?? 'Action'
    : 'Action'
  const statusInfo = statusLabels[action.status] ?? { label: action.status, color: '#6b7280' }

  const handleSaveEdit = () => {
    onEdit(editedContent)
    setIsEditing(false)
  }

  const showActions = action.status === 'approved'
  const showResult = action.status === 'completed' && action.executionResult

  return (
    <div className="detail-backdrop" style={{ zIndex: 1000 }}>
      <div
        className="detail-modal"
        style={{
          maxWidth: 480,
          background: 'var(--reflect-bg, #f8f9fa)',
        }}
      >
        <div className="detail-header">
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--reflect-muted)',
              }}
            >
              {typeLabel}
            </div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 4 }}>
              {action.title}
            </div>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>

        <div style={{ padding: '0 20px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: '0.75rem',
              fontWeight: 600,
              background: `${statusInfo.color}20`,
              color: statusInfo.color,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: statusInfo.color,
              }}
            />
            {statusInfo.label}
          </div>

          {action.context && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--reflect-muted)',
                  marginBottom: 4,
                }}
              >
                Context
              </div>
              <div style={{ fontSize: '0.9rem' }}>{action.context}</div>
            </div>
          )}

          {action.evidence?.[0] && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--reflect-muted)',
                  marginBottom: 4,
                }}
              >
                Why this action?
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontStyle: 'italic',
                  color: 'var(--reflect-muted)',
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.03)',
                  borderRadius: 8,
                  borderLeft: '3px solid var(--reflect-primary)',
                }}
              >
                "{createEvidenceSnippet(action.evidence[0])}"
              </div>
            </div>
          )}

          {action.draftContent && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--reflect-muted)',
                  }}
                >
                  Draft Content
                </div>
                {showActions && !isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--reflect-primary)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      edit
                    </span>
                    Edit
                  </button>
                )}
              </div>
              {isEditing ? (
                <div>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: 150,
                      padding: 12,
                      border: '1px solid rgba(0,0,0,0.15)',
                      borderRadius: 8,
                      font: 'inherit',
                      fontSize: '0.9rem',
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="button button--primary" onClick={handleSaveEdit}>
                      Save Changes
                    </button>
                    <button
                      className="button"
                      onClick={() => {
                        setEditedContent(action.draftContent ?? '')
                        setIsEditing(false)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: 12,
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 8,
                    fontSize: '0.9rem',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {action.draftContent}
                </div>
              )}
            </div>
          )}

          {showResult && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--reflect-muted)',
                  marginBottom: 8,
                }}
              >
                Execution Result
              </div>
              <div
                style={{
                  padding: 12,
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: 8,
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {action.executionResult}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(0,0,0,0.1)',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          {showActions ? (
            <>
              <button className="button" onClick={onDismiss}>
                Dismiss
              </button>
              <button className="button button--primary" onClick={onApprove}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 4 }}>
                  check
                </span>
                Approve & Execute
              </button>
            </>
          ) : (
            <button className="button" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
