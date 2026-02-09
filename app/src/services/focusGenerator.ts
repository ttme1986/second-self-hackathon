import {
  listGoals,
  listActions,
  listConversations,
  type GoalRecord,
  type ActionRecord,
  type InsightRecord,
} from '../api/backend'
import { GoogleGenAI } from '@google/genai'
import type { GenerateContentConfig } from '@google/genai'
import { getEmotionTrends, getWellnessSuggestions } from './emotionTracker'

type FocusItem = {
  id: string
  title: string
  type: 'goal' | 'action' | 'milestone' | 'insight'
  priority: number
  context?: string
  linkedId?: string
  dueWindow?: string
}

type FocusGeneratorResult = {
  items: FocusItem[]
  greeting?: string
}

const getAiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.toString() ?? ''
  if (!apiKey) return null
  return new GoogleGenAI({ apiKey })
}

const isAiDisabled = () =>
  (import.meta.env.VITE_DISABLE_AI?.toString() ?? 'false').toLowerCase() === 'true'

const generateText = async (prompt: string, model: string, extraConfig?: Partial<GenerateContentConfig>) => {
  if (isAiDisabled()) throw new Error('AI disabled')
  const client = getAiClient()
  if (!client) throw new Error('Gemini API key missing')
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: { temperature: 1.0, ...extraConfig },
  })
  const meta = response.usageMetadata
  if (meta?.cachedContentTokenCount) {
    const pct = ((meta.cachedContentTokenCount / (meta.promptTokenCount ?? 1)) * 100).toFixed(1)
    console.debug(`[cache] focusGenerator: ${meta.cachedContentTokenCount}/${meta.promptTokenCount} tokens cached (${pct}%)`)
  }
  return response.text ?? ''
}

/**
 * Get due milestones from active goals
 */
function getDueMilestones(goals: GoalRecord[]): FocusItem[] {
  const items: FocusItem[] = []

  for (const goal of goals) {
    if (goal.status !== 'active') continue

    // Get incomplete milestones
    const incompleteMilestones = goal.milestones.filter((m) => !m.completed)

    // Add the first incomplete milestone as a focus item
    if (incompleteMilestones.length > 0) {
      const nextMilestone = incompleteMilestones[0]
      items.push({
        id: `milestone-${nextMilestone.id}`,
        title: nextMilestone.title,
        type: 'milestone',
        priority: goal.progress < 50 ? 7 : 5, // Higher priority for less progressed goals
        context: `Goal: ${goal.title} (${goal.progress}% complete)`,
        linkedId: goal.id,
      })
    }
  }

  return items
}

/**
 * Get actions due today or this week
 */
function getDueActions(actions: ActionRecord[]): FocusItem[] {
  const items: FocusItem[] = []
  const activeStatuses = ['confirmed', 'approved', 'suggested']

  for (const action of actions) {
    if (!activeStatuses.includes(action.status)) continue

    const priority = action.dueWindow === 'Today' ? 9 : action.dueWindow === 'This Week' ? 6 : 3

    items.push({
      id: `action-${action.id}`,
      title: action.title,
      type: 'action',
      priority,
      context: action.context,
      linkedId: action.id,
      dueWindow: action.dueWindow,
    })
  }

  return items
}

/**
 * Get goals that need attention (low progress, no recent check-ins)
 */
function getGoalsNeedingAttention(goals: GoalRecord[]): FocusItem[] {
  const items: FocusItem[] = []
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  for (const goal of goals) {
    if (goal.status !== 'active') continue

    // Check if goal has had a check-in recently
    const lastCheckIn = goal.checkIns[goal.checkIns.length - 1]
    const needsCheckIn = !lastCheckIn || new Date(lastCheckIn.timestamp) < oneWeekAgo

    if (needsCheckIn && goal.progress < 100) {
      items.push({
        id: `goal-checkin-${goal.id}`,
        title: `Check in on: ${goal.title}`,
        type: 'goal',
        priority: goal.progress < 30 ? 8 : 5,
        context: `${goal.progress}% complete - ${needsCheckIn ? 'No recent check-in' : ''}`,
        linkedId: goal.id,
      })
    }
  }

  return items
}

