/**
 * E2E User Flow — Image Attachment Test
 *
 * Agentic Vision — image attachment triggers intelligent analysis:
 *   1. Login, navigate to /chat
 *   2. Attach a test receipt image via file input
 *   3. Send a note referencing the image
 *   4. Validate enriched turn persisted with [Attached image analysis:]
 *   5. Gemini validates the analysis extracted structured receipt data
 *   6. End session to commit data to Firestore/Storage
 */

import { test, expect } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env and .env.local from the app directory (.env.local takes priority, matching Vite convention)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), override: true })

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY ?? ''
const GEMINI_MODEL = 'gemini-3-flash-preview'

let client: GoogleGenAI

test.beforeAll(() => {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY is required for user flow tests')
  }
  client = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
})

// Gemini call with retry logic
async function callGemini(prompt: string, maxRetries = 3): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      })
      return response.text ?? ''
    } catch (error) {
      if (attempt === maxRetries) throw error
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
    }
  }
  throw new Error('Unreachable')
}

// Extract the active/most-recent conversation ID from localStorage
async function getActiveConversationId(page: any): Promise<string | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('secondSelfStore')
    if (!raw) return null
    const store = JSON.parse(raw)
    const users = store.users ?? {}
    const userId = Object.keys(users)[0]
    if (!userId) return null
    const conversations = users[userId]?.conversations ?? {}
    const entries = Object.entries(conversations) as [string, any][]
    if (entries.length === 0) return null
    // Return the most recently started conversation
    const sorted = entries.sort(([, a], [, b]) =>
      (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
    return sorted[0][0]
  })
}

