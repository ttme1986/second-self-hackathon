import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/backend', () => ({
  listGoals: vi.fn(),
  listActions: vi.fn(),
  listConversations: vi.fn(),
}))

vi.mock('../../src/services/emotionTracker', () => ({
  getEmotionTrends: vi.fn(),
  getWellnessSuggestions: vi.fn(),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: '[]' }),
    },
  })),
}))

import { generateTodaysFocus, computeInsights } from '../../src/services/focusGenerator'
import { listGoals, listActions, listConversations } from '../../src/api/backend'
import { getEmotionTrends, getWellnessSuggestions } from '../../src/services/emotionTracker'

const mockListGoals = vi.mocked(listGoals)
const mockListActions = vi.mocked(listActions)
const mockListConversations = vi.mocked(listConversations)
const mockGetEmotionTrends = vi.mocked(getEmotionTrends)
const mockGetWellnessSuggestions = vi.mocked(getWellnessSuggestions)

describe('focusGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListGoals.mockResolvedValue({ data: { items: [] } })
    mockListActions.mockResolvedValue({ data: { items: [] } })
    mockListConversations.mockResolvedValue({ data: { items: [] } })
    mockGetEmotionTrends.mockResolvedValue({
      points: [],
      patterns: [],
      overallMood: 'neutral',
      moodStability: 0.5,
    })
    mockGetWellnessSuggestions.mockReturnValue([])
  })

  describe('generateTodaysFocus', () => {
    it('returns empty items with greeting when no data exists', async () => {
      const result = await generateTodaysFocus('Alice')

      expect(result.items).toEqual([])
      expect(result.greeting).toBeDefined()
      expect(result.greeting).toContain('Alice')
    })

    it('returns greeting with "there" when no displayName', async () => {
      const result = await generateTodaysFocus()

      expect(result.greeting).toContain('there')
    })

    it('includes due actions sorted by priority', async () => {
      mockListActions.mockResolvedValue({
        data: {
          items: [
            { id: 'a1', title: 'Email boss', dueWindow: 'Today', status: 'confirmed', source: 'chat', reminder: false, conversationId: 'c1' },
            { id: 'a2', title: 'Buy groceries', dueWindow: 'This Week', status: 'approved', source: 'chat', reminder: false, conversationId: 'c1' },
            { id: 'a3', title: 'Plan vacation', dueWindow: 'This Month', status: 'suggested', source: 'chat', reminder: false, conversationId: 'c1' },
          ],
        },
      })

      const result = await generateTodaysFocus('Alice')

      expect(result.items.length).toBeGreaterThanOrEqual(1)
      // Items should be sorted by priority (Today=9 > This Week=6 > This Month=3)
      const priorities = result.items.map((i) => i.priority)
      for (let idx = 0; idx < priorities.length - 1; idx++) {
        expect(priorities[idx]).toBeGreaterThanOrEqual(priorities[idx + 1])
      }
    })

    it('includes milestones from active goals', async () => {
      mockListGoals.mockResolvedValue({
        data: {
          items: [
            {
              id: 'g1',
              title: 'Learn guitar',
              description: '',
              category: 'personal' as const,
              status: 'active' as const,
              progress: 20,
              targetDate: null,
              milestones: [
                { id: 'm1', title: 'Buy a guitar', completed: false },
                { id: 'm2', title: 'Learn chords', completed: false },
              ],
              checkIns: [],
              linkedActionIds: [],
              linkedClaimIds: [],
              createdAt: '',
              updatedAt: '',
            },
          ],
        },
      })

      const result = await generateTodaysFocus('Alice')

      const milestoneItems = result.items.filter((i) => i.type === 'milestone')
      expect(milestoneItems.length).toBeGreaterThanOrEqual(1)
      expect(milestoneItems[0].title).toBe('Buy a guitar')
    })

    it('includes goals needing check-in', async () => {
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

      mockListGoals.mockResolvedValue({
        data: {
          items: [
            {
              id: 'g1',
              title: 'Run a marathon',
              description: '',
              category: 'health' as const,
              status: 'active' as const,
              progress: 10,
              targetDate: null,
              milestones: [],
              checkIns: [
                { id: 'ck1', timestamp: twoWeeksAgo.toISOString(), status: 'behind' as const, notes: 'Need to train more', aiResponse: '' },
              ],
              linkedActionIds: [],
              linkedClaimIds: [],
              createdAt: '',
              updatedAt: '',
            },
          ],
        },
      })

      const result = await generateTodaysFocus('Alice')

      const goalItems = result.items.filter((i) => i.type === 'goal')
      expect(goalItems.length).toBeGreaterThanOrEqual(1)
      expect(goalItems[0].title).toContain('Check in on')
      expect(goalItems[0].title).toContain('Run a marathon')
    })

    it('excludes completed and non-active actions', async () => {
      mockListActions.mockResolvedValue({
        data: {
          items: [
            { id: 'a1', title: 'Done task', dueWindow: 'Today', status: 'completed', source: 'chat', reminder: false, conversationId: 'c1' },
            { id: 'a2', title: 'Dismissed task', dueWindow: 'Today', status: 'dismissed', source: 'chat', reminder: false, conversationId: 'c1' },
          ],
        },
      })

      const result = await generateTodaysFocus('Alice')

      expect(result.items).toEqual([])
    })
  })

  describe('computeInsights', () => {
    it('returns empty insights when no data', async () => {
      const insights = await computeInsights()

      expect(insights).toEqual([])
    })

    it('generates goal progress insight for at-risk goal', async () => {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + 15) // 15 days from now

      mockListGoals.mockResolvedValue({
        data: {
          items: [
            {
              id: 'g1',
              title: 'Ship feature',
              description: '',
              category: 'career' as const,
              status: 'active' as const,
              progress: 10,
              targetDate: targetDate.toISOString(),
              milestones: [],
              checkIns: [],
              linkedActionIds: [],
              linkedClaimIds: [],
              createdAt: '',
              updatedAt: '',
            },
          ],
        },
      })

      const insights = await computeInsights()

      const goalInsight = insights.find((i) => i.type === 'goal_progress')
      expect(goalInsight).toBeDefined()
      expect(goalInsight!.title).toBe('Goal needs attention')
      expect(goalInsight!.content).toContain('Ship feature')
      expect(goalInsight!.content).toContain('10%')
      expect(goalInsight!.priority).toBe(8)
    })

    it('generates "Almost there" insight for high-progress goal', async () => {
      mockListGoals.mockResolvedValue({
        data: {
          items: [
            {
              id: 'g1',
              title: 'Learn Spanish',
              description: '',
              category: 'learning' as const,
              status: 'active' as const,
              progress: 80,
              targetDate: null,
              milestones: [],
              checkIns: [],
              linkedActionIds: [],
              linkedClaimIds: [],
              createdAt: '',
              updatedAt: '',
            },
          ],
        },
      })

      const insights = await computeInsights()

      const goalInsight = insights.find((i) => i.title === 'Almost there!')
      expect(goalInsight).toBeDefined()
      expect(goalInsight!.content).toContain('80%')
      expect(goalInsight!.content).toContain('Learn Spanish')
      expect(goalInsight!.priority).toBe(6)
    })

    it('generates pattern insight when 3+ actions of same type', async () => {
      mockListActions.mockResolvedValue({
        data: {
          items: [
            { id: 'a1', title: 'Email A', actionType: 'email', dueWindow: 'Today', status: 'confirmed', source: 'chat', reminder: false, conversationId: 'c1' },
            { id: 'a2', title: 'Email B', actionType: 'email', dueWindow: 'Today', status: 'confirmed', source: 'chat', reminder: false, conversationId: 'c1' },
            { id: 'a3', title: 'Email C', actionType: 'email', dueWindow: 'Today', status: 'confirmed', source: 'chat', reminder: false, conversationId: 'c1' },
          ],
        },
      })

      const insights = await computeInsights()

      const patternInsight = insights.find((i) => i.type === 'pattern')
      expect(patternInsight).toBeDefined()
      expect(patternInsight!.title).toContain('Email')
      expect(patternInsight!.content).toContain('3')
      expect(patternInsight!.content).toContain('email')
    })

    it('generates wellness insight for concerning mood with enough data', async () => {
      mockGetEmotionTrends.mockResolvedValue({
        points: [
          { date: '2025-03-01', dominant: 'stress', valenceAvg: -0.5, count: 1 },
          { date: '2025-03-02', dominant: 'stress', valenceAvg: -0.4, count: 1 },
          { date: '2025-03-03', dominant: 'stress', valenceAvg: -0.6, count: 1 },
        ],
        patterns: [],
        overallMood: 'stress',
        moodStability: 0.3,
      })
      mockGetWellnessSuggestions.mockReturnValue([
        { title: 'Take a break', description: 'You have been stressed.', priority: 8 },
      ])

      const insights = await computeInsights()

      const wellnessInsight = insights.find((i) => i.type === 'wellness')
      expect(wellnessInsight).toBeDefined()
      expect(wellnessInsight!.title).toBe('Take a break')
    })

    it('limits insights to 3 sorted by priority', async () => {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + 10)

      mockListGoals.mockResolvedValue({
        data: {
          items: [
            { id: 'g1', title: 'Goal A', description: '', category: 'health' as const, status: 'active' as const, progress: 10, targetDate: targetDate.toISOString(), milestones: [], checkIns: [], linkedActionIds: [], linkedClaimIds: [], createdAt: '', updatedAt: '' },
            { id: 'g2', title: 'Goal B', description: '', category: 'career' as const, status: 'active' as const, progress: 85, targetDate: null, milestones: [], checkIns: [], linkedActionIds: [], linkedClaimIds: [], createdAt: '', updatedAt: '' },
            { id: 'g3', title: 'Goal C', description: '', category: 'finance' as const, status: 'active' as const, progress: 20, targetDate: targetDate.toISOString(), milestones: [], checkIns: [], linkedActionIds: [], linkedClaimIds: [], createdAt: '', updatedAt: '' },
            { id: 'g4', title: 'Goal D', description: '', category: 'learning' as const, status: 'active' as const, progress: 90, targetDate: null, milestones: [], checkIns: [], linkedActionIds: [], linkedClaimIds: [], createdAt: '', updatedAt: '' },
          ],
        },
      })

      const insights = await computeInsights()

      expect(insights.length).toBeLessThanOrEqual(3)
      // Verify sorted by priority descending
      for (let idx = 0; idx < insights.length - 1; idx++) {
        expect(insights[idx].priority).toBeGreaterThanOrEqual(insights[idx + 1].priority)
      }
    })

    it('skips non-active goals for progress insights', async () => {
      mockListGoals.mockResolvedValue({
        data: {
          items: [
            { id: 'g1', title: 'Paused goal', description: '', category: 'personal' as const, status: 'paused' as const, progress: 10, targetDate: null, milestones: [], checkIns: [], linkedActionIds: [], linkedClaimIds: [], createdAt: '', updatedAt: '' },
            { id: 'g2', title: 'Completed goal', description: '', category: 'personal' as const, status: 'completed' as const, progress: 100, targetDate: null, milestones: [], checkIns: [], linkedActionIds: [], linkedClaimIds: [], createdAt: '', updatedAt: '' },
          ],
        },
      })

      const insights = await computeInsights()

      const goalInsights = insights.filter((i) => i.type === 'goal_progress')
      expect(goalInsights).toHaveLength(0)
    })

    it('handles emotion tracker failure gracefully', async () => {
      mockGetEmotionTrends.mockRejectedValue(new Error('emotion tracker error'))

      // Should not throw, just skip wellness insights
      const insights = await computeInsights()

      const wellnessInsight = insights.find((i) => i.type === 'wellness')
      expect(wellnessInsight).toBeUndefined()
    })
  })
})
