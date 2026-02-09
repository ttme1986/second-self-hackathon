import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'
import Chat from '../../src/pages/Chat'
import { liveAudioService } from '../../src/services/liveAudioService'
import * as backend from '../../src/api/backend'

vi.mock('../../src/agents', () => {
  class AnalyzerAgent { start() {} stop() {} }
  class ValidatorAgent { start() {} stop() {} }
  class ActionPublishAgent { start() {} stop() {} }
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
    onVoiceActivity: null as null | ((isSpeaking: boolean) => void),
    onAudioLevel: null as null | ((level: number) => void),
  }
  return { liveAudioService: service }
})

vi.mock('../../src/services/memoryContext', () => ({
  buildMemoryContext: vi.fn().mockResolvedValue({ systemPrompt: 'test prompt' }),
}))

vi.mock('../../src/services/storageUpload', () => ({
  isStorageAvailable: vi.fn(() => false),
  uploadSessionData: vi.fn(),
}))

vi.mock('../../src/api/backend', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/backend')>('../../src/api/backend')
  return {
    ...actual,
    hasBackend: true,
    startConversation: vi.fn(() => Promise.resolve({ data: { startedAt: 't' } })),
    endConversation: vi.fn(() => Promise.resolve({ data: { summary: 'Test summary' } })),
    confirmActions: vi.fn(() => Promise.resolve({ data: { ids: [] } })),
  commitSessionToFirestore: vi.fn(() => Promise.resolve()),
    getGeminiSessionKey: vi.fn(() => Promise.resolve({ data: { jwe: 'jwe' } })),
    getSessionToken: vi.fn(() => 'token'),
    getActiveConversation: vi.fn(() => Promise.resolve({ data: { conversation: null } })),
    getConversationTranscript: vi.fn(() => Promise.resolve({ data: { turns: [] } })),
    appendConversationTurn: vi.fn(() => Promise.resolve({ data: { updated: true } })),
    listReviewQueue: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  }
})

const mockedService = liveAudioService as unknown as {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  hasApiKey: ReturnType<typeof vi.fn>
  sendText: ReturnType<typeof vi.fn>
  onTranscriptUpdate: null | ((text: string, isUser: boolean, isFinal: boolean) => void)
  onStatus: null | ((status: string) => void)
  onBargeIn: null | (() => void)
}

const mockedBackend = backend as unknown as {
  startConversation: ReturnType<typeof vi.fn>
  appendConversationTurn: ReturnType<typeof vi.fn>
  endConversation: ReturnType<typeof vi.fn>
}

function renderChat() {
  return render(
    <OpenLoopsProvider>
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    </OpenLoopsProvider>,
  )
}

/** Start a voice session and wait for full initialization */
async function startSession() {
  renderChat()

  act(() => {
    fireEvent.pointerDown(window)
  })

  // Wait for auto-start to complete: onTranscriptUpdate wired + conversation started
  await waitFor(() => {
    expect(mockedService.onTranscriptUpdate).not.toBeNull()
  })
  await waitFor(() => {
    expect(mockedBackend.startConversation).toHaveBeenCalled()
  })
}

describe('Chat transcript finalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_DISABLE_LIVE_AUDIO', 'false')
    mockedService.connect.mockResolvedValue(undefined)
    mockedService.disconnect.mockResolvedValue(undefined)
    mockedService.hasApiKey.mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('records user turn only when isFinal is true', async () => {
    await startSession()

    // Non-final user text — should display but NOT record a turn
    act(() => {
      mockedService.onTranscriptUpdate?.('Hello', true, false)
    })

    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(mockedBackend.appendConversationTurn).not.toHaveBeenCalled()

    // Final user text — should record a turn
    act(() => {
      mockedService.onTranscriptUpdate?.('Hello world', true, true)
    })

    await waitFor(() => {
      expect(mockedBackend.appendConversationTurn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          speaker: 'user',
          text: 'Hello world',
        }),
      )
    })
  })

  it('records assistant turn only when isFinal is true', async () => {
    await startSession()

    // Non-final assistant text — should display but NOT record
    act(() => {
      mockedService.onTranscriptUpdate?.('Hi there', false, false)
    })

    expect(screen.getByText('Hi there')).toBeInTheDocument()
    expect(mockedBackend.appendConversationTurn).not.toHaveBeenCalled()

    // Final assistant text — should record
    act(() => {
      mockedService.onTranscriptUpdate?.('Hi there, how are you?', false, true)
    })

    await waitFor(() => {
      expect(mockedBackend.appendConversationTurn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          speaker: 'assistant',
          text: 'Hi there, how are you?',
        }),
      )
    })
  })

  it('does not duplicate user text when final emission arrives', async () => {
    await startSession()

    // Incremental user text (non-final)
    act(() => {
      mockedService.onTranscriptUpdate?.('Hello', true, false)
    })

    expect(screen.getByText('Hello')).toBeInTheDocument()

    // Final emission with full accumulated text — should NOT update display again
    act(() => {
      mockedService.onTranscriptUpdate?.('Hello world', true, true)
    })

    // The display should still show "Hello" (from the non-final emission).
    // The final emission only records the turn, it does NOT modify the display.
    const userCaptions = screen.getAllByText(/Hello/)
    expect(userCaptions).toHaveLength(1)
    expect(userCaptions[0].textContent).toBe('Hello')
  })

  it('passes transcript turns to endConversation on hangup', async () => {
    await startSession()

    // Simulate a conversation with final turns
    act(() => {
      mockedService.onTranscriptUpdate?.('Hi', true, false)
    })
    act(() => {
      mockedService.onTranscriptUpdate?.('Hi', true, true) // finalize user turn
    })
    act(() => {
      mockedService.onTranscriptUpdate?.('Hello!', false, false)
    })
    act(() => {
      mockedService.onTranscriptUpdate?.('Hello! How are you?', false, true) // finalize assistant turn
    })

    // Click hangup — drain(2000) in handleHangup may wait up to 2s for
    // the blackboard to empty, so we need a generous timeout.
    const hangupButton = screen.getByLabelText('End session')
    await act(async () => {
      fireEvent.click(hangupButton)
    })

    // endConversation should have been called with transcript turns
    await waitFor(() => {
      expect(mockedBackend.endConversation).toHaveBeenCalled()
    }, { timeout: 5000 })

    const callArgs = mockedBackend.endConversation.mock.calls[0]
    const transcript = callArgs[1]
    expect(transcript).toHaveLength(2) // user turn + assistant turn
    expect(transcript[0]).toMatchObject({ speaker: 'user', text: 'Hi' })
    expect(transcript[1]).toMatchObject({ speaker: 'assistant', text: 'Hello! How are you?' })
  })
})