/**
 * Generate personalized greeting based on time of day
 */
function generateGreeting(displayName?: string): string {
  const hour = new Date().getHours()
  const name = displayName || 'there'

  if (hour < 12) {
    return `Good morning, ${name}!`
  } else if (hour < 17) {
    return `Good afternoon, ${name}!`
  } else {
    return `Good evening, ${name}!`
  }
}

/**
 * Use AI to prioritize and filter focus items
 */
async function prioritizeWithAI(items: FocusItem[]): Promise<FocusItem[]> {
  if (items.length <= 3) return items.slice(0, 5)

  const prompt = [
    'You are helping prioritize a user\'s daily focus items.',
    'Given the following items, return the top 3-5 most important ones.',
    'Consider urgency, importance, and balance across different areas.',
    'Return ONLY a JSON array of item IDs in priority order.',
    'Example: ["action-123", "milestone-456", "goal-checkin-789"]',
    '',
    'Items:',
    JSON.stringify(items.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      priority: item.priority,
      dueWindow: item.dueWindow,
      context: item.context,
    }))),
  ].join('\n')

  try {
    const text = await generateText(prompt, 'gemini-3-flash-preview', {
      tools: [{ codeExecution: {} }],
    })
    const prioritizedIds = JSON.parse(text) as string[]

    // Return items in the order specified by AI
    const result: FocusItem[] = []
    for (const id of prioritizedIds.slice(0, 5)) {
      const item = items.find((i) => i.id === id)
      if (item) result.push(item)
    }

    // If AI returned fewer than expected, fill with high-priority items
    if (result.length < 3) {
      const remaining = items
        .filter((i) => !result.some((r) => r.id === i.id))
        .sort((a, b) => b.priority - a.priority)
      result.push(...remaining.slice(0, 5 - result.length))
    }

    return result
  } catch {
    // Fallback to simple priority sorting
    return items.sort((a, b) => b.priority - a.priority).slice(0, 5)
  }
}

/**
 * Generate today's focus items
 */
export async function generateTodaysFocus(
  displayName?: string
): Promise<FocusGeneratorResult> {
  // Fetch data
  const [goalsRes, actionsRes] = await Promise.all([
    listGoals('active'),
    listActions(['confirmed', 'approved', 'suggested']),
  ])

  const goals = goalsRes.data?.items ?? []
  const actions = actionsRes.data?.items ?? []

  // Collect all potential focus items
  const allItems: FocusItem[] = [
    ...getDueMilestones(goals),
    ...getDueActions(actions),
    ...getGoalsNeedingAttention(goals),
  ]

  // If no items, return empty with greeting
  if (allItems.length === 0) {
    return {
      items: [],
      greeting: generateGreeting(displayName),
    }
  }

  // Prioritize items
  const prioritized = await prioritizeWithAI(allItems)

  return {
    items: prioritized,
    greeting: generateGreeting(displayName),
  }
}

/**
 * Compute proactive insights dynamically based on user data.
 * Insights are not stored - they are computed on-the-fly from claims, goals, and conversations.
 */
