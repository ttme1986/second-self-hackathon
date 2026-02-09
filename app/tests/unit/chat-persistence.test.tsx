import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'
import { liveAudioService } from '../../src/services/liveAudioService'
import { 
  getActiveConversation, 
  getConversationTranscript, 
  appendConversationTurn,
  startConversation
} from '../../src/api/backend'
import { act } from 'react'

// Mock services first
vi.mock('../../src/services/liveAudioService', () => ({
  liveAudioService: {
    connect: vi.fn(),
    connectTextOnly: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    sendText: vi.fn(),
    hasApiKey: vi.fn(() => true),
    setApiKey: vi.fn(),
    connected: false,
    onTranscriptUpdate: null,
    onStatus: null,
    onBargeIn: null,
  }
}))

vi.mock('../../src/services/memoryContext', () => ({
  buildMemoryContext: vi.fn().mockResolvedValue({ systemPrompt: 'test prompt' }),
}))

vi.mock('../../src/api/backend', () => ({
  hasBackend: true,
  startConversation: vi.fn().mockResolvedValue({ data: { startedAt: 'now' } }),
  endConversation: vi.fn().mockResolvedValue({ data: { summary: 'Done' } }),
  confirmActions: vi.fn(),
  commitSessionToFirestore: vi.fn(() => Promise.resolve()),
  getActiveConversation: vi.fn(),
  getConversationTranscript: vi.fn(),
  appendConversationTurn: vi.fn().mockResolvedValue({ data: { updated: true } }),
  getSessionToken: vi.fn(() => 'token'),
  getGeminiSessionKey: vi.fn().mockResolvedValue({ data: { jwe: 'key' } }),
  detectEmotion: vi.fn().mockResolvedValue({ emotion: 'neutral', confidence: 0.8, timestamp: Date.now() }),
  calculateEmotionalSummary: vi.fn().mockReturnValue({ dominantEmotion: 'neutral', emotionBreakdown: {}, averageConfidence: 0.8, moodArc: 'stable' }),
}))

// Mock agents to avoid import errors or side effects
vi.mock('../../src/agents', () => ({
  AnalyzerAgent: class { start() {} stop() {} },
  ValidatorAgent: class { start() {} stop() {} },
  ActionPublishAgent: class { start() {} stop() {} }
}))

async function renderChat() {
  const { default: Chat } = await import('../../src/pages/Chat')
  return render(
    <OpenLoopsProvider>
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    </OpenLoopsProvider>
  )
}

describe('Chat persistence', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DISABLE_LIVE_AUDIO', 'false')
    vi.clearAllMocks()
    vi.mocked(getActiveConversation).mockResolvedValue({ data: { conversation: null } })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('restores active conversation on mount', async () => {
    vi.mocked(getActiveConversation).mockResolvedValue({
      data: { 
        conversation: { 
          id: 'restored-id', 
          summary: '', 
          startedAt: '', 
          endedAt: '', 
          durationMs: 0,
          status: 'active'
        } 
      }
    })
    vi.mocked(getConversationTranscript).mockResolvedValue({
      data: {
        turns: [
          { speaker: 'user', text: 'Hello previous', t_ms: 100 },
          { speaker: 'assistant', text: 'Hi again', t_ms: 200 }
        ]
      }
    })

    await renderChat()

    // Should show restored text
    await screen.findByText('Hello previous')
    await screen.findByText('Hi again')
    
    // Should NOT have started a NEW conversation
    expect(startConversation).not.toHaveBeenCalled()
  })

  it('appends turns to backend when they finalize', async () => {
    // No active conversation initially
    vi.mocked(getActiveConversation).mockResolvedValue({ data: { conversation: null } })
    
    await renderChat()
    
    // Start session
    const mic = screen.getByLabelText('Microphone')
    await act(async () => {
        mic.click()
    })

    // Wait for conversation to start
    await waitFor(() => {
        expect(startConversation).toHaveBeenCalled()
    })

    // Simulate transcript update
    act(() => {
        // @ts-ignore
        if (liveAudioService.onTranscriptUpdate) {
            // @ts-ignore
            liveAudioService.onTranscriptUpdate('Hello world', true, true)
        }
    })

    await waitFor(() => {
        expect(appendConversationTurn).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ text: 'Hello world', speaker: 'user' })
        )
    })
  })
})
