import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mockGenerateContent = vi.fn()

vi.mock('@google/genai', () => {
  class GoogleGenAI {
    models = {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    }
  }
  const Type = { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN' }
  const ThinkingLevel = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' }
  const MediaResolution = { MEDIA_RESOLUTION_HIGH: 'MEDIA_RESOLUTION_HIGH', MEDIA_RESOLUTION_LOW: 'MEDIA_RESOLUTION_LOW' }
  return { GoogleGenAI, Type, ThinkingLevel, MediaResolution }
})

import { analyzeImage } from '../../src/api/backend'

describe('analyzeImage — Agentic Vision (#16) and Cache Metrics (#19)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key')
    vi.stubEnv('VITE_DISABLE_AI', 'false')
    window.localStorage.setItem('sessionUser', JSON.stringify({ uid: 'dev-user' }))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    window.localStorage.clear()
  })

  it('sends image with code execution tool and thinking mode', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'A photo of a whiteboard with meeting notes',
      candidates: [{ content: { parts: [{ text: 'A photo of a whiteboard' }] } }],
      usageMetadata: { promptTokenCount: 100, cachedContentTokenCount: 0 },
    })

    const result = await analyzeImage('base64data', 'image/jpeg')

    expect(result.data?.description).toBe('A photo of a whiteboard with meeting notes')
    expect(result.data?.codeExecuted).toBe(false)

    // Verify the config includes agentic vision features
    const callArgs = mockGenerateContent.mock.calls[0][0]
    expect(callArgs.config.tools).toEqual([{ codeExecution: {} }])
    expect(callArgs.config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' })
    expect(callArgs.config.mediaResolution).toBe('MEDIA_RESOLUTION_HIGH')
    expect(callArgs.config.temperature).toBe(1.0)
  })

  it('detects when code execution was used in response', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'Receipt total: $42.50',
      candidates: [{
        content: {
          parts: [
            { text: 'Let me extract the data from this receipt.' },
            { executableCode: { code: 'total = 42.50\nprint(f"Total: ${total}")' } },
            { codeExecutionResult: { output: 'Total: $42.50' } },
            { text: 'Receipt total: $42.50' },
          ],
        },
      }],
      usageMetadata: { promptTokenCount: 200, cachedContentTokenCount: 0 },
    })

    const result = await analyzeImage('receipt-base64', 'image/png')

    expect(result.data?.description).toBe('Receipt total: $42.50')
    expect(result.data?.codeExecuted).toBe(true)
  })

  it('uses default agentic prompt when no context provided', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'Image description',
      candidates: [{ content: { parts: [{ text: 'Image description' }] } }],
      usageMetadata: { promptTokenCount: 50, cachedContentTokenCount: 0 },
    })

    await analyzeImage('base64data')

    const callArgs = mockGenerateContent.mock.calls[0][0]
    const textPart = callArgs.contents.find((c: Record<string, unknown>) => 'text' in c)
    expect(textPart.text).toContain('Analyze this image for a personal life assistant')
    expect(textPart.text).toContain('code execution')
  })

  it('includes custom context in agentic prompt when provided', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'Custom analysis',
      candidates: [{ content: { parts: [{ text: 'Custom analysis' }] } }],
      usageMetadata: { promptTokenCount: 50, cachedContentTokenCount: 0 },
    })

    await analyzeImage('base64data', 'image/jpeg', 'Check for meeting times')

    const callArgs = mockGenerateContent.mock.calls[0][0]
    const textPart = callArgs.contents.find((c: Record<string, unknown>) => 'text' in c)
    expect(textPart.text).toContain('Check for meeting times')
    expect(textPart.text).toContain('code execution')
  })

  it('returns empty description when AI is disabled', async () => {
    vi.stubEnv('VITE_DISABLE_AI', 'true')

    const result = await analyzeImage('base64data')

    expect(result.data?.description).toBe('')
    expect(result.data?.codeExecuted).toBe(false)
    expect(mockGenerateContent).not.toHaveBeenCalled()
  })

  it('returns error when API key is missing', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '')

    const result = await analyzeImage('base64data')

    expect(result.error).toBe('Gemini API key missing')
    expect(mockGenerateContent).not.toHaveBeenCalled()
  })

  it('handles non-retryable API errors gracefully', async () => {
    mockGenerateContent.mockRejectedValue(new Error('invalid input'))

    const result = await analyzeImage('base64data')

    expect(result.error).toBe('invalid input')
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('retries on 503/UNAVAILABLE errors with exponential backoff', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockGenerateContent
      .mockRejectedValueOnce(new Error('503 UNAVAILABLE'))
      .mockResolvedValueOnce({
        text: 'Retry succeeded',
        candidates: [{ content: { parts: [{ text: 'Retry succeeded' }] } }],
        usageMetadata: { promptTokenCount: 50, cachedContentTokenCount: 0 },
      })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await analyzeImage('base64data')

    expect(result.data?.description).toBe('Retry succeeded')
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    warnSpy.mockRestore()
    vi.useRealTimers()
  })

  describe('cache metrics logging (#19)', () => {
    it('logs cache hit when cachedContentTokenCount > 0', async () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

      mockGenerateContent.mockResolvedValue({
        text: 'Cached response',
        candidates: [{ content: { parts: [{ text: 'Cached response' }] } }],
        usageMetadata: { promptTokenCount: 1000, cachedContentTokenCount: 800 },
      })

      await analyzeImage('base64data')

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[cache] analyzeImage: 800/1000 tokens cached (80.0%)'),
      )

      debugSpy.mockRestore()
    })

    it('does not log when no cache hit', async () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

      mockGenerateContent.mockResolvedValue({
        text: 'Uncached response',
        candidates: [{ content: { parts: [{ text: 'Uncached response' }] } }],
        usageMetadata: { promptTokenCount: 500, cachedContentTokenCount: 0 },
      })

      await analyzeImage('base64data')

      expect(debugSpy).not.toHaveBeenCalled()

      debugSpy.mockRestore()
    })
  })
})
