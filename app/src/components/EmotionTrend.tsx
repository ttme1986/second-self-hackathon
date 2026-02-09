import { useEffect, useState } from 'react'
import {
  getEmotionTrends,
  getWellnessSuggestions,
  type EmotionTrendResult,
} from '../services/emotionTracker'
import { emotionColors, emotionLabels } from './EmotionIndicator'
import type { EmotionCategory } from '../api/backend'

type EmotionTrendProps = {
  onSuggestionClick?: (suggestion: { title: string; description: string }) => void
}

const moodIcons: Record<EmotionCategory, string> = {
  joy: 'sentiment_very_satisfied',
  sadness: 'sentiment_dissatisfied',
  anger: 'sentiment_very_dissatisfied',
  fear: 'sentiment_worried',
  surprise: 'sentiment_excited',
  neutral: 'sentiment_neutral',
  stress: 'sentiment_stressed',
  calm: 'sentiment_calm',
}

export default function EmotionTrend({ onSuggestionClick }: EmotionTrendProps) {
  const [trends, setTrends] = useState<EmotionTrendResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTrends = async () => {
      try {
        const result = await getEmotionTrends()
        setTrends(result)
      } catch (error) {
        console.error('Failed to load emotion trends:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadTrends()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--reflect-muted)' }}>
        <div className="loading-spinner" />
        <div style={{ marginTop: 8, fontSize: '0.85rem' }}>Loading emotional trends...</div>
      </div>
    )
  }

  if (!trends || trends.points.length === 0) {
    return (
      <div
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          background: 'rgba(139, 92, 246, 0.08)',
          borderRadius: 12,
          border: '1px solid rgba(139, 92, 246, 0.15)',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 32, color: '#8b5cf6', marginBottom: 8 }}
        >
          mood
        </span>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>No emotional data yet</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)' }}>
          Have a few conversations to start tracking your emotional patterns.
        </div>
      </div>
    )
  }

  const suggestions = getWellnessSuggestions(trends)
  const recentPoints = trends.points.slice(-14) // Last 2 weeks
  const overallColor = emotionColors[trends.overallMood]
  const overallLabel = emotionLabels[trends.overallMood]
  const overallIcon = moodIcons[trends.overallMood] ?? 'sentiment_neutral'

  // Calculate chart dimensions
  const chartWidth = 300
  const chartHeight = 80
  const padding = 8

  // Build SVG path for valence trend
  let trendPath = ''
  if (recentPoints.length >= 2) {
    const innerWidth = chartWidth - padding * 2
    const innerHeight = chartHeight - padding * 2

    recentPoints.forEach((point, index) => {
      const x = padding + (index / (recentPoints.length - 1)) * innerWidth
      // Map valence (-1 to 1) to y coordinate (bottom to top)
      const y = padding + ((1 - (point.valenceAvg + 1) / 2) * innerHeight)

      if (index === 0) {
        trendPath = `M ${x} ${y}`
      } else {
        trendPath += ` L ${x} ${y}`
      }
    })
  }

  return (
    <div className="emotion-trend">
      {/* Overall mood card */}
      <div
        style={{
          background: `${overallColor}15`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: `${overallColor}25`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 28, color: overallColor }}
            >
              {overallIcon}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--reflect-muted)', marginBottom: 2 }}>
              Recent Mood
            </div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{overallLabel}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--reflect-muted)', marginBottom: 2 }}>
              Stability
            </div>
            <div style={{ fontWeight: 600 }}>
              {trends.moodStability >= 0.7 ? 'High' : trends.moodStability >= 0.4 ? 'Medium' : 'Low'}
            </div>
          </div>
        </div>
      </div>

      {/* Trend visualization */}
      {recentPoints.length >= 2 && (
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
            Mood Trend (Last 2 Weeks)
          </div>
          <svg
            width={chartWidth}
            height={chartHeight}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              background: 'rgba(0,0,0,0.03)',
              borderRadius: 8,
            }}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Neutral line */}
            <line
              x1={padding}
              y1={chartHeight / 2}
              x2={chartWidth - padding}
              y2={chartHeight / 2}
              stroke="rgba(0,0,0,0.1)"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            {/* Trend line */}
            <path
              d={trendPath}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Data points */}
            {recentPoints.map((point, index) => {
              const x = padding + (index / (recentPoints.length - 1)) * (chartWidth - padding * 2)
              const y = padding + ((1 - (point.valenceAvg + 1) / 2) * (chartHeight - padding * 2))
              const color = emotionColors[point.dominant]

              return (
                <circle
                  key={point.date}
                  cx={x}
                  cy={y}
                  r={4}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              )
            })}
          </svg>
        </div>
      )}

      {/* Patterns */}
      {trends.patterns.length > 0 && (
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
            Patterns Detected
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {trends.patterns.map((pattern, index) => (
              <div
                key={index}
                style={{
                  padding: 12,
                  background: 'rgba(0,0,0,0.03)',
                  borderRadius: 8,
                  borderLeft: '3px solid #8b5cf6',
                }}
              >
                <div style={{ fontSize: '0.9rem' }}>{pattern.description}</div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--reflect-muted)',
                    marginTop: 4,
                  }}
                >
                  {Math.round(pattern.confidence * 100)}% confidence
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wellness suggestions */}
      {suggestions.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--reflect-muted)',
              marginBottom: 8,
            }}
          >
            Wellness Suggestions
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {suggestions.slice(0, 2).map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSuggestionClick?.(suggestion)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: 12,
                  background: 'rgba(236, 72, 153, 0.08)',
                  borderRadius: 8,
                  border: '1px solid rgba(236, 72, 153, 0.15)',
                  cursor: onSuggestionClick ? 'pointer' : 'default',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18, color: '#ec4899', marginTop: 2 }}
                >
                  spa
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>
                    {suggestion.title}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--reflect-muted)' }}>
                    {suggestion.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export type { EmotionTrendProps }
