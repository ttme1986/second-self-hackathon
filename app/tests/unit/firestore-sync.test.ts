import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDoc, deleteDoc } from 'firebase/firestore'
import {
  startConversation,
  endConversation,
  upsertClaimForAgent,
  appendConversationClaim,
  updateProfile,
  confirmActions,
  createAction,
  updateAction,
  createClaim,
  updateClaim,
  resolveReviewQueue,
  createReviewQueue,
  createGoal,
  updateGoal,
  deleteGoal,
} from '../../src/api/backend'
import { clearStore } from '../../src/api/localStore'
import { stopDeferring } from '../../src/services/firestoreWriteGate'

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

describe('Firestore dual-write sync', () => {
  beforeEach(() => {
    clearStore()
    window.localStorage.clear()
    stopDeferring()
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key')
    vi.stubEnv('VITE_DISABLE_AI', 'false')
    setSessionUser('sync-user')
    vi.mocked(setDoc).mockClear()
    vi.mocked(deleteDoc).mockClear()
  })

  afterEach(() => {
    stopDeferring()
    vi.unstubAllEnvs()
  })

  it('startConversation activates deferring and skips syncDoc', async () => {
    await startConversation('conv-deferred-1')

    // syncDoc is gated — no setDoc calls should happen
    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.id === 'conv-deferred-1' && data?.status === 'active'
    })
    expect(syncCall).toBeUndefined()
  })

  it('syncDoc calls setDoc when not deferring', async () => {
    // Direct syncDoc call (not via startConversation which enables deferring)
    await upsertClaimForAgent({
      text: 'User likes coffee',
      category: 'preferences',
      confidence: 0.8,
      evidence: ['I love coffee'],
      status: 'inferred',
      conversationId: 'conv-1',
      embedding: [0.1, 0.2, 0.3],
    })

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.text === 'User likes coffee'
    })
    expect(syncCall).toBeDefined()
    const data = syncCall![1] as Record<string, unknown>
    expect(data.embedding).toBeUndefined()
    expect(data.text).toBe('User likes coffee')
    expect(data.confidence).toBe(0.8)
  })

  it('syncDoc skips setDoc during active session (deferring)', async () => {
    await startConversation('conv-deferred-2')
    vi.mocked(setDoc).mockClear()

    // These writes should be skipped because deferring is active
    await upsertClaimForAgent({
      text: 'User likes tea',
      category: 'preferences',
      confidence: 0.7,
      evidence: ['I drink tea'],
      status: 'inferred',
      conversationId: 'conv-deferred-2',
      embedding: [0.1, 0.2],
    })

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.text === 'User likes tea'
    })
    expect(syncCall).toBeUndefined()
  })

  it('syncDoc resumes after stopDeferring', async () => {
    await startConversation('conv-resume-1')
    stopDeferring()
    vi.mocked(setDoc).mockClear()

    await upsertClaimForAgent({
      text: 'User likes yoga',
      category: 'preferences',
      confidence: 0.9,
      evidence: ['I practice yoga'],
      status: 'inferred',
      conversationId: 'conv-resume-1',
      embedding: [0.3, 0.4],
    })

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.text === 'User likes yoga'
    })
    expect(syncCall).toBeDefined()
  })

  it('endConversation syncDoc calls are gated during session', async () => {
    await startConversation('conv-deferred-3')
    vi.mocked(setDoc).mockClear()

    await endConversation('conv-deferred-3', [
      { speaker: 'user', text: 'hello', t_ms: 1 },
      { speaker: 'assistant', text: 'hi', t_ms: 2 },
    ])

    // All syncDoc calls should be skipped because deferring is active
    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.id === 'conv-deferred-3' && data?.status === 'ended'
    })
    expect(syncCall).toBeUndefined()
  })

  it('fsAppendConversationClaim is gated during session', async () => {
    await startConversation('conv-claim-gated')
    vi.mocked(setDoc).mockClear()

    await appendConversationClaim('conv-claim-gated', 'claim-1')

    // setDoc should NOT be called because deferring is active
    const calls = vi.mocked(setDoc).mock.calls
    expect(calls.length).toBe(0)
  })

  it('syncDoc is called for updateProfile (not session-gated)', async () => {
    await updateProfile({ displayName: 'Sync User' })

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.displayName === 'Sync User'
    })
    expect(syncCall).toBeDefined()
  })

  it('syncDoc is called for confirmActions when not deferring', async () => {
    // Start conversation (enables deferring), then stop deferring
    await startConversation('conv-actions-sync')
    stopDeferring()
    vi.mocked(setDoc).mockClear()

    await confirmActions('conv-actions-sync', [
      { title: 'Buy groceries', dueWindow: 'Today', source: 'conversation', reminder: false },
    ])

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.title === 'Buy groceries'
    })
    expect(syncCall).toBeDefined()
  })

  it('syncDoc is called for createAction when not deferring', async () => {
    await createAction({
      title: 'New action',
      dueWindow: 'Today',
      source: 'test',
      reminder: false,
      status: 'suggested',
      conversationId: 'conv-1',
    })

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.title === 'New action'
    })
    expect(syncCall).toBeDefined()
  })

  it('syncDoc is called for updateAction when not deferring', async () => {
    const created = await createAction({
      title: 'Action to update',
      dueWindow: 'Today',
      source: 'test',
      reminder: false,
      status: 'suggested',
      conversationId: 'conv-1',
    })
    vi.mocked(setDoc).mockClear()

    await updateAction(created.data!.id, { status: 'completed' })

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.status === 'completed'
    })
    expect(syncCall).toBeDefined()
  })

  it('syncDoc is called for createClaim without embedding', async () => {
    await createClaim({
      text: 'User is a developer',
      category: 'skills',
      confidence: 0.9,
      evidence: ['I code daily'],
      status: 'inferred',
      conversationId: 'conv-1',
      embedding: [0.4, 0.5, 0.6],
    })

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.text === 'User is a developer'
    })
    expect(syncCall).toBeDefined()
    const data = syncCall![1] as Record<string, unknown>
    expect(data.embedding).toBeUndefined()
  })

  it('syncDoc is called for updateClaim without embedding', async () => {
    const created = await createClaim({
      text: 'Claim to update',
      category: 'other',
      confidence: 0.5,
      evidence: [],
      status: 'inferred',
      conversationId: 'conv-1',
    })
    vi.mocked(setDoc).mockClear()

    await updateClaim(created.data!.id, { status: 'confirmed', embedding: [0.1, 0.2] })

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.status === 'confirmed'
    })
    expect(syncCall).toBeDefined()
    const data = syncCall![1] as Record<string, unknown>
    expect(data.embedding).toBeUndefined()
  })

  it('syncDoc is called for resolveReviewQueue', async () => {
    const created = await createReviewQueue({
      conversationId: 'conv-1',
      status: 'pending',
    })
    vi.mocked(setDoc).mockClear()

    await resolveReviewQueue(created.data!.id, 'confirm-left')

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.resolution === 'confirm-left'
    })
    expect(syncCall).toBeDefined()
  })

  it('syncDoc is called for createReviewQueue', async () => {
    await createReviewQueue({
      conversationId: 'conv-1',
      status: 'pending',
      title: 'Test conflict',
    })

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.title === 'Test conflict'
    })
    expect(syncCall).toBeDefined()
  })

  it('syncDoc is called for createGoal when not deferring', async () => {
    await createGoal({
      title: 'Learn Rust',
      description: 'Master Rust programming',
      category: 'learning',
      status: 'active',
      progress: 0,
      targetDate: null,
    })

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.title === 'Learn Rust'
    })
    expect(syncCall).toBeDefined()
  })

  it('syncDoc is called for updateGoal when not deferring', async () => {
    const created = await createGoal({
      title: 'Goal to update',
      description: '',
      category: 'personal',
      status: 'active',
      progress: 0,
      targetDate: null,
    })
    vi.mocked(setDoc).mockClear()

    await updateGoal(created.data!.id, { progress: 75 })

    const calls = vi.mocked(setDoc).mock.calls
    const syncCall = calls.find((call) => {
      const data = call[1] as Record<string, unknown>
      return data?.progress === 75
    })
    expect(syncCall).toBeDefined()
  })

  it('deleteDocument calls deleteDoc for deleteGoal when not deferring', async () => {
    const created = await createGoal({
      title: 'Goal to delete',
      description: '',
      category: 'other',
      status: 'active',
      progress: 0,
      targetDate: null,
    })
    vi.mocked(deleteDoc).mockClear()

    await deleteGoal(created.data!.id)

    expect(vi.mocked(deleteDoc)).toHaveBeenCalled()
  })

  it('deleteDocument is gated during session', async () => {
    const created = await createGoal({
      title: 'Goal to keep',
      description: '',
      category: 'other',
      status: 'active',
      progress: 0,
      targetDate: null,
    })
    // startConversation activates deferring
    await startConversation('conv-gate-delete')
    vi.mocked(deleteDoc).mockClear()

    await deleteGoal(created.data!.id)

    expect(vi.mocked(deleteDoc)).not.toHaveBeenCalled()
  })
})
