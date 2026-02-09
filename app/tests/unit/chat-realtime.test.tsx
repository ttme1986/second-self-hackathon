import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
// Chat is imported dynamically after mocks are applied.
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'
import { confirmActions, endConversation, createAction } from '../../src/api/backend'

vi.mock('../../src/profile/ProfileProvider', () => ({
  useOptionalProfile: () => ({
    profile: {
      uid: 'test-user',
      displayName: 'Test User',
      defaultActionPermission: 'suggest',
      actionPermissions: {},
    },
  }),
}))

vi.mock('../../src/agents', () => {
  class AnalyzerAgent {
    start() {}
    stop() {}
  }

  class ValidatorAgent {
    constructor(private onStoredClaim?: (c: any) => void) {}
    start() {
      // Immediately publish a claim to the UI.
      this.onStoredClaim?.({
        id: 'c1',
        text: 'Prefers tea',
        category: 'preferences',
        confidence: 0.7,
        evidence: ['Prefers tea'],
        status: 'inferred',
        conversationId: 'conv-1',
      })
    }
    stop() {}
  }

  class ActionPublishAgent {
    private interval: any = null

    constructor(private sink: (a: any) => void) {}

    start(blackboard: any) {
      // Immediately publish an action to the UI.
      this.sink({ title: 'Buy tea', dueWindow: 'Today' })

      // Consume user decision tasks so the blackboard can drain.
      this.interval = setInterval(() => {
        const task = blackboard?.take?.((t: any) => t?.type === 'action.user_decision')
        if (task) blackboard.complete(task)
      }, 10)
    }

    stop() {
      if (this.interval) clearInterval(this.interval)
      this.interval = null
    }
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
  createAction: vi.fn(() => Promise.resolve({ data: { id: 'action-1', action: {} } })),
  getGeminiSessionKey: vi.fn(() => Promise.resolve({ data: { jwe: 'jwe' } })),
  getSessionToken: vi.fn(() => 'token'),
  getActiveConversation: vi.fn(() => Promise.resolve({ data: { conversation: null } })),
  getConversationTranscript: vi.fn(() => Promise.resolve({ data: { turns: [] } })),
  appendConversationTurn: vi.fn(() => Promise.resolve({ data: { updated: true } })),
}))

vi.mock('../../src/services/actionExecutor', () => ({
  executeAction: vi.fn(() => Promise.resolve({ success: true, message: 'Done' })),
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

describe('Chat realtime (blackboard pipeline)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    vi.stubEnv('VITE_DISABLE_LIVE_AUDIO', 'false')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders inferred claim and suggested action during the call', async () => {
    const user = userEvent.setup()
    await renderChat()

    await user.click(screen.getByLabelText('Microphone'))

    // Knowledge banner shows the claim text
    expect(await screen.findByText('Prefers tea')).toBeInTheDocument()

    expect(screen.getByText('Buy tea')).toBeInTheDocument()
  })

  it(
    'shows backend summary in recap and confirms tapped actions',
    async () => {
    const user = userEvent.setup()
    await renderChat()

    await user.click(screen.getByLabelText('Microphone'))

    // Suggested action should be available - click to open permission selector
    await user.click(await screen.findByLabelText('Add Buy tea'))

    // Permission selector should appear - click "Suggest Only" to confirm
    await user.click(await screen.findByText('Suggest Only'))

    // Action should now be created
    await waitFor(() => {
      expect(createAction).toHaveBeenCalled()
    })

    await user.click(screen.getByLabelText('End session'))

    await waitFor(
      () => {
        expect(endConversation).toHaveBeenCalled()
      },
      { timeout: 5000 },
    )

    await screen.findByText('Backend summary', {}, { timeout: 10_000 })

    await user.click(screen.getByLabelText('Close recap'))

    await waitFor(() => {
      expect(confirmActions).toHaveBeenCalled()
    })
    expect(endConversation).toHaveBeenCalled()
    },
    15_000,
  )
})
