import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'

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
    start() {}
    stop() {}
  }

  class ActionPublishAgent {
    constructor(private sink: (a: any) => void) {}

    start() {
      this.sink({ title: 'Action 1', dueWindow: 'Today' })
      this.sink({ title: 'Action 2', dueWindow: 'Today' })
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

const getStoredLoopTitles = () => {
  const raw = window.localStorage.getItem('openLoops')
  if (!raw) return []
  const parsed = JSON.parse(raw) as Array<{ title?: string }>
  return parsed.map((loop) => loop.title).filter(Boolean)
}

describe('Chat action bar interactions', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    vi.stubEnv('VITE_DISABLE_LIVE_AUDIO', 'false')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('Accept creates an open loop and removes the action from the bar', async () => {
    const user = userEvent.setup()
    await renderChat()

    await user.click(screen.getByLabelText('Microphone'))

    expect(await screen.findByText('Action 1')).toBeInTheDocument()

    // Click add button to open permission selector
    await user.click(screen.getByLabelText('Add Action 1'))

    // Click "Suggest Only" option in permission selector
    await user.click(await screen.findByText('Suggest Only'))

    await waitFor(() => {
      expect(getStoredLoopTitles()).toContain('Action 1')
    })

    await waitFor(() => {
      expect(screen.queryByText('Action 1')).not.toBeInTheDocument()
    })
  })

  it('Dismiss does not create an open loop and removes the action from the bar', async () => {
    const user = userEvent.setup()
    await renderChat()

    await user.click(screen.getByLabelText('Microphone'))

    expect(await screen.findByText('Action 1')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Dismiss Action 1'))

    await waitFor(() => {
      expect(getStoredLoopTitles()).not.toContain('Action 1')
    })

    await waitFor(() => {
      expect(screen.queryByText('Action 1')).not.toBeInTheDocument()
    })
  })
})
