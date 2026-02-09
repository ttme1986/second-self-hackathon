import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'

vi.mock('../../src/agents', () => {
  class AnalyzerAgent {
    start() {}
    stop() {}
  }

  class ValidatorAgent {
    start() {}
    stop() {}
  }

  class ActionPublishAgent {
    constructor(private sink: (a: any) => void) {}

    start() {
      for (let index = 1; index <= 5; index += 1) {
        this.sink({ title: `Action ${index}`, dueWindow: 'Today' })
      }
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

describe('Chat action bar remaining count', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    vi.stubEnv('VITE_DISABLE_LIVE_AUDIO', 'false')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('shows one action at a time and a remaining badge for the rest', async () => {
    const user = userEvent.setup()
    await renderChat()

    await user.click(screen.getByLabelText('Microphone'))

    expect(await screen.findByText('Action 1')).toBeInTheDocument()
    expect(screen.queryByText('Action 2')).not.toBeInTheDocument()
    expect(screen.queryByText('Action 3')).not.toBeInTheDocument()
    expect(screen.queryByText('Action 4')).not.toBeInTheDocument()
    expect(screen.queryByText('Action 5')).not.toBeInTheDocument()
    expect(screen.getByLabelText('4 more pending actions')).toBeInTheDocument()
    expect(screen.getByText('+4')).toBeInTheDocument()
  })
})