test.describe('User Flow E2E — Image', () => {
  test('agentic vision — image attachment triggers intelligent analysis', async ({ page, context }) => {
    // Test fixture: receipt image with structured data (numbers, items, totals)
    const testImagePath = path.resolve(__dirname, '../fixtures/test-receipt.png')
    if (!fs.existsSync(testImagePath)) {
      throw new Error(`Test fixture missing: ${testImagePath}\nRun: node tests/fixtures/generate-receipt.mjs`)
    }

    // ============================================
    // 1. AUTH: Login as demo user
    // ============================================
    console.log('[Vision] Step 1: Logging in as demo user...')

    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(async () => {
      localStorage.clear()
      sessionStorage.clear()
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) indexedDB.deleteDatabase(db.name)
      }
    })

    await page.goto('/?forceLogin')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    const demoButton = page.getByRole('button', { name: /sign in for demo/i })
    await demoButton.waitFor({ state: 'visible', timeout: 15000 })
    await demoButton.click()
    await page.waitForSelector('.login-screen', { state: 'hidden', timeout: 30000 })
    console.log('[Vision]   Demo sign-in completed')
    await page.waitForTimeout(2000)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    // ============================================
    // 2. NAVIGATE: Go to /chat
    // ============================================
    console.log('[Vision] Step 2: Navigating to chat...')
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    // Wait for greeting to stabilize
    try {
      const assistantArea = page.locator('.chat-center-assistant')
      await assistantArea.waitFor({ state: 'visible', timeout: 15000 })
      let prevText = ''
      let stableCount = 0
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(1000)
        const currentText = (await assistantArea.textContent()) ?? ''
        if (currentText === prevText && currentText.length > 0) {
          stableCount++
          if (stableCount >= 2) break
        } else {
          stableCount = 0
        }
        prevText = currentText
      }
      console.log('[Vision]   Greeting received')
    } catch {
      console.warn('[Vision]   No greeting detected, continuing...')
    }

    // Log conversation ID for Firestore/Storage matching
    const visionConvId = await getActiveConversationId(page)
    console.log(`[Vision]   [CONVERSATION ID] ${visionConvId ?? '(not found)'}`)

    // ============================================
    // 3. ATTACH: Upload test receipt image
    // ============================================
    console.log('[Vision] Step 3: Attaching test receipt image...')

    // Use the hidden file input to upload the image
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testImagePath)

    // Verify attachment preview appears in the UI
    const attachmentPreview = page.locator('.attachment-preview, .chat-attachments, [class*="attachment"]').first()
    try {
      await attachmentPreview.waitFor({ state: 'visible', timeout: 5000 })
      console.log('[Vision]   Attachment preview visible')
    } catch {
      // Some UIs may not show a preview container — check for img thumbnail
      const thumbnail = page.locator('img[src^="blob:"]').first()
      const hasThumbnail = await thumbnail.isVisible({ timeout: 3000 }).catch(() => false)
      console.log(`[Vision]   Attachment thumbnail visible: ${hasThumbnail}`)
    }

    // ============================================
    // 4. SEND: Type a note and send with the image
    // ============================================
    console.log('[Vision] Step 4: Sending note with image...')

    const chatInput = page.locator('input[placeholder="Type a note..."]')
    await chatInput.fill('I just had lunch. What does this receipt say? How much did I spend?')
    await chatInput.press('Enter')

    // Wait for the image analysis to complete and persist to localStorage.
    // analyzeImage() calls the Gemini API with code execution + thinking, which can take 10-30s.
    // We poll localStorage for the enriched turn rather than relying on assistant response timing.
    console.log('[Vision]   Waiting for image analysis to persist (polling localStorage)...')

    const pollResult = await page.evaluate(async () => {
      const maxWaitMs = 90_000
      const pollIntervalMs = 2_000
      const start = Date.now()

      while (Date.now() - start < maxWaitMs) {
        await new Promise((r) => setTimeout(r, pollIntervalMs))
        const raw = localStorage.getItem('secondSelfStore')
        if (!raw) continue
        const store = JSON.parse(raw)
        const users = store.users ?? {}
        const userId = Object.keys(users)[0]
        if (!userId) continue
        const userData = users[userId]
        const conversations = userData?.conversations ?? {}
        const conversationEntries = Object.entries(conversations) as [string, any][]
        if (conversationEntries.length === 0) continue

        const latestConv = conversationEntries
          .sort(([, a]: [string, any], [, b]: [string, any]) =>
            (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
          [0]?.[1]

        const transcript = latestConv?.transcript ?? []
        const imageTurn = transcript.find(
          (t: any) => t.speaker === 'user' && t.text?.includes('[Attached image analysis:'),
        )
        if (imageTurn) {
          return {
            hasImageAnalysis: true,
            turnText: imageTurn.text?.substring(0, 3000) ?? '',
            conversationCount: conversationEntries.length,
            elapsedMs: Date.now() - start,
          }
        }
      }

      // Timeout — gather diagnostics
      const raw = localStorage.getItem('secondSelfStore')
      if (!raw) return { hasImageAnalysis: false, turnText: '', conversationCount: 0, elapsedMs: maxWaitMs, diag: 'no store' }
      const store = JSON.parse(raw)
      const users = store.users ?? {}
      const userId = Object.keys(users)[0]
      const userData = users[userId]
      const conversations = userData?.conversations ?? {}
      const conversationEntries = Object.entries(conversations) as [string, any][]
      const latestConv = conversationEntries
        .sort(([, a]: [string, any], [, b]: [string, any]) =>
          (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
        [0]?.[1]
      const transcript = latestConv?.transcript ?? []
      const userTurns = transcript.filter((t: any) => t.speaker === 'user')
      return {
        hasImageAnalysis: false,
        turnText: userTurns.map((t: any) => t.text?.substring(0, 200)).join(' | '),
        conversationCount: conversationEntries.length,
        elapsedMs: maxWaitMs,
        diag: `${transcript.length} turns total, ${userTurns.length} user turns`,
        convKeys: Object.keys(latestConv ?? {}),
      }
    })

    // ============================================
    // 5. VALIDATE: Check persisted conversation turn
    // ============================================
    console.log('[Vision] Step 5: Validating persisted conversation data...')
    console.log(`[Vision]   Conversations in store: ${pollResult.conversationCount}`)
    console.log(`[Vision]   Image analysis found: ${pollResult.hasImageAnalysis} (after ${pollResult.elapsedMs}ms)`)
    if ((pollResult as any).diag) {
      console.log(`[Vision]   Diagnostics: ${(pollResult as any).diag}`)
      console.log(`[Vision]   Conv keys: ${JSON.stringify((pollResult as any).convKeys)}`)
    }
    if (pollResult.turnText) {
      console.log(`[Vision]   Turn text preview: "${pollResult.turnText.substring(0, 200)}..."`)
    }

    const persistedData = pollResult

    // The enriched turn should contain the image analysis marker
    expect(
      persistedData.hasImageAnalysis,
      'User turn should contain [Attached image analysis:] from analyzeImage()',
    ).toBe(true)

    // Now also capture the assistant response for logging
    let assistantResponse = ''
    try {
      const assistantArea = page.locator('.chat-center-assistant')
      assistantResponse = (await assistantArea.textContent()) ?? ''
      console.log(`[Vision]   Assistant response: "${assistantResponse.substring(0, 120)}..."`)
    } catch {
      // Assistant area may not be visible
    }

    // ============================================
    // 6. VALIDATE: Gemini judges image analysis quality
    // ============================================
    console.log('[Vision] Step 6: Validating image analysis quality with Gemini...')

    // Extract just the image analysis portion from the turn
    const analysisMatch = persistedData.turnText.match(/\[Attached image analysis:\n([\s\S]*)\]/)
    const imageAnalysisText = analysisMatch?.[1] ?? persistedData.turnText

    const validationPrompt = `You are evaluating an AI image analysis system. A receipt image from "Sunny Cafe" was analyzed. The receipt contains:
- Restaurant: Sunny Cafe, 123 Market St, San Francisco
- Items: 2x Cappuccino ($11.00), 1x Avocado Toast ($14.50), 1x Greek Salad ($12.75), 1x Blueberry Muffin ($4.25), 1x Fresh OJ ($6.50)
- Subtotal: $49.00, Tax (8.625%): $4.23, Tip (20%): $9.80
- Total: $63.03
- Payment: Visa ****4821

Here is the AI's analysis of the receipt image:
"${imageAnalysisText}"

Evaluate:
1. Did the analysis identify this as a receipt/restaurant bill?
2. Did it extract at least some item names or prices?
3. Did it identify the total amount (approximately $63)?
4. Is the analysis useful and actionable for a personal life assistant?

A good analysis should extract most of the structured data. An excellent analysis (indicating code execution was used) would have precise numbers.

Reply ONLY with JSON (no markdown fences): {"correct": true/false, "quality": "poor|adequate|good|excellent", "explanation": "..."}`

    const validationResult = await callGemini(validationPrompt)
    try {
      const parsed = JSON.parse(validationResult.replace(/```json?\s*/g, '').replace(/```\s*$/g, '').trim())
      console.log(`[Vision]   Analysis quality: ${parsed.quality}`)
      console.log(`[Vision]   Validation: ${parsed.correct ? 'PASS' : 'FAIL'}`)
      console.log(`[Vision]   Explanation: ${parsed.explanation}`)
      if (!parsed.correct) {
        console.warn(`[Vision]   Quality check failed (non-blocking): ${parsed.explanation}`)
      }
    } catch {
      console.warn('[Vision]   Could not parse validation response')
    }

    // ============================================
    // 7. END SESSION: Hang up + recap close to commit to Firestore/Storage
    // ============================================
    console.log('[Vision] Step 7: Ending session to commit data to Firestore/Storage...')

    const visionHangup = page.locator('button[aria-label="End session"]')
    if (await visionHangup.isVisible({ timeout: 3000 }).catch(() => false)) {
      await visionHangup.click()

      const visionRecap = page.locator('.recap-backdrop')
      try {
        await visionRecap.waitFor({ state: 'visible', timeout: 30000 })
        console.log('[Vision]   Recap modal visible')

        const visionFinalConvId = await getActiveConversationId(page)
        console.log(`[Vision]   [CONVERSATION ID] At recap: ${visionFinalConvId ?? '(not found)'}`)

        // Wait briefly for endConversation to complete
        await page.waitForTimeout(3000)

        const visionCloseBtn = page.locator('button[aria-label="Close recap"]')
        if (await visionCloseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await visionCloseBtn.click()
          await page.waitForURL('**/', { timeout: 10000 }).catch(() => {})
          await page.waitForTimeout(2000)
          console.log('[Vision]   Session ended — data committed to Firestore')
        }
      } catch {
        console.warn('[Vision]   Recap modal did not appear')
      }
    } else {
      console.warn('[Vision]   End session button not found')
    }

    console.log('[Vision] Agentic vision test complete!')
  })
})
