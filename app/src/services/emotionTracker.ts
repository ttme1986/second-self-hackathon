import {
  listConversations,
  type EmotionCategory,
  type EmotionalState,
} from '../api/backend'

type EmotionTrendPoint = {
  date: string
  dominant: EmotionCategory
  valenceAvg: number
  count: number
}

type EmotionPattern = {
  type: 'time_of_day' | 'weekly' | 'emotion_frequency'
  description: string
  confidence: number
  data?: Record<string, number>
}

type EmotionTrendResult = {
  points: EmotionTrendPoint[]
  patterns: EmotionPattern[]
  overallMood: EmotionCategory
  moodStability: number // 0 (volatile) to 1 (stable)
}

/**
 * Keyword-based fallback for deriving emotion from a conversation summary.
 * Used only for legacy conversations that lack persisted EmotionalState records.
 */
function inferEmotionFromSummary(summary: string): { emotion: EmotionCategory; valence: number } {
  const summaryLower = summary.toLowerCase()

  if (summaryLower.includes('happy') || summaryLower.includes('excited') || summaryLower.includes('great')) {
    return { emotion: 'joy', valence: 0.7 }
  } else if (summaryLower.includes('stressed') || summaryLower.includes('anxious') || summaryLower.includes('worried')) {
    return { emotion: 'stress', valence: -0.5 }
  } else if (summaryLower.includes('sad') || summaryLower.includes('upset') || summaryLower.includes('disappointed')) {
    return { emotion: 'sadness', valence: -0.6 }
  } else if (summaryLower.includes('calm') || summaryLower.includes('relaxed') || summaryLower.includes('peaceful')) {
    return { emotion: 'calm', valence: 0.4 }
  } else if (summaryLower.includes('frustrated') || summaryLower.includes('angry') || summaryLower.includes('annoyed')) {
    return { emotion: 'anger', valence: -0.4 }
  }

  return { emotion: 'neutral', valence: 0 }
}

/**
 * Derive the dominant emotion and average valence from a set of EmotionalState records.
 */
function aggregateEmotionalStates(states: EmotionalState[]): { emotions: EmotionCategory[]; valences: number[] } {
  const emotions: EmotionCategory[] = []
  const valences: number[] = []

  for (const state of states) {
    emotions.push(state.primary)
    valences.push(state.valence)
  }

  return { emotions, valences }
}

/**
 * Parse emotional states from conversation metadata.
 * Uses persisted EmotionalState records when available (AI-detected data).
 * Falls back to keyword matching on conversation summaries for legacy conversations.
 */
