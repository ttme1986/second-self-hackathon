import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'

const actionEvidence =
  'User said they need to buy tea because they are running low and want to restock before the weekend starts.'
const claimEvidence =
  'User mentioned they prefer tea in the mornings and usually skip coffee unless they are traveling.'

const truncate = (value: string, max = 140) => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max).trim()}...`
}

const actionSnippet = truncate(actionEvidence)
const claimSnippet = truncate(claimEvidence)

vi.mock('../../src/agents', () => {
  class AnalyzerAgent {
    start() {}
    stop() {}
  }

  class ValidatorAgent {
    constructor(private onStoredClaim?: (c: any) => void) {}
    start() {
      this.onStoredClaim?.({
        id: 'c1',
        text: 'Prefers tea',
        category: 'preferences',
        confidence: 0.7,
        evidence: [claimEvidence],
        status: 'inferred',
        conversationId: 'conv-1',
      })
    }
    stop() {}
  }

  class ActionPublishAgent {
    constructor(private sink: (a: any) => void) {}
    start() {
      this.sink({ title: 'Buy tea', dueWindow: 'Today', evidence: [actionEvidence] })
    }
    stop() {}
  }

  return { AnalyzerAgent, ValidatorAgent, ActionPublishAgent }
})

vi.mock('../../src/services/liveAudioService', () => {
  const service = {
    connect: vi.fn().mockResolvedValue(undefined),
    connectTextOnly: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendText: vi.fn(),
    resumeAudio: vi.fn(),
    isAudioLocked: vi.fn(() => false),
    hasApiKey: vi.fn(() => true),
    setApiKey: vi.fn(),
    connected: false,
    onTranscriptUpdate: null as null | ((text: string, isUser: boolean, isFinal: boolean) => void),
    onStatus: null as null | ((status: string) => void),
    onBargeIn: null as null | (() => void),
  }
  return { liveAudioService: service }
})

vi.mock('../../src/services/memoryContext', () => ({
  buildMemoryContext: vi.fn().mockResolvedValue({ systemPrompt: 'test prompt' }),
}))

vi.mock('../../src/api/backend', () => ({
  hasBackend: true,
  startConversation: vi.fn(() => Promise.resolve({ data: { startedAt: 't' } })),
  endConversation: vi.fn(() => Promise.resolve({ data: { summary: 'Backend summary' } })),
  confirmActions: vi.fn(() => Promise.resolve({ data: { ids: ['a1'] } })),
  commitSessionToFirestore: vi.fn(() => Promise.resolve()),
  getGeminiSessionKey: vi.fn(() => Promise.resolve({ data: { jwe: 'jwe' } })),
  getSessionToken: vi.fn(() => 'token'),
  getActiveConversation: vi.fn(() => Promise.resolve({ data: { conversation: null } })),
  getConversationTranscript: vi.fn(() => Promise.resolve({ data: { turns: [] } })),
  appendConversationTurn: vi.fn(() => Promise.resolve({ data: { updated: true } })),
}))

async function renderChat() {
  const { default: Chat } = await import('../../src/pages/Chat')
  return render(
    <OpenLoopsProvider>
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    </OpenLoopsProvider>,
  )
}

describe('Chat evidence receipts', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    vi.stubEnv('VITE_DISABLE_LIVE_AUDIO', 'false')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('shows action title in action bar and claim in banner', async () => {
    const user = userEvent.setup()
    await renderChat()

    await user.click(screen.getByLabelText('Microphone'))

    // Action title appears in the action bar
    expect(await screen.findByText('Buy tea')).toBeInTheDocument()

    // Claim appears in the knowledge banner
    expect(screen.getByText('Prefers tea')).toBeInTheDocument()
  })
})
