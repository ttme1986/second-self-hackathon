import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'
import Chat from '../../src/pages/Chat'
import { liveAudioService } from '../../src/services/liveAudioService'

vi.mock('../../src/services/liveAudioService', () => {
  const service = {
    connect: vi.fn(),
    connectTextOnly: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
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

const mockedLiveAudioService = liveAudioService as unknown as {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  resumeAudio: ReturnType<typeof vi.fn>
  isAudioLocked: ReturnType<typeof vi.fn>
  hasApiKey: ReturnType<typeof vi.fn>
  setApiKey: ReturnType<typeof vi.fn>
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

describe('Chat live audio', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DISABLE_LIVE_AUDIO', 'false')
    mockedLiveAudioService.connect.mockResolvedValue(undefined)
    mockedLiveAudioService.disconnect.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('shows live status updates from the audio service', async () => {
    renderChat()

    act(() => {
      fireEvent.pointerDown(window)
    })

    await waitFor(() => {
      expect(mockedLiveAudioService.connect).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockedLiveAudioService.onStatus).not.toBeNull()
    })

    act(() => {
      mockedLiveAudioService.onStatus?.('socket-open')
    })

    expect(screen.getByText('Live: socket-open')).toBeInTheDocument()

    act(() => {
      mockedLiveAudioService.onStatus?.('connected')
    })

    expect(screen.getByText('Live: connected')).toBeInTheDocument()
  })

  it('renders live transcripts from the audio service', async () => {
    renderChat()

    act(() => {
      fireEvent.pointerDown(window)
    })

    await waitFor(() => {
      expect(mockedLiveAudioService.onTranscriptUpdate).not.toBeNull()
    })

    act(() => {
      mockedLiveAudioService.onTranscriptUpdate?.('Hello there', true, false)
      mockedLiveAudioService.onTranscriptUpdate?.('Hi! How can I help?', false, false)
    })

    expect(screen.getByText('Hello there')).toBeInTheDocument()
    expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument()
  })
})
