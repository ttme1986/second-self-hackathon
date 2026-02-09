import { describe, expect, it } from 'vitest'
import { GoogleGenAI } from '@google/genai'

const hasApiKey = !!process.env.VITE_GEMINI_API_KEY

describe('Gemini API (integration)', () => {
  it.skipIf(!hasApiKey)('can generate content', async () => {
    const apiKey = process.env.VITE_GEMINI_API_KEY!

    const client = new GoogleGenAI({ apiKey })
    const preferred = process.env.VITE_GEMINI_MODEL?.toString().trim()

    // Model availability varies by account/API version. Try a small fallback list.
    const candidates = [
      preferred,
      'gemini-3-flash-preview',
      'gemini-3-pro-preview',
    ].filter(Boolean) as string[]

    let lastError: unknown = null
    let text = ''

    for (const model of candidates) {
      try {
        const res = await client.models.generateContent({
          model,
          contents: 'Reply with exactly: ok',
        })
        text = (res.text ?? '').trim().toLowerCase()
        break
      } catch (err: any) {
        lastError = err
        const msg = String(err?.message ?? '')
        // If the model name is unsupported, try the next candidate.
        if (msg.includes('is not found') || msg.includes('NOT_FOUND')) continue
        throw err
      }
    }

    if (!text) {
      throw lastError instanceof Error ? lastError : new Error('Gemini generateContent failed')
    }

    expect(text).toBe('ok')
  })
})
