import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { endConversation, startConversation, appendConversationTurn, type TranscriptTurn } from '../../src/api/backend'
import { clearStore, loadStore } from '../../src/api/localStore'

// Mock Gemini API only (external dependency)
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

describe('Conversation finalization reliability', () => {
  beforeEach(() => {
    clearStore()
    window.localStorage.clear()
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key')
    vi.stubEnv('VITE_DISABLE_AI', 'false')
    window.localStorage.setItem('sessionUser', JSON.stringify({ uid: 'test-user' }))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('preserves existing transcript if finalized with empty transcript', async () => {
    const id = 'conv-test-1'
    await startConversation(id)

    const turn: TranscriptTurn = { speaker: 'user', text: 'Hello', t_ms: 100 }
    await appendConversationTurn(id, turn)

    // End with empty transcript (simulating a race where frontend sends empty)
    const result = await endConversation(id, [])

    expect(result.data).toBeDefined()

    // Verify the transcript was preserved
    const store = loadStore()
    const userStore = store.users['test-user']
    expect(userStore?.conversations[id]).toBeDefined()
    expect(userStore?.conversations[id].transcript?.length).toBeGreaterThan(0)
  })

  it('updates transcript when finalized with non-empty transcript', async () => {
    const id = 'conv-test-2'
    await startConversation(id)

    const turns: TranscriptTurn[] = [
      { speaker: 'user', text: 'Hello', t_ms: 100 },
      { speaker: 'assistant', text: 'Hi there', t_ms: 200 },
    ]

    const result = await endConversation(id, turns)

    expect(result.data).toBeDefined()

    // Verify the transcript was updated
    const store = loadStore()
    const userStore = store.users['test-user']
    expect(userStore?.conversations[id]).toBeDefined()
    expect(userStore?.conversations[id].transcript?.length).toBe(2)
  })
})
