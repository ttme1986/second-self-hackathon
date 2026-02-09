import { useState } from 'react'
import type { GoalRecord, GoalStatus } from '../api/backend'

type GoalDetailProps = {
  goal: GoalRecord
  onClose: () => void
  onUpdateGoal: (updates: Partial<GoalRecord>) => void
  onToggleMilestone: (milestoneId: string, completed: boolean) => void
  onAddMilestone: (title: string) => void
  onDeleteMilestone: (milestoneId: string) => void
  onCheckIn: () => void
}

const statusOptions: { value: GoalStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'abandoned', label: 'Abandoned' },
]

export default function GoalDetail({
  goal,
  onClose,
  onUpdateGoal,
  onToggleMilestone,
  onAddMilestone,
  onDeleteMilestone,
  onCheckIn,
}: GoalDetailProps) {
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(goal.title)
  const [editingDescription, setEditingDescription] = useState(goal.description)
  const [isEditing, setIsEditing] = useState(false)

  const handleSaveEdit = () => {
    onUpdateGoal({
      title: editingTitle.trim(),
      description: editingDescription.trim(),
    })
    setIsEditing(false)
  }

  const handleAddMilestone = () => {
    if (!newMilestoneTitle.trim()) return
    onAddMilestone(newMilestoneTitle.trim())
    setNewMilestoneTitle('')
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const completedMilestones = goal.milestones.filter((m) => m.completed).length
  const totalMilestones = goal.milestones.length

  return (
    <div className="detail-backdrop">
      <div className="detail-modal" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="detail-header">
          <div style={{ flex: 1 }}>
            <div className="reflect-subtitle">Goal Detail</div>
            {isEditing ? (
              <input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                style={{ fontWeight: 600, fontSize: '1.1rem', width: '100%' }}
              />
            ) : (
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{goal.title}</div>
            )}
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="detail-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className="reflect-chip"
                style={{
                  background: goal.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)',
                  color: goal.status === 'active' ? 'rgb(34,197,94)' : 'rgb(107,114,128)',
                }}
              >
                {goal.status}
              </span>
              <span className="reflect-chip" style={{ textTransform: 'capitalize' }}>
                {goal.category}
              </span>
            </div>
            <select
              aria-label="Goal status"
              value={goal.status}
              onChange={(e) => onUpdateGoal({ status: e.target.value as GoalStatus })}
              style={{
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: '0.85rem',
                background: '#fff',
              }}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {isEditing ? (
            <textarea
              value={editingDescription}
              onChange={(e) => setEditingDescription(e.target.value)}
              style={{ width: '100%', minHeight: 60, marginBottom: 8 }}
            />
          ) : (
            <p style={{ color: 'var(--reflect-muted)', marginBottom: 8 }}>{goal.description || 'No description'}</p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {isEditing ? (
              <>
                <button className="button button--primary" onClick={handleSaveEdit}>
                  Save
                </button>
                <button className="button" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="button" onClick={() => setIsEditing(true)}>
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="detail-section">
          <div className="reflect-subtitle">Progress</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, goal.progress))}%`,
                    background: 'var(--reflect-primary)',
                    borderRadius: 4,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{goal.progress}%</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)' }}>
            {completedMilestones} of {totalMilestones} milestones completed
          </div>
        </div>

        <div className="detail-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="reflect-subtitle">Milestones</div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {goal.milestones.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)' }}>
                No milestones yet. Add your first milestone below.
              </div>
            ) : (
              goal.milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    background: milestone.completed ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 8,
                  }}
                >
                  <button
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => onToggleMilestone(milestone.id, !milestone.completed)}
                    aria-label={`Mark ${milestone.title} as ${milestone.completed ? 'incomplete' : 'complete'}`}
                  >
                    <span
                      className={`material-symbols-outlined ${milestone.completed ? 'fill-1' : ''}`}
                      style={{ color: milestone.completed ? '#22c55e' : 'var(--reflect-muted)' }}
                    >
                      {milestone.completed ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                  </button>
                  <span
                    style={{
                      flex: 1,
                      textDecoration: milestone.completed ? 'line-through' : 'none',
                      color: milestone.completed ? 'var(--reflect-muted)' : 'inherit',
                    }}
                  >
                    {milestone.title}
                  </span>
                  <button
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--reflect-muted)' }}
                    onClick={() => onDeleteMilestone(milestone.id)}
                    aria-label={`Delete ${milestone.title}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      close
                    </span>
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              placeholder="Add a milestone..."
              value={newMilestoneTitle}
              onChange={(e) => setNewMilestoneTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddMilestone()
              }}
              style={{ flex: 1 }}
            />
            <button className="button button--primary" onClick={handleAddMilestone} disabled={!newMilestoneTitle.trim()}>
              Add
            </button>
          </div>
        </div>

        <div className="detail-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="reflect-subtitle">Check-ins ({goal.checkIns.length})</div>
            <button className="button button--primary" onClick={onCheckIn}>
              Check In
            </button>
          </div>

          {goal.checkIns.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)' }}>
              No check-ins yet. Check in to track your progress!
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {[...goal.checkIns].reverse().slice(0, 5).map((checkIn) => (
                <div
                  key={checkIn.id}
                  style={{
                    padding: '12px',
                    background: 'rgba(0,0,0,0.03)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      className="reflect-chip"
                      style={{
                        background:
                          checkIn.status === 'on-track'
                            ? 'rgba(34,197,94,0.12)'
                            : checkIn.status === 'ahead'
                              ? 'rgba(59,130,246,0.12)'
                              : 'rgba(245,158,11,0.12)',
                        color:
                          checkIn.status === 'on-track'
                            ? 'rgb(34,197,94)'
                            : checkIn.status === 'ahead'
                              ? 'rgb(59,130,246)'
                              : 'rgb(245,158,11)',
                        fontSize: '0.65rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      {checkIn.status.replace('-', ' ')}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--reflect-muted)' }}>
                      {formatDate(checkIn.timestamp)}
                    </span>
                  </div>
                  {checkIn.notes && (
                    <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>{checkIn.notes}</div>
                  )}
                  {checkIn.aiResponse && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)', fontStyle: 'italic' }}>
                      "{checkIn.aiResponse}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {goal.targetDate && (
          <div className="detail-section">
            <div className="reflect-subtitle">Target Date</div>
            <div style={{ fontSize: '0.9rem' }}>
              {new Date(goal.targetDate).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
