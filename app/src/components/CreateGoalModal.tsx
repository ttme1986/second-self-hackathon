import { useState } from 'react'
import type { GoalCategory, Milestone } from '../api/backend'
import { generateGoalMilestones } from '../api/backend'

type CreateGoalModalProps = {
  onClose: () => void
  onCreate: (goal: {
    title: string
    description: string
    category: GoalCategory
    targetDate: string | null
    milestones: Omit<Milestone, 'id'>[]
  }) => void
}

const categories: { value: GoalCategory; label: string; icon: string }[] = [
  { value: 'health', label: 'Health & Fitness', icon: 'favorite' },
  { value: 'career', label: 'Career', icon: 'work' },
  { value: 'learning', label: 'Learning', icon: 'school' },
  { value: 'relationships', label: 'Relationships', icon: 'group' },
  { value: 'finance', label: 'Finance', icon: 'account_balance' },
  { value: 'personal', label: 'Personal', icon: 'person' },
  { value: 'other', label: 'Other', icon: 'flag' },
]

export default function CreateGoalModal({ onClose, onCreate }: CreateGoalModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<GoalCategory>('personal')
  const [targetDate, setTargetDate] = useState('')
  const [milestones, setMilestones] = useState<Omit<Milestone, 'id'>[]>([])
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('')
  const [isGeneratingMilestones, setIsGeneratingMilestones] = useState(false)
  const [step, setStep] = useState<'details' | 'milestones'>('details')

  const handleGenerateMilestones = async () => {
    if (!title.trim()) return
    setIsGeneratingMilestones(true)
    try {
      const result = await generateGoalMilestones(title, description, category)
      if (result.data?.milestones) {
        setMilestones(result.data.milestones)
      }
    } finally {
      setIsGeneratingMilestones(false)
    }
  }

  const handleAddMilestone = () => {
    if (!newMilestoneTitle.trim()) return
    setMilestones((prev) => [...prev, { title: newMilestoneTitle.trim(), completed: false }])
    setNewMilestoneTitle('')
  }

  const handleRemoveMilestone = (index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!title.trim()) return
    onCreate({
      title: title.trim(),
      description: description.trim(),
      category,
      targetDate: targetDate || null,
      milestones,
    })
  }

  const canProceed = title.trim().length > 0

  return (
    <div className="detail-backdrop">
      <div className="detail-modal" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="detail-header">
          <div>
            <div className="reflect-subtitle">Create New Goal</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
              {step === 'details' ? 'Goal Details' : 'Milestones'}
            </div>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>

        {step === 'details' ? (
          <>
            <div className="detail-section">
              <label className="reflect-subtitle" htmlFor="goal-title">
                Goal Title *
              </label>
              <input
                id="goal-title"
                placeholder="What do you want to achieve?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div className="detail-section">
              <label className="reflect-subtitle" htmlFor="goal-description">
                Description
              </label>
              <textarea
                id="goal-description"
                placeholder="Why is this goal important to you?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: '100%', minHeight: 80 }}
              />
            </div>

            <div className="detail-section">
              <div className="reflect-subtitle">Category</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    className={`reflect-chip ${category === cat.value ? 'is-active' : ''}`}
                    onClick={() => setCategory(cat.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {cat.icon}
                    </span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="detail-section">
              <label className="reflect-subtitle" htmlFor="goal-target-date">
                Target Date (optional)
              </label>
              <input
                id="goal-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="button button--primary"
                onClick={() => {
                  if (canProceed) setStep('milestones')
                }}
                disabled={!canProceed}
              >
                Next: Add Milestones
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="detail-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="reflect-subtitle">Milestones</div>
                <button
                  className="button"
                  onClick={handleGenerateMilestones}
                  disabled={isGeneratingMilestones}
                >
                  {isGeneratingMilestones ? 'Generating...' : 'Suggest with AI'}
                </button>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {milestones.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)', padding: 12 }}>
                    Break your goal into smaller steps. Add milestones manually or use AI suggestions.
                  </div>
                ) : (
                  milestones.map((milestone, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '8px 12px',
                        background: 'rgba(0,0,0,0.03)',
                        borderRadius: 8,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: 'var(--reflect-muted)' }}>
                        radio_button_unchecked
                      </span>
                      <span style={{ flex: 1 }}>{milestone.title}</span>
                      <button
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--reflect-muted)' }}
                        onClick={() => handleRemoveMilestone(index)}
                        aria-label={`Remove ${milestone.title}`}
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
                <button
                  className="button button--primary"
                  onClick={handleAddMilestone}
                  disabled={!newMilestoneTitle.trim()}
                >
                  Add
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button className="button" onClick={() => setStep('details')}>
                Back
              </button>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="button" onClick={onClose}>
                  Cancel
                </button>
                <button className="button button--primary" onClick={handleSubmit}>
                  Create Goal
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
