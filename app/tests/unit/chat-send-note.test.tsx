import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
// OpenLoopsProvider is imported dynamically with Chat to avoid module duplication across vi.resetModules.

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
    start() {}
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
    onTranscriptUpdate: null,
    onStatus: null,
    onBargeIn: null,
  }
  return { liveAudioService: service }
})

vi.mock('../../src/services/memoryContext', () => ({
  buildMemoryContext: vi.fn().mockResolvedValue({ systemPrompt: 'test prompt' }),
}))

vi.mock('../../src/api/backend', () => ({
  hasBackend: true,
  startConversation: vi.fn(() => Promise.resolve({ data: { startedAt: 't' } })),
  endConversation: vi.fn(() => Promise.resolve({ data: { summary: '' } })),
  confirmActions: vi.fn(() => Promise.resolve({ data: { ids: [] } })),
  commitSessionToFirestore: vi.fn(() => Promise.resolve()),
  getGeminiSessionKey: vi.fn(() => Promise.resolve({ data: { jwe: 'jwe' } })),
  getSessionToken: vi.fn(() => 'token'),
  getActiveConversation: vi.fn(() => Promise.resolve({ data: { conversation: null } })),
  getConversationTranscript: vi.fn(() => Promise.resolve({ data: { turns: [] } })),
  appendConversationTurn: vi.fn(() => Promise.resolve({ data: { updated: true } })),
}))

async function renderChat() {
  const [{ default: Chat }, { OpenLoopsProvider }] = await Promise.all([
    import('../../src/pages/Chat'),
    import('../../src/openloops/OpenLoopsProvider'),
  ])

  return render(
    <OpenLoopsProvider>
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    </OpenLoopsProvider>,
  )
}

describe('Chat send note', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DISABLE_LIVE_AUDIO', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('sends a typed note on Enter and shows it in the user transcript', async () => {
    const user = userEvent.setup()
    await renderChat()

    const input = screen.getByPlaceholderText('Type a note...')
    await user.type(input, 'Hello note{enter}')

    expect(screen.getByText('Hello note')).toBeInTheDocument()
  })

  it('sends a typed note on Send button click', async () => {
    const user = userEvent.setup()
    await renderChat()

    const input = screen.getByPlaceholderText('Type a note...')
    await user.type(input, 'Click note')
    await user.click(screen.getByLabelText('Send note'))

    expect(screen.getByText('Click note')).toBeInTheDocument()
  })
})
