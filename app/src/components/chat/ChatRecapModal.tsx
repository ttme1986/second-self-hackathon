import EmotionIndicator, { EmotionArc, emotionLabels } from '../EmotionIndicator'
import { createEvidenceSnippet } from '../../lib/evidence'
import type { EmotionalState, EmotionalSummary } from '../../api/backend'
import type { InferredClaim } from '../../services/conversationRealtime'
import type { SuggestedAction } from '../../hooks/useSuggestedActions'

type ChatRecapModalProps = {
  summary: string
  emotionalSummary: EmotionalSummary | null
  emotionalStates: EmotionalState[]
  inferredClaims: InferredClaim[]
  triggeredActions: SuggestedAction[]
  untappedActions: SuggestedAction[]
  dismissedActions: SuggestedAction[]
  reviewItems: Array<{ id: string; title: string; summary: string; severity?: string }>
  expandedEvidenceId: string | null
  sessionStartedAt?: number | null
  sessionDurationMs?: number | null
  onToggleEvidence: (id: string) => void
  onSaveAction: (actionId: string) => void
  onClose: () => void
  onGoToReflect: () => void
}

export default function ChatRecapModal({
  summary,
  emotionalSummary,
  emotionalStates,
  inferredClaims,
  triggeredActions,
  untappedActions,
  dismissedActions,
  reviewItems,
  expandedEvidenceId,
  sessionStartedAt,
  sessionDurationMs,
  onToggleEvidence,
  onSaveAction,
  onClose,
  onGoToReflect,
}: ChatRecapModalProps) {
  const sessionDate = sessionStartedAt
    ? new Date(sessionStartedAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    : new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
  const sessionTime = sessionStartedAt
    ? new Date(sessionStartedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : ''
  const durationLabel = sessionDurationMs
    ? `${Math.floor(sessionDurationMs / 60000)}m ${Math.floor((sessionDurationMs % 60000) / 1000)}s`
    : ''

  return (
    <div className="recap-backdrop">
      <div className="recap-card">
        <div className="recap-top">
          <div className="hub-date">{sessionDate}</div>
          <button
            aria-label="Close recap"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>
        <div className="recap-main no-scrollbar">
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600 }}>Session Recap</h1>
            <p style={{ marginTop: 4, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
              {[sessionTime, durationLabel].filter(Boolean).join(' - ') || ''}
            </p>
          </div>
          {summary ? (
            <div className="recap-summary-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--recap-primary)', fontSize: 14 }}>
                  auto_awesome
                </span>
                <span className="recap-section-title">AI Summary</span>
              </div>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)' }}>{summary}</p>
            </div>
          ) : null}
          {emotionalSummary && emotionalStates.length > 0 && (
            <div className="recap-summary-card" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span className="material-symbols-outlined" style={{ color: '#8b5cf6', fontSize: 14 }}>
                  mood
                </span>
                <span className="recap-section-title">Emotional Summary</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <EmotionIndicator emotion={{ ...emotionalStates[emotionalStates.length - 1], primary: emotionalSummary.dominant }} size="large" showLabel />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)' }}>
                    Dominant mood: <strong>{emotionLabels[emotionalSummary.dominant]}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                    {emotionalSummary.arc === 'improving' && '📈 Mood improved during session'}
                    {emotionalSummary.arc === 'declining' && '📉 Mood declined during session'}
                    {emotionalSummary.arc === 'stable' && '➡️ Mood remained stable'}
                  </div>
                </div>
              </div>
              {emotionalStates.length >= 2 && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <EmotionArc states={emotionalStates} height={50} />
                </div>
              )}
            </div>
          )}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                Knowledge inferred
              </h3>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                {inferredClaims.length}
              </span>
            </div>
            <div className="recap-action-list" style={{ marginTop: 12 }}>
              {inferredClaims.length === 0 ? (
                <div className="recap-suggested-card">No knowledge inferred.</div>
              ) : (
                inferredClaims.map((claim) => {
                  const evidenceId = `claim-${claim.id ?? claim.text}`
                  const evidenceText = createEvidenceSnippet(
                    claim.evidence?.[0],
                  )
                  const isEvidenceOpen = expandedEvidenceId === evidenceId

                  return (
                    <div key={claim.text} className="recap-suggested-item">
                      <div className="recap-suggested-card recap-suggested-row">
                        <div className="recap-suggested-text">{claim.text}</div>
                        {evidenceText ? (
                          <button
                            className="receipt-toggle recap-receipt-toggle"
                            type="button"
                            aria-label={`Why ${claim.text}`}
                            onClick={() => onToggleEvidence(evidenceId)}
                          >
                            Why?
                          </button>
                        ) : null}
                      </div>
                      {evidenceText && isEvidenceOpen ? (
                        <div className="receipt-text recap-receipt-text">{evidenceText}</div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </div>
          {reviewItems.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                  Conflicts for Review
                </h3>
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: '#ffb69f',
                    background: 'rgba(255,182,159,0.15)',
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  {reviewItems.length} Found
                </span>
              </div>
              <div className="recap-action-list" style={{ marginTop: 12 }}>
                {reviewItems.map((item) => (
                  <div key={item.id} className="recap-action-card">
                    <div className="recap-action-icon" style={{ color: '#ffb69f' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        warning
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.title}</div>
                      {item.summary && (
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                          {item.summary}
                        </div>
                      )}
                      {item.severity && (
                        <span style={{
                          fontSize: '0.65rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          color: item.severity === 'high' ? '#ff6b6b' : item.severity === 'medium' ? '#ffb69f' : 'rgba(255,255,255,0.4)',
                          marginTop: 4,
                          display: 'inline-block',
                        }}>
                          {item.severity}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                Confirmed Actions
              </h3>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--recap-primary)',
                  background: 'rgba(99,137,140,0.15)',
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {triggeredActions.length} Saved
              </span>
            </div>
            <div className="recap-action-list" style={{ marginTop: 12 }}>
              {triggeredActions.length === 0 ? (
                <div className="recap-suggested-card">No triggered actions yet.</div>
              ) : (
                triggeredActions.map((item) => {
                  const evidenceId = `action-${item.id}`
                  const evidenceText = createEvidenceSnippet(item.evidence?.[0])
                  const isEvidenceOpen = expandedEvidenceId === evidenceId

                  return (
                    <div key={item.id} className="recap-action-card">
                      <div className="recap-action-icon">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          check_circle
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                          Due: {item.due}
                        </div>
                        {evidenceText ? (
                          <button
                            className="receipt-toggle recap-receipt-toggle"
                            type="button"
                            aria-label={`Why ${item.title}`}
                            onClick={() => onToggleEvidence(evidenceId)}
                          >
                            Why?
                          </button>
                        ) : null}
                        {evidenceText && isEvidenceOpen ? (
                          <div className="receipt-text recap-receipt-text">{evidenceText}</div>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                Suggested Actions
              </h3>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Tap to save</span>
            </div>
            <div className="recap-action-list" style={{ marginTop: 12 }}>
              {untappedActions.length === 0 ? (
                <div className="recap-suggested-card">All set.</div>
              ) : (
                untappedActions.map((item) => {
                  const evidenceId = `action-${item.id}`
                  const evidenceText = createEvidenceSnippet(item.evidence?.[0])
                  const isEvidenceOpen = expandedEvidenceId === evidenceId

                  return (
                    <div key={item.id} className="recap-suggested-item">
                      <div className="recap-suggested-card recap-suggested-row">
                        <button
                          className="recap-suggested-save"
                          type="button"
                          aria-label={`Save ${item.title}`}
                          onClick={() => onSaveAction(item.id)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                            add
                          </span>
                          {item.title}
                        </button>
                        {evidenceText ? (
                          <button
                            className="receipt-toggle recap-receipt-toggle"
                            type="button"
                            aria-label={`Why ${item.title}`}
                            onClick={() => onToggleEvidence(evidenceId)}
                          >
                            Why?
                          </button>
                        ) : null}
                      </div>
                      {evidenceText && isEvidenceOpen ? (
                        <div className="receipt-text recap-receipt-text">{evidenceText}</div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                Rejected Actions
              </h3>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Tap + to save</span>
            </div>
            <div className="recap-action-list" style={{ marginTop: 12 }}>
              {dismissedActions.length === 0 ? (
                <div className="recap-suggested-card">None rejected.</div>
              ) : (
                dismissedActions.map((item) => {
                  const evidenceId = `action-${item.id}`
                  const evidenceText = createEvidenceSnippet(item.evidence?.[0])
                  const isEvidenceOpen = expandedEvidenceId === evidenceId

                  return (
                    <div key={item.id} className="recap-suggested-item">
                      <div className="recap-suggested-card recap-suggested-row">
                        <button
                          className="recap-suggested-save"
                          type="button"
                          aria-label={`Save ${item.title}`}
                          onClick={() => onSaveAction(item.id)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                            add
                          </span>
                          {item.title}
                        </button>
                        {evidenceText ? (
                          <button
                            className="receipt-toggle recap-receipt-toggle"
                            type="button"
                            aria-label={`Why ${item.title}`}
                            onClick={() => onToggleEvidence(evidenceId)}
                          >
                            Why?
                          </button>
                        ) : null}
                      </div>
                      {evidenceText && isEvidenceOpen ? (
                        <div className="receipt-text recap-receipt-text">{evidenceText}</div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
        <div className="recap-footer">
          <button
            className="recap-cta"
            onClick={onGoToReflect}
          >
            Go to Reflect
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  )
}
