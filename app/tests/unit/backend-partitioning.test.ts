import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createMoment,
  listMoments,
  createOpenLoop,
  listOpenLoops,
  createClaim,
  listClaims,
  listActions,
  confirmActions,
  startConversation,
} from '../../src/api/backend'
import { clearStore } from '../../src/api/localStore'

// Mock Gemini API only (external dependency)
vi.mock('@google/genai', () => {
  class GoogleGenAI {
    models = {
      generateContent: vi.fn(async () => ({
        text: 'Test response',
      })),
      embedContent: vi.fn(async () => ({
        embeddings: [{ values: [0.1, 0.2, 0.3] }],
      })),
    }
  }
  const Type = { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN' }
  const ThinkingLevel = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' }
  return { GoogleGenAI, Type, ThinkingLevel }
})

const setSessionUser = (uid: string) => {
  window.localStorage.setItem('sessionUser', JSON.stringify({ uid }))
}

describe('Per-user data partitioning', () => {
  beforeEach(() => {
    clearStore()
    window.localStorage.clear()
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key')
    vi.stubEnv('VITE_DISABLE_AI', 'false')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('filters moments by user ID', async () => {
    // User 1
    setSessionUser('user-1')
    await createMoment({ summary: 'User 1 moment' })

    // User 2
    setSessionUser('user-2')
    await createMoment({ summary: 'User 2 moment' })

    // Check User 1 view
    setSessionUser('user-1')
    const user1Moments = await listMoments()
    expect(user1Moments.data?.items).toHaveLength(1)
    expect(user1Moments.data?.items[0].summary).toBe('User 1 moment')

    // Check User 2 view
    setSessionUser('user-2')
    const user2Moments = await listMoments()
    expect(user2Moments.data?.items).toHaveLength(1)
    expect(user2Moments.data?.items[0].summary).toBe('User 2 moment')
  })

  it('filters open loops by user ID', async () => {
    setSessionUser('user-A')
    await createOpenLoop({ title: 'Task A' })

    setSessionUser('user-B')
    await createOpenLoop({ title: 'Task B' })

    setSessionUser('user-A')
    const loops = await listOpenLoops()
    expect(loops.data?.items).toHaveLength(1)
    expect(loops.data?.items[0].title).toBe('Task A')
  })

  it('filters claims and actions by user ID', async () => {
    setSessionUser('user-X')
    await startConversation('c1')
    await createClaim({
      text: 'Claim X',
      category: 'other',
      confidence: 1,
      evidence: [],
      status: 'confirmed',
      conversationId: 'c1',
    })
    await confirmActions('c1', [
      { title: 'Action X', dueWindow: 'Today', source: 'test', reminder: false },
    ])

    setSessionUser('user-Y')
    const claimsY = await listClaims()
    const actionsY = await listActions()
    expect(claimsY.data?.items).toHaveLength(0)
    expect(actionsY.data?.items).toHaveLength(0)

    setSessionUser('user-X')
    const claimsX = await listClaims()
    const actionsX = await listActions()
    expect(claimsX.data?.items).toHaveLength(1)
    expect(actionsX.data?.items).toHaveLength(1)
  })
})
