import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeBatch, setDoc } from 'firebase/firestore'
import {
  startConversation,
  endConversation,
  upsertClaimForAgent,
  appendConversationClaim,
  confirmActions,
  commitSessionToFirestore,
} from '../../src/api/backend'
import { clearStore } from '../../src/api/localStore'
import { isDeferring, stopDeferring } from '../../src/services/firestoreWriteGate'

vi.mock('@google/genai', () => {
  class GoogleGenAI {
    models = {
      generateContent: vi.fn(async () => ({
        text: 'Test summary',
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

describe('commitSessionToFirestore', () => {
  beforeEach(() => {
    clearStore()
    window.localStorage.clear()
    stopDeferring()
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key')
    vi.stubEnv('VITE_DISABLE_AI', 'false')
    setSessionUser('commit-user')
    vi.mocked(setDoc).mockClear()

    // Reset writeBatch mock
    const batchMock = vi.mocked(writeBatch)
    batchMock.mockClear()
    const mockBatchInstance = batchMock.getMockImplementation()?.() ?? batchMock({} as never)
    if (mockBatchInstance && typeof mockBatchInstance === 'object') {
      vi.mocked(mockBatchInstance.set).mockClear()
      vi.mocked(mockBatchInstance.commit).mockClear()
    }
  })

  afterEach(() => {
    stopDeferring()
    vi.unstubAllEnvs()
  })

  it('batch-writes conversation, claims, and actions to Firestore', async () => {
    // Set up a session: start conversation, add claims and actions
    await startConversation('conv-commit-1')

    // Deferring is now active — Firestore writes should be skipped
    expect(isDeferring()).toBe(true)

    // Add a claim (goes to localStorage only, syncDoc gated)
    await upsertClaimForAgent({
      text: 'Loves hiking',
      category: 'preferences',
      confidence: 0.9,
      evidence: ['I go hiking every weekend'],
      status: 'inferred',
      conversationId: 'conv-commit-1',
    })
    await appendConversationClaim('conv-commit-1', 'claim-injected')

    // End conversation (localStorage update, syncDoc gated)
    await endConversation('conv-commit-1', [
      { speaker: 'user', text: 'I love hiking', t_ms: 1 },
    ])

    // Confirm actions (localStorage update, syncDoc gated)
    await confirmActions('conv-commit-1', [
      { title: 'Plan weekend hike', dueWindow: 'This Week', source: 'conversation', reminder: false },
    ])

    // No Firestore setDoc calls should have happened
    const setDocCalls = vi.mocked(setDoc).mock.calls
    expect(setDocCalls.length).toBe(0)

    // Now commit the session
    await commitSessionToFirestore('conv-commit-1')

    // After commit, deferring should be off
    expect(isDeferring()).toBe(false)

    // writeBatch should have been called
    const batchCalls = vi.mocked(writeBatch).mock.calls
    expect(batchCalls.length).toBe(1)

    // The batch instance's set method should have been called for:
    // - conversation doc
    // - action(s)
    // - memorySummary on user profile
    const batchInstance = vi.mocked(writeBatch).mock.results[0]?.value
    if (batchInstance) {
      const setCalls = vi.mocked(batchInstance.set).mock.calls
      expect(setCalls.length).toBeGreaterThanOrEqual(2) // at least conversation + action
    }
  })

  it('stopDeferring is called after commit', async () => {
    await startConversation('conv-commit-2')
    expect(isDeferring()).toBe(true)

    await commitSessionToFirestore('conv-commit-2')
    expect(isDeferring()).toBe(false)
  })

  it('handles empty session gracefully', async () => {
    await startConversation('conv-commit-empty')
    expect(isDeferring()).toBe(true)

    // Commit with no claims/actions
    await commitSessionToFirestore('conv-commit-empty')
    expect(isDeferring()).toBe(false)

    // Should still have called writeBatch
    expect(vi.mocked(writeBatch)).toHaveBeenCalled()
  })
})
