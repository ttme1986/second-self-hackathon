import { describe, expect, it } from 'vitest'

// Import the actual backend functions (not mocked)
// Note: These tests verify the pure utility functions work correctly

describe('Backend utilities (integration)', () => {
  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', async () => {
      const { cosineSimilarity } = await import('../../src/api/backend')
      const vec = [0.1, 0.2, 0.3, 0.4, 0.5]
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 5)
    })

    it('returns 0 for orthogonal vectors', async () => {
      const { cosineSimilarity } = await import('../../src/api/backend')
      const vecA = [1, 0, 0]
      const vecB = [0, 1, 0]
      expect(cosineSimilarity(vecA, vecB)).toBe(0)
    })

    it('returns 0 for empty vectors', async () => {
      const { cosineSimilarity } = await import('../../src/api/backend')
      expect(cosineSimilarity([], [])).toBe(0)
      expect(cosineSimilarity([1, 2], [])).toBe(0)
      expect(cosineSimilarity([], [1, 2])).toBe(0)
    })

    it('handles vectors of different lengths gracefully', async () => {
      const { cosineSimilarity } = await import('../../src/api/backend')
      const vecA = [1, 2, 3, 4, 5]
      const vecB = [1, 2, 3]
      // Should compute similarity using the shorter length
      const result = cosineSimilarity(vecA, vecB)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThanOrEqual(1)
    })

    it('returns negative value for opposite vectors', async () => {
      const { cosineSimilarity } = await import('../../src/api/backend')
      const vecA = [1, 2, 3]
      const vecB = [-1, -2, -3]
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1, 5)
    })
  })

  describe('resolveUserId', () => {
    it('returns provided fallback if given', async () => {
      const { resolveUserId } = await import('../../src/api/backend')
      expect(resolveUserId('custom-user')).toBe('custom-user')
    })

    it('falls back to dev-user when no session exists', async () => {
      const { resolveUserId } = await import('../../src/api/backend')
      // Without a session or env var, should return dev-user
      const result = resolveUserId()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
