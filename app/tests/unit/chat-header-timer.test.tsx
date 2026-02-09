import { act, fireEvent, render, screen } from '@testing-library/react'
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
  hasBackend: false,
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

const formatDate = (value: Date) =>
  value.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

const formatTime = (value: Date) =>
  value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

describe('Chat header date/time and session timer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-31T10:05:00'))
    vi.stubEnv('VITE_DISABLE_LIVE_AUDIO', 'false')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('renders current date and time in the header', async () => {
    await renderChat()

    const now = new Date()
    expect(screen.getByText(formatDate(now))).toBeInTheDocument()
    expect(screen.getByText(formatTime(now))).toBeInTheDocument()
  })

  it('increments timer while recording and resets when stopped', async () => {
    await renderChat()

    expect(screen.getByText('00:00')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Microphone'))
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByText('00:03')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Microphone'))
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByText('00:00')).toBeInTheDocument()
  })
})