export async function computeInsights(): Promise<InsightRecord[]> {
  // Fetch data for insight generation
  const [goalsRes, actionsRes, conversationsRes] = await Promise.all([
    listGoals(),
    listActions(),
    listConversations(),
  ])

  const goals = goalsRes.data?.items ?? []
  const actions = actionsRes.data?.items ?? []
  const conversations = conversationsRes.data?.items ?? []

  const insights: InsightRecord[] = []
  let idCounter = 1

  const createId = () => `insight-${idCounter++}`

  // Goal progress insights
  for (const goal of goals) {
    if (goal.status !== 'active') continue

    // Goal at risk - low progress with approaching deadline
    if (goal.progress < 30 && goal.targetDate) {
      const targetDate = new Date(goal.targetDate)
      const daysLeft = Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

      if (daysLeft > 0 && daysLeft < 30) {
        insights.push({
          id: createId(),
          type: 'goal_progress',
          title: 'Goal needs attention',
          content: `Your goal "${goal.title}" is at ${goal.progress}% with ${daysLeft} days until your target date.`,
          reasoning: 'Low progress with approaching deadline suggests this needs prioritization.',
          linkedEntityId: goal.id,
          linkedEntityType: 'goal',
          actionLabel: 'View Goal',
          priority: 8,
          status: 'active',
        })
      }
    }

    // Goal making great progress
    if (goal.progress >= 75 && goal.progress < 100) {
      insights.push({
        id: createId(),
        type: 'goal_progress',
        title: 'Almost there!',
        content: `You're ${goal.progress}% of the way to completing "${goal.title}". Keep up the momentum!`,
        reasoning: 'High progress goals are close to completion - a final push could finish them.',
        linkedEntityId: goal.id,
        linkedEntityType: 'goal',
        actionLabel: 'Complete Goal',
        priority: 6,
        status: 'active',
      })
    }
  }

  // Pattern detection - multiple actions of same type
  const actionsByType = actions.reduce((acc, action) => {
    const type = action.actionType ?? 'general'
    acc[type] = (acc[type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  for (const [type, count] of Object.entries(actionsByType)) {
    if (count >= 3) {
      insights.push({
        id: createId(),
        type: 'pattern',
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} tasks accumulating`,
        content: `You have ${count} ${type} tasks pending. Consider batching them together.`,
        reasoning: 'Batching similar tasks can improve efficiency.',
        priority: 5,
        status: 'active',
      })
      break // Only one pattern insight at a time
    }
  }

  // Memory surfacing - anniversaries and recurring themes
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10)

  for (const conversation of conversations) {
    if (!conversation.startedAt) continue
    const convDate = conversation.startedAt.slice(0, 10)

    if (convDate === oneYearAgoStr && conversation.summary) {
      insights.push({
        id: createId(),
        type: 'memory',
        title: 'This day last year',
        content: conversation.summary,
        reasoning: 'Reflecting on past conversations can provide perspective and continuity.',
        linkedEntityId: conversation.id,
        linkedEntityType: 'conversation',
        actionLabel: 'View Memory',
        priority: 4,
        status: 'active',
      })
      break // Only one memory insight
    }
  }

  // Wellness insights based on emotional patterns
  try {
    const emotionTrends = await getEmotionTrends()
    const wellnessSuggestions = getWellnessSuggestions(emotionTrends)

    // Only add wellness insight if there's enough emotional data
    if (emotionTrends.points.length >= 3 && wellnessSuggestions.length > 0) {
      const topSuggestion = wellnessSuggestions[0]

      // Check if overall mood is concerning (stress, sadness, anger)
      const concerningMoods = ['stress', 'sadness', 'anger', 'fear']
      const isConcerning = concerningMoods.includes(emotionTrends.overallMood)

      if (isConcerning || emotionTrends.moodStability < 0.4) {
        insights.push({
          id: createId(),
          type: 'wellness',
          title: topSuggestion.title,
          content: topSuggestion.description,
          reasoning: `Based on your recent emotional patterns: ${
            isConcerning
              ? `You've been experiencing more ${emotionTrends.overallMood} lately.`
              : 'Your mood has been fluctuating more than usual.'
          }${emotionTrends.patterns.length > 0 ? ` ${emotionTrends.patterns[0].description}` : ''}`,
          actionLabel: 'Learn More',
          priority: topSuggestion.priority,
          status: 'active',
        })
      }
    }
  } catch (error) {
    console.error('Failed to generate wellness insights:', error)
  }

  // Sort by priority (highest first) and limit to 3
  return insights.sort((a, b) => b.priority - a.priority).slice(0, 3)
}

export type { FocusItem, FocusGeneratorResult }
