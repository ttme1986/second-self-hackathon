import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'
import Chat from '../../src/pages/Chat'
import { liveAudioService } from '../../src/services/liveAudioService'

vi.mock('../../src/agents', () => {
  class AnalyzerAgent { start() {} stop() {} }
  class ValidatorAgent { start() {} stop() {} }
  class ActionPublishAgent { start() {} stop() {} }
  return { AnalyzerAgent, ValidatorAgent, ActionPublishAgent }
})

vi.mock('../../src/services/liveAudioService', () => {
  const service = {
    connect: vi.fn(),
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

const mockedService = liveAudioService as unknown as {
  connect: ReturnType<typeof vi.fn>
  connectTextOnly: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  hasApiKey: ReturnType<typeof vi.fn>
  sendText: ReturnType<typeof vi.fn>
  onTranscriptUpdate: null | ((text: string, isUser: boolean, isFinal: boolean) => void)
  onStatus: null | ((status: string) => void)
  onBargeIn: null | (() => void)
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

describe('Chat mic permission denied', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_DISABLE_LIVE_AUDIO', 'false')
    mockedService.disconnect.mockResolvedValue(undefined)
    mockedService.connectTextOnly.mockResolvedValue(undefined)
    mockedService.hasApiKey.mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('shows "Mic unavailable" and falls back to text mode when mic is denied', async () => {
    mockedService.connect.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))

    renderChat()

    act(() => {
      fireEvent.pointerDown(window)
    })

    await waitFor(() => {
      expect(mockedService.connect).toHaveBeenCalled()
    })

    // UI should show mic-denied state, not "Connecting..." or "Paused"
    await waitFor(() => {
      expect(screen.getByText('Mic unavailable')).toBeInTheDocument()
    })
    expect(screen.getByText('Tap mic to retry')).toBeInTheDocument()

    // Text-only session should have been initialized as fallback
    expect(mockedService.connectTextOnly).toHaveBeenCalled()
  })

  it('mic button remains enabled when mic is denied so user can retry', async () => {
    mockedService.connect.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))

    renderChat()

    act(() => {
      fireEvent.pointerDown(window)
    })

    await waitFor(() => {
      expect(screen.getByText('Mic unavailable')).toBeInTheDocument()
    })

    const micButton = screen.getByLabelText('Microphone')
    expect(micButton).not.toBeDisabled()
  })

  it('does not auto-retry after mic permission is denied', async () => {
    mockedService.connect.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))

    renderChat()

    act(() => {
      fireEvent.pointerDown(window)
    })

    // Wait for the failure to fully settle
    await waitFor(() => {
      expect(screen.getByText('Mic unavailable')).toBeInTheDocument()
    })

    const callsAfterSettled = mockedService.connect.mock.calls.length

    // Wait to ensure no additional retries
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(mockedService.connect).toHaveBeenCalledTimes(callsAfterSettled)
  })

  it('sends greeting after text-only fallback', async () => {
    mockedService.connect.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))

    renderChat()

    act(() => {
      fireEvent.pointerDown(window)
    })

    await waitFor(() => {
      expect(mockedService.connectTextOnly).toHaveBeenCalled()
    })

    // Greeting should have been sent through text session
    expect(mockedService.sendText).toHaveBeenCalledWith(
      '[Session started. Please greet the user.]'
    )
  })

  it('retries voice session when mic button is clicked after denial', async () => {
    // First attempt: denied
    mockedService.connect
      .mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))
      // Second attempt: succeeds
      .mockResolvedValueOnce(undefined)

    renderChat()

    act(() => {
      fireEvent.pointerDown(window)
    })

    // Wait for first attempt to fail and settle
    await waitFor(() => {
      expect(screen.getByText('Mic unavailable')).toBeInTheDocument()
    })

    const callsBefore = mockedService.connect.mock.calls.length

    // Click mic to retry
    const micButton = screen.getByLabelText('Microphone')
    await act(async () => {
      fireEvent.click(micButton)
      // Allow the async handleMic to complete
      await new Promise((r) => setTimeout(r, 50))
    })

    // Should have called connect again
    expect(mockedService.connect.mock.calls.length).toBeGreaterThan(callsBefore)
  })
})
