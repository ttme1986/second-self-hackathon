import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/backend', () => ({
  listConversations: vi.fn(),
}))

import { getEmotionTrends, getWellnessSuggestions, type EmotionTrendResult } from '../../src/services/emotionTracker'
import { listConversations } from '../../src/api/backend'

const mockListConversations = vi.mocked(listConversations)

describe('emotionTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListConversations.mockResolvedValue({ data: { items: [] } })
  })

  describe('getEmotionTrends', () => {
    it('returns empty trends for no conversations', async () => {
      const result = await getEmotionTrends()

      expect(result.points).toEqual([])
      expect(result.patterns).toEqual([])
      expect(result.overallMood).toBe('neutral')
      expect(result.moodStability).toBe(0.5)
    })

    it('detects joy from happy conversation summaries', async () => {
      mockListConversations.mockResolvedValue({
        data: {
          items: [
            { id: 'c1', summary: 'User was very happy about a promotion', startedAt: '2025-03-01T10:00:00Z', endedAt: '2025-03-01T10:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
            { id: 'c2', summary: 'Excited about an upcoming trip', startedAt: '2025-03-01T14:00:00Z', endedAt: '2025-03-01T14:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
          ],
        },
      })

      const result = await getEmotionTrends()

      expect(result.points).toHaveLength(1)
      expect(result.points[0].dominant).toBe('joy')
      expect(result.points[0].valenceAvg).toBe(0.7)
      expect(result.overallMood).toBe('joy')
    })

    it('detects stress from stressed conversation summaries', async () => {
      mockListConversations.mockResolvedValue({
        data: {
          items: [
            { id: 'c1', summary: 'User felt stressed about deadlines', startedAt: '2025-03-01T10:00:00Z', endedAt: '2025-03-01T10:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
            { id: 'c2', summary: 'Anxious about upcoming presentation', startedAt: '2025-03-01T14:00:00Z', endedAt: '2025-03-01T14:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
          ],
        },
      })

      const result = await getEmotionTrends()

      expect(result.points).toHaveLength(1)
      expect(result.points[0].dominant).toBe('stress')
      expect(result.points[0].valenceAvg).toBe(-0.5)
      expect(result.overallMood).toBe('stress')
    })

    it('aggregates emotions by date correctly', async () => {
      mockListConversations.mockResolvedValue({
        data: {
          items: [
            { id: 'c1', summary: 'Happy morning', startedAt: '2025-03-01T10:00:00Z', endedAt: '2025-03-01T10:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
            { id: 'c2', summary: 'Calm evening', startedAt: '2025-03-02T18:00:00Z', endedAt: '2025-03-02T18:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
          ],
        },
      })

      const result = await getEmotionTrends()

      expect(result.points).toHaveLength(2)
      expect(result.points[0].date).toBe('2025-03-01')
      expect(result.points[0].dominant).toBe('joy')
      expect(result.points[1].date).toBe('2025-03-02')
      expect(result.points[1].dominant).toBe('calm')
    })

    it('skips conversations without startedAt', async () => {
      mockListConversations.mockResolvedValue({
        data: {
          items: [
            { id: 'c1', summary: 'Happy conversation', startedAt: '', endedAt: '', durationMs: 0, claimIds: [], confirmedActionIds: [] },
            { id: 'c2', summary: 'A great day', startedAt: '2025-03-01T10:00:00Z', endedAt: '2025-03-01T10:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
          ],
        },
      })

      const result = await getEmotionTrends()

      expect(result.points).toHaveLength(1)
      expect(result.points[0].dominant).toBe('joy')
    })

    it('detects emotion_frequency pattern when one emotion dominates', async () => {
      // Need at least 3 points for patterns
      mockListConversations.mockResolvedValue({
        data: {
          items: [
            { id: 'c1', summary: 'User was happy today', startedAt: '2025-03-01T10:00:00Z', endedAt: '2025-03-01T10:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
            { id: 'c2', summary: 'Excited about progress', startedAt: '2025-03-02T10:00:00Z', endedAt: '2025-03-02T10:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
            { id: 'c3', summary: 'Great news at work', startedAt: '2025-03-03T10:00:00Z', endedAt: '2025-03-03T10:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
          ],
        },
      })

      const result = await getEmotionTrends()

      expect(result.patterns.length).toBeGreaterThanOrEqual(1)
      const freqPattern = result.patterns.find((p) => p.type === 'emotion_frequency')
      expect(freqPattern).toBeDefined()
      expect(freqPattern!.description).toContain('joy')
      expect(freqPattern!.description).toContain('100%')
    })

    it('handles mix of conversations with and without stored emotionalStates', async () => {
      mockListConversations.mockResolvedValue({
        data: {
          items: [
            {
              id: 'c1',
              summary: 'User was happy',
              startedAt: '2025-03-01T10:00:00Z',
              endedAt: '2025-03-01T10:30:00Z',
              durationMs: 1800000,
              claimIds: [],
              confirmedActionIds: [],
              // No emotionalStates - will use keyword fallback
            },
            {
              id: 'c2',
              summary: 'Generic chat about nothing emotional',
              startedAt: '2025-03-02T10:00:00Z',
              endedAt: '2025-03-02T10:30:00Z',
              durationMs: 1800000,
              claimIds: [],
              confirmedActionIds: [],
              emotionalStates: [
                { primary: 'stress', valence: -0.6, intensity: 0.8, confidence: 0.9 },
              ],
            },
          ],
        },
      })

      const result = await getEmotionTrends()

      expect(result.points).toHaveLength(2)
      // First conversation: keyword fallback -> joy
      expect(result.points[0].dominant).toBe('joy')
      expect(result.points[0].valenceAvg).toBe(0.7)
      // Second conversation: stored emotional state -> stress
      expect(result.points[1].dominant).toBe('stress')
      expect(result.points[1].valenceAvg).toBe(-0.6)
    })

    it('aggregates multiple stored emotionalStates per conversation on same date', async () => {
      mockListConversations.mockResolvedValue({
        data: {
          items: [
            {
              id: 'c1',
              summary: 'Session 1',
              startedAt: '2025-03-01T10:00:00Z',
              endedAt: '2025-03-01T10:30:00Z',
              durationMs: 1800000,
              claimIds: [],
              confirmedActionIds: [],
              emotionalStates: [
                { primary: 'joy', valence: 0.8, intensity: 0.7, confidence: 0.9 },
                { primary: 'calm', valence: 0.4, intensity: 0.3, confidence: 0.8 },
                { primary: 'joy', valence: 0.6, intensity: 0.5, confidence: 0.85 },
              ],
            },
          ],
        },
      })

      const result = await getEmotionTrends()

      expect(result.points).toHaveLength(1)
      // Dominant: joy (2 occurrences) beats calm (1 occurrence)
      expect(result.points[0].dominant).toBe('joy')
      // Valence average: (0.8 + 0.4 + 0.6) / 3 = 0.6
      expect(result.points[0].valenceAvg).toBe(0.6)
      expect(result.points[0].count).toBe(3)
    })

    it('returns neutral for unrecognized summaries', async () => {
      mockListConversations.mockResolvedValue({
        data: {
          items: [
            { id: 'c1', summary: 'Discussed the weather forecast', startedAt: '2025-03-01T10:00:00Z', endedAt: '2025-03-01T10:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
          ],
        },
      })

      const result = await getEmotionTrends()

      expect(result.points).toHaveLength(1)
      expect(result.points[0].dominant).toBe('neutral')
      expect(result.points[0].valenceAvg).toBe(0)
    })

    it('calculates stability correctly for uniform valences (high stability)', async () => {
      mockListConversations.mockResolvedValue({
        data: {
          items: [
            { id: 'c1', summary: 'Happy day', startedAt: '2025-03-01T10:00:00Z', endedAt: '2025-03-01T10:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
            { id: 'c2', summary: 'Excited about plans', startedAt: '2025-03-02T10:00:00Z', endedAt: '2025-03-02T10:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
          ],
        },
      })

      const result = await getEmotionTrends()

      // Both points have same valence (0.7) so stdDev = 0 => stability = 1.0
      expect(result.moodStability).toBe(1)
    })

    it('calculates lower stability for mixed emotions', async () => {
      mockListConversations.mockResolvedValue({
        data: {
          items: [
            { id: 'c1', summary: 'Very happy today', startedAt: '2025-03-01T10:00:00Z', endedAt: '2025-03-01T10:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
            { id: 'c2', summary: 'Felt sad about things', startedAt: '2025-03-02T10:00:00Z', endedAt: '2025-03-02T10:30:00Z', durationMs: 1800000, claimIds: [], confirmedActionIds: [] },
          ],
        },
      })

      const result = await getEmotionTrends()

      // Valences are 0.7 and -0.6, mean = 0.05, stdDev ~0.65 => stability ~0.35
      expect(result.moodStability).toBeLessThan(0.5)
    })
  })

  describe('getWellnessSuggestions', () => {
    it('returns empty suggestions for neutral stable mood', () => {
      const trends: EmotionTrendResult = {
        points: [],
        patterns: [],
        overallMood: 'neutral',
        moodStability: 0.8,
      }

      const suggestions = getWellnessSuggestions(trends)

      expect(suggestions).toEqual([])
    })

    it('suggests mindfulness for low stability', () => {
      const trends: EmotionTrendResult = {
        points: [],
        patterns: [],
        overallMood: 'neutral',
        moodStability: 0.3,
      }

      const suggestions = getWellnessSuggestions(trends)

      expect(suggestions).toHaveLength(1)
      expect(suggestions[0].title).toBe('Consider mindfulness practices')
      expect(suggestions[0].priority).toBe(7)
    })

    it('suggests self-care for negative mood (stress)', () => {
      const trends: EmotionTrendResult = {
        points: [],
        patterns: [],
        overallMood: 'stress',
        moodStability: 0.6,
      }

      const suggestions = getWellnessSuggestions(trends)

      expect(suggestions).toHaveLength(1)
      expect(suggestions[0].title).toBe('Take time for self-care')
      expect(suggestions[0].description).toContain('stress')
      expect(suggestions[0].priority).toBe(8)
    })

    it('provides both suggestions when mood is negative and unstable', () => {
      const trends: EmotionTrendResult = {
        points: [],
        patterns: [],
        overallMood: 'anger',
        moodStability: 0.2,
      }

      const suggestions = getWellnessSuggestions(trends)

      expect(suggestions).toHaveLength(2)
      // Sorted by priority descending: self-care (8) then mindfulness (7)
      expect(suggestions[0].title).toBe('Take time for self-care')
      expect(suggestions[1].title).toBe('Consider mindfulness practices')
    })

    it('adds weekly pattern suggestion when weekly data available', () => {
      const trends: EmotionTrendResult = {
        points: [],
        patterns: [
          {
            type: 'weekly',
            description: 'You tend to feel better on Fridays and more challenged on Mondays',
            confidence: 0.6,
            data: { Monday: -0.3, Friday: 0.5, Wednesday: 0.1 },
          },
        ],
        overallMood: 'neutral',
        moodStability: 0.7,
      }

      const suggestions = getWellnessSuggestions(trends)

      expect(suggestions).toHaveLength(1)
      expect(suggestions[0].title).toContain('Monday')
      expect(suggestions[0].priority).toBe(5)
    })

    it('returns suggestions sorted by priority descending', () => {
      const trends: EmotionTrendResult = {
        points: [],
        patterns: [
          {
            type: 'weekly',
            description: 'Worse on Mondays',
            confidence: 0.6,
            data: { Monday: -0.5, Friday: 0.3, Wednesday: 0.0 },
          },
        ],
        overallMood: 'stress',
        moodStability: 0.2,
      }

      const suggestions = getWellnessSuggestions(trends)

      // self-care (8), mindfulness (7), weekly (5)
      expect(suggestions.length).toBe(3)
      expect(suggestions[0].priority).toBeGreaterThanOrEqual(suggestions[1].priority)
      expect(suggestions[1].priority).toBeGreaterThanOrEqual(suggestions[2].priority)
    })
  })
})