async function getHistoricalEmotions(): Promise<EmotionTrendPoint[]> {
  const result = await listConversations()
  const conversations = result.data?.items ?? []

  const points: EmotionTrendPoint[] = []
  const dateMap = new Map<string, { valences: number[]; emotions: EmotionCategory[] }>()

  for (const conv of conversations) {
    if (!conv.startedAt) continue

    const date = conv.startedAt.slice(0, 10) // YYYY-MM-DD
    const entry = dateMap.get(date) ?? { valences: [], emotions: [] }

    const storedStates: EmotionalState[] = conv.emotionalStates ?? []

    if (storedStates.length > 0) {
      // Use real AI-detected emotional states
      const { emotions, valences } = aggregateEmotionalStates(storedStates)
      entry.emotions.push(...emotions)
      entry.valences.push(...valences)
    } else {
      // Fallback: infer basic emotion from summary (for legacy conversations)
      const { emotion, valence } = inferEmotionFromSummary(conv.summary ?? '')
      entry.emotions.push(emotion)
      entry.valences.push(valence)
    }

    dateMap.set(date, entry)
  }

  // Convert to trend points
  for (const [date, { valences, emotions }] of dateMap) {
    // Find dominant emotion
    const emotionCounts: Record<string, number> = {}
    for (const e of emotions) {
      emotionCounts[e] = (emotionCounts[e] ?? 0) + 1
    }
    let dominant: EmotionCategory = 'neutral'
    let maxCount = 0
    for (const [e, count] of Object.entries(emotionCounts)) {
      if (count > maxCount) {
        maxCount = count
        dominant = e as EmotionCategory
      }
    }

    const valenceAvg = valences.reduce((a, b) => a + b, 0) / valences.length

    points.push({
      date,
      dominant,
      valenceAvg: Math.round(valenceAvg * 100) / 100,
      count: emotions.length,
    })
  }

  // Sort by date
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Detect patterns in emotional data
 */
function detectPatterns(points: EmotionTrendPoint[]): EmotionPattern[] {
  const patterns: EmotionPattern[] = []

  if (points.length < 3) return patterns

  // Emotion frequency pattern
  const emotionCounts: Record<string, number> = {}
  for (const point of points) {
    emotionCounts[point.dominant] = (emotionCounts[point.dominant] ?? 0) + point.count
  }

  const totalCount = Object.values(emotionCounts).reduce((a, b) => a + b, 0)
  const dominantEmotion = Object.entries(emotionCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] as EmotionCategory | undefined

  if (dominantEmotion && totalCount > 0) {
    const percentage = Math.round((emotionCounts[dominantEmotion] / totalCount) * 100)
    if (percentage > 40) {
      patterns.push({
        type: 'emotion_frequency',
        description: `Your most common emotional state is "${dominantEmotion}" (${percentage}% of sessions)`,
        confidence: Math.min(0.9, points.length / 10),
        data: emotionCounts,
      })
    }
  }

  // Weekly pattern (check if certain days have different moods)
  const dayValences: Record<string, number[]> = {}
  for (const point of points) {
    const dayOfWeek = new Date(point.date).toLocaleDateString('en-US', { weekday: 'long' })
    if (!dayValences[dayOfWeek]) dayValences[dayOfWeek] = []
    dayValences[dayOfWeek].push(point.valenceAvg)
  }

  const dayAverages: Record<string, number> = {}
  for (const [day, valences] of Object.entries(dayValences)) {
    if (valences.length >= 2) {
      dayAverages[day] = valences.reduce((a, b) => a + b, 0) / valences.length
    }
  }

  if (Object.keys(dayAverages).length >= 3) {
    const bestDay = Object.entries(dayAverages).sort(([, a], [, b]) => b - a)[0]
    const worstDay = Object.entries(dayAverages).sort(([, a], [, b]) => a - b)[0]

    if (bestDay && worstDay && bestDay[1] - worstDay[1] > 0.3) {
      patterns.push({
        type: 'weekly',
        description: `You tend to feel better on ${bestDay[0]}s and more challenged on ${worstDay[0]}s`,
        confidence: 0.6,
        data: dayAverages,
      })
    }
  }

  return patterns
}

/**
 * Calculate overall mood stability
 */
function calculateStability(points: EmotionTrendPoint[]): number {
  if (points.length < 2) return 0.5

  // Calculate variance in valence
  const valences = points.map((p) => p.valenceAvg)
  const mean = valences.reduce((a, b) => a + b, 0) / valences.length
  const variance = valences.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / valences.length
  const stdDev = Math.sqrt(variance)

  // Convert to stability score (lower variance = higher stability)
  // stdDev of 0 = stability 1, stdDev of 1+ = stability 0
  return Math.max(0, 1 - stdDev)
}

/**
 * Get emotion trends and patterns
 */
export async function getEmotionTrends(): Promise<EmotionTrendResult> {
  const points = await getHistoricalEmotions()
  const patterns = detectPatterns(points)
  const stability = calculateStability(points)

  // Calculate overall mood from recent points (last 7 days)
  const recentPoints = points.slice(-7)
  let overallMood: EmotionCategory = 'neutral'

  if (recentPoints.length > 0) {
    const emotionCounts: Record<string, number> = {}
    for (const point of recentPoints) {
      emotionCounts[point.dominant] = (emotionCounts[point.dominant] ?? 0) + point.count
    }
    let maxCount = 0
    for (const [emotion, count] of Object.entries(emotionCounts)) {
      if (count > maxCount) {
        maxCount = count
        overallMood = emotion as EmotionCategory
      }
    }
  }

  return {
    points,
    patterns,
    overallMood,
    moodStability: Math.round(stability * 100) / 100,
  }
}

/**
 * Get wellness suggestions based on emotional patterns
 */
export function getWellnessSuggestions(
  trends: EmotionTrendResult
): Array<{ title: string; description: string; priority: number }> {
  const suggestions: Array<{ title: string; description: string; priority: number }> = []

  // Low stability = volatile moods
  if (trends.moodStability < 0.4) {
    suggestions.push({
      title: 'Consider mindfulness practices',
      description: 'Your mood has been fluctuating. Regular mindfulness or meditation may help stabilize your emotional state.',
      priority: 7,
    })
  }

  // Negative overall mood
  if (trends.overallMood === 'stress' || trends.overallMood === 'sadness' || trends.overallMood === 'anger') {
    suggestions.push({
      title: 'Take time for self-care',
      description: `You've been experiencing more ${trends.overallMood} lately. Consider activities that bring you joy or talking to someone you trust.`,
      priority: 8,
    })
  }

  // Pattern-based suggestions
  for (const pattern of trends.patterns) {
    if (pattern.type === 'weekly' && pattern.data) {
      const worstDay = Object.entries(pattern.data).sort(([, a], [, b]) => a - b)[0]
      if (worstDay) {
        suggestions.push({
          title: `Plan ahead for ${worstDay[0]}s`,
          description: `${worstDay[0]}s tend to be more challenging for you. Consider scheduling easier tasks or self-care activities on these days.`,
          priority: 5,
        })
      }
    }
  }

  return suggestions.sort((a, b) => b.priority - a.priority)
}

export type { EmotionTrendPoint, EmotionPattern, EmotionTrendResult }
