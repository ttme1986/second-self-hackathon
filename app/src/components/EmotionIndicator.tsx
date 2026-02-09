import type { EmotionalState, EmotionCategory } from '../api/backend'

type EmotionIndicatorProps = {
  emotion: EmotionalState | null
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
}

const emotionEmojis: Record<EmotionCategory, string> = {
  joy: '😊',
  sadness: '😔',
  anger: '😤',
  fear: '😰',
  surprise: '😮',
  neutral: '😐',
  stress: '😣',
  calm: '😌',
}

const emotionColors: Record<EmotionCategory, string> = {
  joy: '#fbbf24',
  sadness: '#60a5fa',
  anger: '#ef4444',
  fear: '#a855f7',
  surprise: '#f97316',
  neutral: '#9ca3af',
  stress: '#f43f5e',
  calm: '#22c55e',
}

const emotionLabels: Record<EmotionCategory, string> = {
  joy: 'Happy',
  sadness: 'Sad',
  anger: 'Frustrated',
  fear: 'Anxious',
  surprise: 'Surprised',
  neutral: 'Neutral',
  stress: 'Stressed',
  calm: 'Calm',
}

const sizeMap = {
  small: { dot: 8, font: '0.7rem', emoji: 14 },
  medium: { dot: 12, font: '0.8rem', emoji: 18 },
  large: { dot: 16, font: '0.9rem', emoji: 24 },
}

export default function EmotionIndicator({
  emotion,
  size = 'medium',
  showLabel = false,
}: EmotionIndicatorProps) {
  if (!emotion) return null

  const { primary, intensity, confidence } = emotion
  const color = emotionColors[primary]
  const emoji = emotionEmojis[primary]
  const label = emotionLabels[primary]
  const { dot, font, emoji: emojiSize } = sizeMap[size]

  // Show low confidence indicator
  const lowConfidence = confidence < 0.5

  return (
    <div
      className="emotion-indicator"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        opacity: lowConfidence ? 0.7 : 1,
      }}
      title={`${label} (${Math.round(confidence * 100)}% confidence)`}
    >
      <div
        style={{
          width: dot,
          height: dot,
          borderRadius: '50%',
          background: color,
          boxShadow: intensity > 0.7 ? `0 0 ${dot / 2}px ${color}` : 'none',
          animation: intensity > 0.8 ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
      />
      {size !== 'small' && (
        <span style={{ fontSize: emojiSize }}>{emoji}</span>
      )}
      {showLabel && (
        <span
          style={{
            fontSize: font,
            color: 'var(--reflect-muted)',
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}

type EmotionArcProps = {
  states: EmotionalState[]
  height?: number
}

export function EmotionArc({ states, height = 40 }: EmotionArcProps) {
  if (states.length < 2) return null

  // Generate arc path based on valence over time
  const width = 200
  const padding = 10
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2

  const points = states.map((state, index) => {
    const x = padding + (index / (states.length - 1)) * innerWidth
    const y = padding + ((1 - (state.valence + 1) / 2) * innerHeight)
    return { x, y }
  })

  // Create smooth curve through points
  let pathD = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx = (prev.x + curr.x) / 2
    pathD += ` Q ${prev.x} ${prev.y} ${cpx} ${(prev.y + curr.y) / 2}`
  }
  pathD += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`

  // Determine overall color based on average valence
  const avgValence = states.reduce((sum, s) => sum + s.valence, 0) / states.length
  const arcColor = avgValence > 0.2 ? '#22c55e' : avgValence < -0.2 ? '#ef4444' : '#9ca3af'

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Neutral line */}
      <line
        x1={padding}
        y1={height / 2}
        x2={width - padding}
        y2={height / 2}
        stroke="rgba(0,0,0,0.1)"
        strokeWidth={1}
        strokeDasharray="4,4"
      />
      {/* Emotion arc */}
      <path
        d={pathD}
        fill="none"
        stroke={arcColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Points */}
      {points.map((point, index) => {
        const state = states[index]
        const color = emotionColors[state.primary]
        return (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={color}
            stroke="#fff"
            strokeWidth={1.5}
          />
        )
      })}
    </svg>
  )
}

export { emotionEmojis, emotionColors, emotionLabels }
