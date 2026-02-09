import { useState } from 'react'
import type { GoalRecord, CheckInStatus } from '../api/backend'
import { generateCheckInResponse } from '../api/backend'

type GoalCheckInProps = {
  goal: GoalRecord
  onClose: () => void
  onSubmit: (checkIn: { status: CheckInStatus; notes: string; aiResponse: string }) => void
}

const statusOptions: { value: CheckInStatus; label: string; icon: string; description: string }[] = [
  {
    value: 'ahead',
    label: 'Ahead',
    icon: 'trending_up',
    description: "I'm making faster progress than expected",
  },
  {
    value: 'on-track',
    label: 'On Track',
    icon: 'check_circle',
    description: "I'm progressing as planned",
  },
  {
    value: 'behind',
    label: 'Behind',
    icon: 'trending_down',
    description: "I'm falling behind on this goal",
  },
]

export default function GoalCheckIn({ goal, onClose, onSubmit }: GoalCheckInProps) {
  const [status, setStatus] = useState<CheckInStatus | null>(null)
  const [notes, setNotes] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiResponse, setAiResponse] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [step, setStep] = useState<'status' | 'notes' | 'response'>('status')

  const handleGetResponse = async () => {
    if (!status) return
    setIsGenerating(true)
    try {
      const result = await generateCheckInResponse(
        goal.title,
        goal.progress,
        status,
        notes,
        goal.checkIns
      )
      if (result.data) {
        setAiResponse(result.data.response)
        setSuggestions(result.data.suggestions ?? [])
        setStep('response')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = () => {
    if (!status || !aiResponse) return
    onSubmit({
      status,
      notes,
      aiResponse,
    })
  }

  const lastCheckIn = goal.checkIns.length > 0 ? goal.checkIns[goal.checkIns.length - 1] : null
  const daysSinceLastCheckIn = lastCheckIn
    ? Math.floor((Date.now() - new Date(lastCheckIn.timestamp).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="detail-backdrop">
      <div className="detail-modal" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="detail-header">
          <div>
            <div className="reflect-subtitle">Goal Check-in</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{goal.title}</div>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="detail-section">
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
                  }}
                />
              </div>
            </div>
            <span style={{ fontWeight: 600 }}>{goal.progress}%</span>
          </div>
          {daysSinceLastCheckIn !== null && (
            <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)' }}>
              Last check-in: {daysSinceLastCheckIn === 0 ? 'Today' : `${daysSinceLastCheckIn} days ago`}
            </div>
          )}
        </div>

        {step === 'status' && (
          <>
            <div className="detail-section">
              <div className="reflect-subtitle">How are you progressing?</div>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatus(option.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      background: status === option.value ? 'rgba(var(--reflect-primary-rgb), 0.1)' : 'rgba(0,0,0,0.03)',
                      border: status === option.value ? '2px solid var(--reflect-primary)' : '2px solid transparent',
                      borderRadius: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <span
                      className={`material-symbols-outlined ${status === option.value ? 'fill-1' : ''}`}
                      style={{
                        color:
                          option.value === 'ahead'
                            ? '#3b82f6'
                            : option.value === 'on-track'
                              ? '#22c55e'
                              : '#f59e0b',
                        fontSize: 24,
                      }}
                    >
                      {option.icon}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{option.label}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)' }}>
                        {option.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="button button--primary"
                onClick={() => status && setStep('notes')}
                disabled={!status}
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 'notes' && (
          <>
            <div className="detail-section">
              <label className="reflect-subtitle" htmlFor="checkin-notes">
                Any additional thoughts? (optional)
              </label>
              <textarea
                id="checkin-notes"
                placeholder="What's working? What's challenging? Any wins to celebrate?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', minHeight: 100 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button className="button" onClick={() => setStep('status')}>
                Back
              </button>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="button" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="button button--primary"
                  onClick={handleGetResponse}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Getting feedback...' : 'Get AI Feedback'}
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'response' && aiResponse && (
          <>
            <div className="detail-section">
              <div className="reflect-subtitle">Your Coach Says</div>
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(var(--reflect-primary-rgb), 0.05)',
                  borderRadius: 12,
                  borderLeft: '4px solid var(--reflect-primary)',
                }}
              >
                <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6 }}>{aiResponse}</p>
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className="detail-section">
                <div className="reflect-subtitle">Suggested Actions</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        background: 'rgba(0,0,0,0.03)',
                        borderRadius: 8,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: 'var(--reflect-muted)', fontSize: 18 }}>
                        lightbulb
                      </span>
                      <span style={{ fontSize: '0.9rem' }}>{suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button className="button" onClick={() => setStep('notes')}>
                Back
              </button>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="button" onClick={onClose}>
                  Cancel
                </button>
                <button className="button button--primary" onClick={handleSubmit}>
                  Save Check-in
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
