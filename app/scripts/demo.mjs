#!/usr/bin/env node
/**
 * Automated Demo Video Script for Second-Self
 *
 * All narration pre-generated at startup (no runtime TTS calls).
 * 5-turn chat conversation with narrator interjections.
 * Feature-focused narration — no specific data values.
 *
 * - TTS narration via Gemini TTS (Chirp 3: HD)
 * - Live Gemini Live API 5-turn conversation (text input + TTS simultaneously)
 * - Photo attachment of BP reading
 * - Action approve/dismiss
 * - Recap walkthrough
 * - Reflect navigation (About Me, Review Queue, Commitments)
 *
 * Usage: node scripts/demo.mjs
 * Triggered via: npm run demo (after npm run build)
 */

import { chromium } from 'playwright'
import { GoogleGenAI, Modality } from '@google/genai'
import { spawn, execFileSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, statSync } from 'fs'
import { Buffer } from 'buffer'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import path from 'path'

// Load .env for API keys
const require_ = createRequire(import.meta.url)
const dotenv = require_('dotenv')
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') })
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local'), override: true })

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const APP_DIR = path.resolve(__dirname, '..')
const ROOT_DIR = path.resolve(APP_DIR, '..')

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:4174'
const PORT = 4174
const VIEWPORT = { width: 390, height: 844 }
const DEMO_OUTPUT_DIR = path.join(APP_DIR, 'demo-output')
const BP_HTML = path.join(ROOT_DIR, 'demo', 'attachments', 'bp-reading.html')
const BP_PNG = path.join(ROOT_DIR, 'demo', 'attachments', 'bp-reading.png')

// Gemini TTS config (Chirp 3: HD voices via Gemini TTS model)
// Voice names: Enceladus, Charon, Fenrir, Orus, Puck, Kore, Zephyr, etc.
const TTS_VOICE = process.env.DEMO_TTS_VOICE ?? 'Enceladus'
const TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY || process.env.VITE_GEMINI_API_KEY
const TTS_MODEL = 'gemini-2.5-flash-preview-tts'

// Font URLs to preload (from demo-recording.spec.ts)
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap',
]

const AUDIO_DIR = path.join(DEMO_OUTPUT_DIR, 'audio')

// Try to load ffmpeg-static (optional — graceful fallback if not installed)
let ffmpegPath = null
try {
  const ffmpegMod = await import('ffmpeg-static')
  ffmpegPath = ffmpegMod.default
} catch {
  // ffmpeg-static not installed; will skip merge step
}

// Timing log
const segmentTimings = []

// Pre-generated audio cache: text → { mime: string, data: string (base64) }
const audioCache = new Map()

// Audio timeline tracking for FFmpeg merge
let demoStartMs = 0
const audioTimeline = []          // { key, offsetMs, rate, file }
const textToKeyMap = new Map()    // text → NARRATION_TEXTS key
let chatAudioFile = ''
let chatAudioOffsetMs = 0

// ---------------------------------------------------------------------------
// Server Management
// ---------------------------------------------------------------------------

let serverProcess = null

async function startServer() {
  // Check if server is already running
  try {
    const res = await fetch(BASE_URL)
    if (res.ok) {
      console.log(`Server already running at ${BASE_URL}`)
      return
    }
  } catch {
    // Server not running, start it
  }

  console.log(`Starting vite preview on port ${PORT}...`)
  serverProcess = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: APP_DIR,
    stdio: 'pipe',
    shell: true,
  })

  serverProcess.stdout.on('data', (d) => process.stdout.write(`[vite] ${d}`))
  serverProcess.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`))

  // Poll until ready (up to 30s)
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL)
      if (res.ok) {
        console.log('Server ready')
        return
      }
    } catch {
      // not ready yet
    }
    await sleep(200)
  }
  throw new Error('Server did not start within 30 seconds')
}

function stopServer() {
  if (serverProcess) {
    console.log('Stopping server...')
    try {
      // On Windows, shell: true spawns a process tree (cmd → npx → node → vite).
      // serverProcess.kill() only kills the outer shell, leaving children alive.
      // Use taskkill /T to kill the entire tree.
      if (process.platform === 'win32' && serverProcess.pid) {
        execFileSync('taskkill', ['/pid', String(serverProcess.pid), '/T', '/F'], { stdio: 'ignore' })
      } else {
        serverProcess.kill()
      }
    } catch {
      try { serverProcess.kill() } catch {}
    }
    serverProcess = null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// Chirp 3: HD TTS
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Click Highlight + In-Browser Audio Capture (addInitScript)
// ---------------------------------------------------------------------------

/**
 * Injected into every page via context.addInitScript().
 * Provides:
 * 1. Cursor dot (24px blue circle) that follows the mouse
 * 2. Click ripple animation (expanding ring on pointerdown)
 * 3. AudioBufferSourceNode.start patch to capture raw PCM from Live API voice
 * 4. AudioNode.connect patch to detect GainNode→destination for AnalyserNode idle detection
 */
function clickHighlightScript() {
  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIO PATCHES FIRST — these don't need the DOM and MUST run immediately.
  // CRITICAL: DOM operations (document.documentElement.appendChild) CANNOT go
  // before these patches because document.documentElement is null when
  // addInitScript runs on about:blank or during early page creation.  If they
  // throw, the entire function aborts and the audio patches never execute.
  // ═══════════════════════════════════════════════════════════════════════════

  // --- Raw PCM capture via AudioBufferSourceNode.prototype.start ---
  // Captures every audio buffer played through a 24kHz AudioContext
  // (the Live API output path).
  window.__demoPCMBuffers = []      // {samples: Float32Array, when, ctxTime}
  window.__demoPCMSampleRate = 0
  window.__demoPCMCaptureStartMs = 0

  var origStart = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
    if (this.buffer && this.buffer.numberOfChannels > 0) {
      var sr = this.buffer.sampleRate
      // Only capture 24kHz audio (Live API output context)
      if (sr >= 22000 && sr <= 26000) {
        try {
          var pcm = this.buffer.getChannelData(0)
          window.__demoPCMBuffers.push({
            samples: new Float32Array(pcm), // copy
            when: when || this.context.currentTime,
            ctxTime: this.context.currentTime,
          })
          window.__demoPCMSampleRate = sr
          // Track timing for idle detection
          window.__demoLastPCMBufferMs = Date.now()
          if (window.__demoPCMBuffers.length === 1) {
            window.__demoPCMCaptureStartMs = Date.now()
            console.log('[demo] First AI audio buffer captured (' + sr + 'Hz)')
          }
        } catch (err) {
          console.warn('[demo] PCM capture error:', err)
        }
      }
    }
    return origStart.call(this, when, offset, duration)
  }

  // --- AudioNode.connect patch for AnalyserNode idle detection ---
  window.__demoAIAudioLastActiveMs = 0
  window.__demoAIAudioWasActive = false
  window.__demoAIAudioIdle = true

  var origConnect = AudioNode.prototype.connect
  AudioNode.prototype.connect = function (dest) {
    // Detect GainNode → AudioDestinationNode (Live API output path)
    var isGainNode = this.gain && typeof this.gain.value === 'number'
    var isDestination = dest === this.context.destination
    if (isGainNode && isDestination && !window.__demoAnalyserSetUp) {
      try {
        window.__demoAnalyserSetUp = true
        var ctx = this.context
        var analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        origConnect.call(this, analyser)
        var idleData = new Uint8Array(analyser.frequencyBinCount)
        console.log('[demo] AnalyserNode idle detection set up via GainNode→destination')
        setInterval(function () {
          analyser.getByteTimeDomainData(idleData)
          var hasSignal = false
          for (var i = 0; i < idleData.length; i++) {
            if (Math.abs(idleData[i] - 128) > 2) { hasSignal = true; break }
          }
          if (hasSignal) {
            window.__demoAIAudioLastActiveMs = Date.now()
            window.__demoAIAudioWasActive = true
            window.__demoAIAudioIdle = false
          } else if (window.__demoAIAudioWasActive &&
                     Date.now() - window.__demoAIAudioLastActiveMs > 800) {
            window.__demoAIAudioIdle = true
          }
        }, 100)
      } catch (err) {
        console.warn('[demo] AnalyserNode setup failed:', err)
      }
    }
    return origConnect.apply(this, arguments)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM OPERATIONS — deferred until document.documentElement is available.
  // ═══════════════════════════════════════════════════════════════════════════

  function setupVisuals() {
    if (!document.documentElement) return

    // --- Cursor dot ---
    var dot = document.createElement('div')
    dot.id = '__demo_cursor'
    dot.style.cssText =
      'position:fixed;width:24px;height:24px;border-radius:50%;' +
      'background:rgba(66,133,244,0.7);pointer-events:none;z-index:99999;' +
      'transform:translate(-50%,-50%);transition:left 0.05s linear,top 0.05s linear;' +
      'left:-100px;top:-100px;box-shadow:0 0 8px rgba(66,133,244,0.4);'
    document.documentElement.appendChild(dot)

    document.addEventListener('pointermove', function (e) {
      dot.style.left = e.clientX + 'px'
      dot.style.top = e.clientY + 'px'
    }, true)

    // --- Click ripple ---
    document.addEventListener('pointerdown', function (e) {
      var ripple = document.createElement('div')
      ripple.style.cssText =
        'position:fixed;width:24px;height:24px;border-radius:50%;' +
        'border:3px solid rgba(66,133,244,0.8);pointer-events:none;z-index:99999;' +
        'transform:translate(-50%,-50%) scale(0.5);opacity:1;' +
        'left:' + e.clientX + 'px;top:' + e.clientY + 'px;'
      document.documentElement.appendChild(ripple)
      requestAnimationFrame(function () {
        ripple.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out'
        ripple.style.transform = 'translate(-50%,-50%) scale(2.5)'
        ripple.style.opacity = '0'
      })
      setTimeout(function () { ripple.remove() }, 600)
    }, true)
  }

  // Run visuals immediately if DOM is ready, otherwise defer
  if (document.documentElement) {
    setupVisuals()
  } else {
    document.addEventListener('DOMContentLoaded', setupVisuals)
  }
}

/**
 * All narration texts — pre-generated at startup. Feature-focused, no specific data values.
 * 15 entries covering every segment of the demo.
 */
const NARRATION_TEXTS = {
  // Cold Open — emotional hook
  coldOpen:
    "You said you'd call your mom. You didn't. " +
    "You said work-life balance was improving. You worked until midnight — again. " +
    "What if something could connect all of this?",

  // Sign-In — introduce the app and what we're about to see
  signIn:
    "This is Second-Self — an AI life companion, powered by Gemini. " +
    "You can continue with your own Google account. But let's sign in as the Demo User today.",

  // Hub — walk through the intelligent dashboard
  hub:
    "You start at the Hub — your intelligent dashboard. " +
    "Personalized daily focus, wellness alerts, action reminders — all surfaced before you ask. " +
    "Let's start with a chat.",

  // Chat setup (unused during chat — kept for reference)
  chatSetup:
    "You are seeing three Gemini models working together.",

  // 5 user simulation turns (spoken as the user)
  chatUser1:
    "Can you remind me to get a present for Jamie's birthday party next Friday?",

  chatUser2:
    "Yes. One more thing — I got my blood pressure checked today. Let me show you.",

  chatUser3:
    "That's helpful. I've been stressed lately with work and I know I need to take better care of myself.",

  // Chat page narration — played once after all chat turns complete
  chatNarration:
    "Notice what just happened. Claims, actions, emotional tone — " +
    "all extracted live by Gemini 3, linked to evidence. " +
    "The photo triggered agentic vision.",

  // Recap — walk through the recap modal
  recap:
    "Let's review the recap — AI-generated summary, emotional analysis, and every claim linked to evidence. " +
    "Conflicts flagged. Actions sorted by urgency. Nothing saved until you confirm.",

  // Hub → Reflect transition — brief return to Hub before Reflect
  hubToReflect:
    "Back at the Hub. Let's head over to Reflect — starting with your conversation history.",

  // Reflect: Memories — walk through conversation timeline
  reflectMemories:
    "Memories — every conversation captured with AI summaries, emotional context, and linked media.",

  // Reflect: About Me — walk through the knowledge graph
  reflectAboutMe:
    "About Me — a living knowledge graph. Every claim extracted by Gemini 3, ",

  // Reflect: Review Queue — walk through conflict resolution
  reflectReview:
    "The Review Queue — Gemini Embeddings flagged contradictions automatically. " +
    "Resolve conflicts to keep your knowledge graph accurate.",

  // Reflect: Commitments — Actions sub-tab
  reflectCommitmentsActions:
    "Commitments — actions sorted by urgency. Due today, this week, this month.",

  // Reflect: Commitments — Goals sub-tab
  reflectCommitmentsGoals:
    "Goals with milestones and progress tracking. " +
    "Linked to actions and claims — everything stays connected.",

  // Close — memorable tagline
  close:
    "Powered by Gemini models. " +
    "Second-Self — your life, understood.",
}

/**
 * Convert raw PCM 16-bit LE mono to WAV (for browser playback).
 */
function pcmToWav(pcmBase64, sampleRate = 24000) {
  const pcm = Buffer.from(pcmBase64, 'base64')
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcm.length
  const wav = Buffer.alloc(44 + dataSize)

  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + dataSize, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)            // chunk size
  wav.writeUInt16LE(1, 20)             // PCM format
  wav.writeUInt16LE(numChannels, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(byteRate, 28)
  wav.writeUInt16LE(blockAlign, 32)
  wav.writeUInt16LE(bitsPerSample, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(dataSize, 40)
  pcm.copy(wav, 44)

  return wav.toString('base64')
}

/**
 * Generate TTS audio for a single text using the Gemini native audio model.
 * Returns { mime, data } (base64) or null on failure.
 */
async function generateChirpAudio(ai, text) {
  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: TTS_VOICE },
          },
        },
      },
    })

    const part = response.candidates?.[0]?.content?.parts?.[0]
    if (!part?.inlineData?.data) return null

    const mimeType = part.inlineData.mimeType || ''
    const rawBase64 = part.inlineData.data

    // Gemini native audio returns PCM — wrap in WAV for browser <audio> playback
    if (mimeType.includes('L16') || mimeType.includes('pcm') || mimeType.includes('raw')) {
      const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || '24000', 10)
      return { mime: 'audio/wav', data: pcmToWav(rawBase64, sampleRate) }
    }

    // Already a browser-playable format (wav, mp3, ogg, etc.)
    return { mime: mimeType, data: rawBase64 }
  } catch (err) {
    console.warn(`  TTS generation error: ${err.message}`)
    return null
  }
}

/**
 * Pre-generate all narration audio in parallel at startup.
 * Populates audioCache with { mime, data } objects.
 */
async function pregenerateAllAudio() {
  if (!TTS_API_KEY) {
    console.warn('No TTS API key found (GOOGLE_TTS_API_KEY / VITE_GEMINI_API_KEY). Falling back to browser speechSynthesis.')
    return
  }

  // Ensure audio output directory exists
  if (!existsSync(AUDIO_DIR)) {
    mkdirSync(AUDIO_DIR, { recursive: true })
  }

  const ai = new GoogleGenAI({ apiKey: TTS_API_KEY })
  const total = Object.keys(NARRATION_TEXTS).length
  console.log(`Pre-generating ${total} audio clips with voice "${TTS_VOICE}" (${TTS_MODEL})...`)

  // Generate sequentially to avoid rate-limit issues
  let generated = 0
  let cached = 0
  let fail = 0
  for (const [key, text] of Object.entries(NARRATION_TEXTS)) {
    const wavPath = path.join(AUDIO_DIR, `${key}.wav`)
    const txtPath = path.join(AUDIO_DIR, `${key}.txt`)

    // Reuse existing WAV if the text hasn't changed
    if (existsSync(wavPath) && existsSync(txtPath)) {
      const savedText = readFileSync(txtPath, 'utf-8')
      if (savedText === text) {
        const wavData = readFileSync(wavPath).toString('base64')
        audioCache.set(text, { mime: 'audio/wav', data: wavData })
        textToKeyMap.set(text, key)
        cached++
        console.log(`  [${cached + generated}/${total}] ${key} (cached)`)
        continue
      }
    }

    let audio = await generateChirpAudio(ai, text)
    if (!audio) {
      // Retry once after a brief pause (handles transient rate-limit / network errors)
      console.log(`  Retrying ${key}...`)
      await sleep(2000)
      audio = await generateChirpAudio(ai, text)
    }
    if (audio) {
      audioCache.set(text, audio)
      textToKeyMap.set(text, key)

      // Save WAV file + text sidecar for future cache hits
      writeFileSync(wavPath, Buffer.from(audio.data, 'base64'))
      writeFileSync(txtPath, text)

      generated++
      console.log(`  [${cached + generated}/${total}] ${key}`)
    } else {
      fail++
      console.warn(`  FAILED: ${key}`)
    }
  }

  console.log(`  Audio ready: ${generated} generated, ${cached} cached${fail ? `, ${fail} failed (will use browser TTS)` : ''}`)
  console.log(`  WAV files saved to ${AUDIO_DIR}/`)
}

/** Preload fonts by injecting stylesheet links */
async function preloadFonts(page) {
  for (const url of FONT_URLS) {
    await page.evaluate((fontUrl) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = fontUrl
      document.head.appendChild(link)
    }, url)
  }
  await page.waitForFunction(
    () => document.fonts.ready.then(() => document.fonts.status === 'loaded'),
    { timeout: 15000 },
  ).catch(() => {})
  await page.waitForTimeout(1000)
}

/** Wait for fonts (including Material Symbols icons) to load after navigation */
async function waitForFonts(page) {
  // Ensure Material Symbols font link is present (CSS @import may be slow)
  await page.evaluate((fontUrls) => {
    for (const url of fontUrls) {
      if (!document.querySelector(`link[href="${url}"]`)) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = url
        document.head.appendChild(link)
      }
    }
  }, FONT_URLS)
  await page.waitForFunction(
    () => document.fonts.ready.then(() => document.fonts.status === 'loaded'),
    { timeout: 10000 },
  ).catch(() => {})
  // Specifically wait for Material Symbols to resolve on icon elements
  await page.waitForFunction(() => {
    const icons = document.querySelectorAll('.material-symbols-rounded, .material-symbols-outlined')
    if (icons.length === 0) return true
    const icon = icons[0]
    const style = window.getComputedStyle(icon)
    return style.fontFamily.includes('Material Symbols')
  }, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(800)
}

/**
 * Speak text aloud. Uses pre-generated Chirp 3: HD audio when available,
 * falls back to browser speechSynthesis otherwise.
 * @param {import('playwright').Page} page
 * @param {string} text
 * @param {number} rate  Playback rate (applied as Audio.playbackRate for Chirp, or SpeechSynthesisUtterance.rate for fallback)
 */
async function speak(page, text, rate = 1.05) {
  // Track audio timeline for FFmpeg merge
  const key = textToKeyMap.get(text)
  if (key && demoStartMs > 0) {
    audioTimeline.push({
      key,
      offsetMs: Date.now() - demoStartMs,
      rate,
      file: path.join(AUDIO_DIR, `${key}.wav`),
    })
  }

  const cached = audioCache.get(text)

  if (cached) {
    // Play Chirp 3: HD audio via browser <audio> element
    await page.evaluate(({ mime, data, rate }) => {
      return new Promise((resolve) => {
        const audio = new Audio(`data:${mime};base64,${data}`)
        audio.playbackRate = rate
        audio.onended = () => resolve(undefined)
        audio.onerror = () => resolve(undefined)
        audio.play().catch(() => resolve(undefined))
        // Safety timeout: 60s max
        setTimeout(() => resolve(undefined), 60000)
      })
    }, { mime: cached.mime, data: cached.data, rate })
    return
  }

  // Fallback: browser speechSynthesis
  await page.evaluate(({ text, rate }) => {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis
      synth.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = rate
      utter.pitch = 1.0
      utter.volume = 1.0
      const voices = synth.getVoices()
      const preferred = voices.find((v) => v.lang.startsWith('en') && v.name.includes('Google'))
        || voices.find((v) => v.lang.startsWith('en-US'))
        || voices.find((v) => v.lang.startsWith('en'))
      if (preferred) utter.voice = preferred
      utter.onend = () => resolve(undefined)
      utter.onerror = () => resolve(undefined)
      synth.speak(utter)
      setTimeout(() => resolve(undefined), 30000)
    })
  }, { text, rate })
}

/** Speak text AND type it into chat input simultaneously. */
async function speakAndType(page, text, rate = 1.1) {
  const input = page.locator('input[placeholder="Type a note..."]')
  const sendBtn = page.locator('button[aria-label="Send note"]')

  // Run TTS and typing in parallel
  await Promise.all([
    speak(page, text, rate),
    (async () => {
      await input.fill(text)
      await sleep(300)
      await sendBtn.click()
    })(),
  ])
}

/**
 * Wait for assistant response text to stabilize in .chat-center-assistant.
 * @param {import('playwright').Page} page
 * @param {number} timeout
 * @param {string} skipText  If provided, wait for text to DIFFER from this first (new response started)
 */
async function waitForResponse(page, timeout = 20000, skipText = '') {
  const deadline = Date.now() + timeout
  let lastText = ''
  let stableCount = 0

  while (Date.now() < deadline) {
    const text = await page.locator('.chat-center-assistant').textContent().catch(() => '')
    // Phase 1: If skipText provided, wait for text to differ from it (new response)
    if (skipText && text === skipText) {
      await sleep(200)
      continue
    }
    // Phase 2: Wait for text to stabilize
    if (text && text.length > 0 && text === lastText) {
      stableCount++
      if (stableCount >= 3) return text // Stable for ~1.5s
    } else {
      stableCount = 0
    }
    lastText = text || ''
    await sleep(200)
  }
  return lastText
}

/** Smooth-scroll to a selector and pause */
async function scrollTo(page, selector, pauseMs = 1500) {
  const el = page.locator(selector).first()
  if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
    await el.scrollIntoViewIfNeeded()
    await sleep(pauseMs)
  }
}

/** Prepare BP image: screenshot bp-reading.html → PNG if not present */
async function prepareBpImage(browser) {
  if (existsSync(BP_PNG)) {
    console.log('BP image already exists')
    return
  }
  console.log('Generating BP image from HTML...')
  const ctx = await browser.newContext({ viewport: { width: 390, height: 600 } })
  const pg = await ctx.newPage()
  await pg.goto(`file:///${BP_HTML.replace(/\\/g, '/')}`)
  await pg.waitForTimeout(1000)
  const monitor = pg.locator('.monitor')
  await monitor.screenshot({ path: BP_PNG })
  await ctx.close()
  console.log(`BP image saved to ${BP_PNG}`)
}

/** Warmup speechSynthesis voices (they return empty on first call in Chromium) */
async function warmupTTS(page) {
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis
      // Force voices load
      synth.getVoices()
      if (synth.getVoices().length > 0) {
        resolve(undefined)
        return
      }
      synth.onvoiceschanged = () => resolve(undefined)
      setTimeout(() => resolve(undefined), 3000)
    })
  })
  // Speak a silent utterance to fully initialize
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis
      const utter = new SpeechSynthesisUtterance('')
      utter.volume = 0
      utter.onend = () => resolve(undefined)
      utter.onerror = () => resolve(undefined)
      synth.speak(utter)
      setTimeout(() => resolve(undefined), 1000)
    })
  })
}

/** Log segment timing */
function logSegment(name, startTime) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  segmentTimings.push({ name, elapsed: `${elapsed}s` })
  console.log(`  [${name}] ${elapsed}s`)
}

/** Check if an element is visible within timeout, returns boolean */
async function isVisible(page, selector, timeout = 3000) {
  return page.locator(selector).first().isVisible({ timeout }).catch(() => false)
}

/** Dismiss any open detail-modal / backdrop overlays via Escape or clicking backdrop */
async function dismissOverlays(page) {
  // Try Escape first
  await page.keyboard.press('Escape')
  await sleep(300)
  // If detail-backdrop is still visible, click it to dismiss
  const backdrop = page.locator('.detail-backdrop')
  if (await backdrop.isVisible({ timeout: 500 }).catch(() => false)) {
    await backdrop.click({ position: { x: 5, y: 5 }, force: true }).catch(() => {})
    await sleep(300)
  }
  // One more Escape for good measure
  await page.keyboard.press('Escape')
  await sleep(100)
}

/** Stop any in-flight audio playback in the browser */
async function stopAudio(page) {
  await page.evaluate(() => {
    // Stop speechSynthesis
    window.speechSynthesis?.cancel()
    // Stop all <audio> elements
    document.querySelectorAll('audio').forEach((a) => { a.pause(); a.remove() })
  }).catch(() => {})
}

// ---------------------------------------------------------------------------
// AI Audio Idle Detection (for turn-taking)
// ---------------------------------------------------------------------------

/**
 * Wait for the in-browser AI audio (Live API voice) to finish playing.
 *
 * Detection strategy (in priority order):
 * 1. AnalyserNode — real-time signal detection (800ms silence after activity)
 * 2. PCM buffer scheduling — estimates playback end from the last buffer's
 *    scheduled time + duration, plus 1s safety margin
 * 3. Fixed delay — 8s if no detection method available
 */
async function waitForAIAudioIdle(page, timeout = 30000) {
  const captureState = await page.evaluate(() => ({
    hasAnalyser: !!window.__demoAnalyserSetUp,
    pcmCount: (window.__demoPCMBuffers || []).length,
  })).catch(() => ({ hasAnalyser: false, pcmCount: 0 }))

  if (!captureState.hasAnalyser && captureState.pcmCount === 0) {
    await sleep(8000)
    return
  }

  const deadline = Date.now() + timeout
  const noAudioDeadline = Date.now() + 5000

  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      // AnalyserNode: real-time signal detection
      if (window.__demoAnalyserSetUp) {
        return {
          idle: window.__demoAIAudioIdle,
          wasActive: window.__demoAIAudioWasActive,
          method: 'analyser',
        }
      }
      // PCM: estimate when all scheduled audio finishes playing
      const bufs = window.__demoPCMBuffers || []
      if (bufs.length === 0) return { idle: true, wasActive: false, method: 'pcm' }
      const lastBuf = bufs[bufs.length - 1]
      const sr = window.__demoPCMSampleRate || 24000
      const lastEndTime = lastBuf.when + (lastBuf.samples.length / sr)
      // Check if the AudioContext has played past the last scheduled buffer + 1s margin
      try {
        const ctx = bufs[0].samples ? null : null // ctx reference not directly available
        // Fallback: use wall-clock timing — no new buffers for 1.5s AND
        // enough time has passed since last buffer was scheduled for it to finish
        const lastMs = window.__demoLastPCMBufferMs || 0
        const timeSinceLast = Date.now() - lastMs
        return {
          idle: lastMs > 0 && timeSinceLast > 1500,
          wasActive: true,
          method: 'pcm',
        }
      } catch {
        return { idle: true, wasActive: true, method: 'pcm' }
      }
    }).catch(() => ({ idle: true, wasActive: true, method: 'none' }))

    if (state.wasActive && state.idle) return
    if (!state.wasActive && Date.now() > noAudioDeadline) {
      console.warn('  No AI audio detected — proceeding')
      return
    }
    await sleep(100)
  }
  console.warn('  waitForAIAudioIdle timed out')
}

/** Reset AI audio tracking state so we can detect the next AI turn's audio. */
async function resetAIAudioState(page) {
  await page.evaluate(() => {
    window.__demoAIAudioWasActive = false
    window.__demoAIAudioIdle = true
    window.__demoLastPCMBufferMs = 0 // reset PCM timing for next turn
  }).catch(() => {})
}

/** Type text into chat input and send (without playing audio). */
async function typeAndSend(page, text) {
  const input = page.locator('input[placeholder="Type a note..."]')
  const sendBtn = page.locator('button[aria-label="Send note"]')
  await input.fill(text)
  await sleep(300)
  await sendBtn.click()
}

/**
 * Extract captured AI chat audio from raw PCM buffers collected via
 * AudioBufferSourceNode.prototype.start patch.
 * Reconstructs timing, converts to WAV, and writes to disk.
 * Must be called while still on the chat page.
 */
async function extractChatAudio(page) {
  chatAudioFile = path.join(AUDIO_DIR, 'chat-ai.wav')
  const pcmData = await page.evaluate(() => {
    const buffers = window.__demoPCMBuffers
    if (!buffers || buffers.length === 0) {
      console.log('[demo] No PCM buffers captured')
      return null
    }
    const sampleRate = window.__demoPCMSampleRate || 24000
    console.log('[demo] Reconstructing audio from', buffers.length, 'PCM buffers at', sampleRate, 'Hz')

    // Sort by scheduled time
    buffers.sort((a, b) => a.when - b.when)

    // Calculate total duration based on scheduled times
    const firstTime = buffers[0].when
    const lastBuf = buffers[buffers.length - 1]
    const lastDuration = lastBuf.samples.length / sampleRate
    const totalDuration = (lastBuf.when - firstTime) + lastDuration
    const totalSamples = Math.ceil(totalDuration * sampleRate)

    console.log('[demo] Total duration:', totalDuration.toFixed(2), 's,', totalSamples, 'samples')

    // Mix all buffers into a single PCM stream at correct time offsets
    const output = new Float32Array(totalSamples)
    for (const buf of buffers) {
      const startSample = Math.round((buf.when - firstTime) * sampleRate)
      for (let i = 0; i < buf.samples.length; i++) {
        const idx = startSample + i
        if (idx >= 0 && idx < totalSamples) {
          output[idx] += buf.samples[i]
        }
      }
    }

    // Clamp to [-1, 1] and convert Float32 → Int16
    const int16 = new Int16Array(totalSamples)
    for (let i = 0; i < totalSamples; i++) {
      const s = Math.max(-1, Math.min(1, output[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    // Convert Int16 PCM to base64 in chunks (avoids stack overflow)
    const bytes = new Uint8Array(int16.buffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, bytes.length)))
    }

    return {
      pcmBase64: btoa(binary),
      sampleRate,
      numSamples: totalSamples,
      numBuffers: buffers.length,
      startMs: window.__demoPCMCaptureStartMs,
    }
  }).catch((err) => {
    console.log('  Chat audio extraction error:', err?.message || err)
    return null
  })

  if (pcmData && pcmData.numSamples > 0) {
    if (!existsSync(AUDIO_DIR)) mkdirSync(AUDIO_DIR, { recursive: true })

    // Write WAV file from raw PCM Int16 data
    const pcmBuf = Buffer.from(pcmData.pcmBase64, 'base64')
    const wavHeader = Buffer.alloc(44)
    const dataSize = pcmBuf.length
    const sr = pcmData.sampleRate
    wavHeader.write('RIFF', 0)
    wavHeader.writeUInt32LE(36 + dataSize, 4)
    wavHeader.write('WAVE', 8)
    wavHeader.write('fmt ', 12)
    wavHeader.writeUInt32LE(16, 16)         // chunk size
    wavHeader.writeUInt16LE(1, 20)          // PCM format
    wavHeader.writeUInt16LE(1, 22)          // mono
    wavHeader.writeUInt32LE(sr, 24)         // sample rate
    wavHeader.writeUInt32LE(sr * 2, 28)     // byte rate (mono 16-bit)
    wavHeader.writeUInt16LE(2, 32)          // block align
    wavHeader.writeUInt16LE(16, 34)         // bits per sample
    wavHeader.write('data', 36)
    wavHeader.writeUInt32LE(dataSize, 40)
    writeFileSync(chatAudioFile, Buffer.concat([wavHeader, pcmBuf]))

    chatAudioOffsetMs = pcmData.startMs - demoStartMs
    const durationSec = (pcmData.numSamples / sr).toFixed(1)
    console.log(`  Chat AI audio captured: ${pcmData.numBuffers} buffers, ${durationSec}s, offset ${chatAudioOffsetMs}ms`)
    console.log(`  Saved to ${chatAudioFile}`)
  } else {
    chatAudioFile = ''
    console.log('  No chat AI audio captured')
  }
}

// ---------------------------------------------------------------------------
// Segment Functions
// ---------------------------------------------------------------------------

/**
 * COLD OPEN (0:00 - 0:10)
 * Black screen with fading text, narration.
 */
async function coldOpen(page) {
  const t0 = Date.now()
  console.log('Segment: Cold Open')

  await page.goto('about:blank')
  // Inject cold open content
  await page.evaluate(() => {
    document.body.style.cssText = 'margin:0;padding:0;background:#000;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:Inter,sans-serif;overflow:hidden;'

    const lines = [
      { text: '"I\'ll call Mom this weekend."', sub: '— You didn\'t.' },
      { text: '"Work-life balance is improving."', sub: '— Midnight. Again.' },
      { text: 'What if something could connect all of this?', sub: '' },
    ]

    const container = document.createElement('div')
    container.style.cssText = 'text-align:center;padding:0 32px;'

    lines.forEach((line, i) => {
      const div = document.createElement('div')
      div.style.cssText = `opacity:0;transform:translateY(16px);transition:opacity 0.8s ease,transform 0.8s ease;margin-bottom:24px;`
      const mainText = document.createElement('div')
      mainText.style.cssText = 'color:#e0e0e0;font-size:18px;font-weight:500;line-height:1.5;font-style:italic;'
      mainText.textContent = line.text
      div.appendChild(mainText)
      if (line.sub) {
        const subText = document.createElement('div')
        subText.style.cssText = 'color:#888;font-size:14px;margin-top:4px;'
        subText.textContent = line.sub
        div.appendChild(subText)
      }
      container.appendChild(div)

      // Stagger fade-in — extra 3s pause before the final line
      const delay = i < lines.length - 1 ? i * 3500 + 1000 : (i - 1) * 3500 + 1000 + 2500 + 3500
      setTimeout(() => {
        div.style.opacity = '1'
        div.style.transform = 'translateY(0)'
      }, delay)
    })

    document.body.appendChild(container)
  })

  // Narration over the cold open
  await speak(page, NARRATION_TEXTS.coldOpen, 1.0)

  await sleep(1000)
  logSegment('Cold Open', t0)
}

/**
 * HUB SEGMENT (0:14 - 0:40)
 * Sign-in narration over login screen, then Hub walkthrough with pre-generated narration.
 */
async function hubSegment(page, context) {
  const t0 = Date.now()
  console.log('Segment: Hub')

  // Clear storage to force login
  await context.clearCookies()
  await page.goto(`${BASE_URL}/?forceLogin`)
  await page.waitForLoadState('domcontentloaded')
  await preloadFonts(page)
  await waitForFonts(page)

  // Sign-in narration plays OVER the login screen
  await speak(page, NARRATION_TEXTS.signIn, 1.05)

  // Click demo sign-in button
  const demoBtn = page.getByRole('button', { name: /sign in for demo/i })
  if (await demoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await demoBtn.click()
    await page.waitForSelector('.login-screen', { state: 'hidden', timeout: 30000 }).catch(() => {})
    await sleep(2000)
  }

  // Reload to ensure profile data is fully loaded after sign-in
  await page.goto(BASE_URL + '/')
  await page.waitForLoadState('domcontentloaded')
  await waitForFonts(page)
  // Wait for profile name to resolve (avoids "Good morning, there" flash)
  //await page.waitForFunction(
  //  () => {
  //    const el = document.querySelector('.hub-greeting-title')
  //    return el && !el.textContent.includes('there')
  //  },
  //  { timeout: 10000 },
  //).catch(() => {})
  //await sleep(200)

  // Hub narration plays while slowly scrolling through full page
  const narrationPromise = speak(page, NARRATION_TEXTS.hub, 1.05)

  await narrationPromise
  await sleep(1000)
  logSegment('Hub', t0)
}

/**
 * CHAT SEGMENT (0:40 - 2:00+)
 * 5-turn voice session with realistic turn-taking.
 *
 * Turn-taking logic:
 *   1. Navigate to chat, start generating first user audio immediately
 *   2. Click mic → AI greeting → wait for greeting audio to finish
 *   3. Play pre-generated user audio → send text → wait for AI response + audio
 *   4. Repeat for 5 turns
 *   5. After the LAST AI audio truly finishes, play voiceover, then extract audio
 *
 * No voiceover narration plays during the live chat interaction.
 */
async function chatSegment(page) {
  const t0 = Date.now()
  console.log('Segment: Chat')

  // 1. Navigate to Chat and play chatSetup voiceover immediately.
  //    This short intro finishes before the ChatAgent can respond.
  await page.goto(BASE_URL + '/chat')
  await page.waitForLoadState('domcontentloaded')
  await waitForFonts(page)
  await speak(page, NARRATION_TEXTS.chatSetup, 1.05)

  // 2. Click mic to start Live API session
  const micBtn = page.locator('button[aria-label="Microphone"]')
  if (await micBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await micBtn.click()
  }

  // Wrap conversation in try/finally so we ALWAYS extract captured AI audio,
  // even if a turn times out.  The PCM buffers are lost once we navigate away.
  try {
    // 3. Wait for AI greeting text + audio to finish
    let lastAiText = await waitForResponse(page, 10000)
    await waitForAIAudioIdle(page)

    // 4. Four-turn conversation with proper turn-taking
    const userTurns = [
      { text: NARRATION_TEXTS.chatUser1, label: 'Restaurant booking' },
      { text: NARRATION_TEXTS.chatUser2, label: 'Blood pressure photo' },
      { text: NARRATION_TEXTS.chatUser3, label: 'Wrap-up' },
    ]

    for (let i = 0; i < userTurns.length; i++) {
      const turnNum = i + 1
      const { text, label } = userTurns[i]
      console.log(`  Turn ${turnNum}: ${label}`)

      // a. Play user simulation audio (AI audio from previous turn already finished)
      await speak(page, text, 1.1)

      // b. Reset AI audio state for fresh detection of the next AI response
      await resetAIAudioState(page)

      // c. Send user text to trigger AI response
      await typeAndSend(page, text)

      // d. Attach BP image as soon as ChatAgent starts responding to turn 1
      if (turnNum === 2 && existsSync(BP_PNG)) {
        await sleep(500) // let AI response begin first
        const fileInput = page.locator('input[type="file"]')
        if (await fileInput.count() > 0) {
          await fileInput.setInputFiles(BP_PNG)
          console.log('    Attachment uploaded — analysis running in background')
        }
      }

      // e. Wait for AI response text to stabilize
      lastAiText = await waitForResponse(page, turnNum === 4 ? 30000 : 20000, lastAiText)

      // f. Turn-specific actions: interact with action cards (appear after AI response)
      if (turnNum === 2) {
        const addBtn = page.locator('button.chat-action-add').first()
        if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await addBtn.click()
          await sleep(200)
        }
      }
      if (turnNum === 3) {
        const dismissBtn = page.locator('button.chat-action-dismiss').first()
        if (await dismissBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await dismissBtn.click()
          await sleep(200)
        }
      }

      // g. Wait for AI audio to finish before next user turn (or voiceover)
      await waitForAIAudioIdle(page)
    }

    // 5. Ensure image analysis result has been sent to the Live API.
    //    analyzeImage runs in the background while turns play out. We must
    //    wait for it to finish BEFORE ending the session, otherwise the
    //    voice session disconnects and the result is lost.
    {
      const sent = await page.waitForFunction(
        () => (window).__imageAnalysisSent === true,
        { timeout: 45000 },
      ).then(() => true).catch(() => false)
      if (sent) {
        console.log('    Image analysis sent to ChatAgent ✓')
      } else {
        console.warn('    Image analysis did not complete in time')
      }
    }

    // 6. Wait until AI has been continuously silent for >2 seconds.
    //    The Chat Agent sometimes pauses mid-response before continuing,
    //    so a single idle detection isn't enough — we need sustained silence.
    {
      let silentSince = Date.now()
      const silenceRequired = 4000  // 4s of continuous silence
      const deadline = Date.now() + 45000
      while (Date.now() < deadline) {
        const isIdle = await page.evaluate(() => {
          if (window.__demoAnalyserSetUp) return !!window.__demoAIAudioIdle
          const lastMs = window.__demoLastPCMBufferMs || 0
          if (lastMs === 0) return false  // no audio yet
          return (Date.now() - lastMs) > 500
        }).catch(() => true)

        if (!isIdle) {
          silentSince = Date.now()  // AI resumed — reset silence timer
        }

        if (Date.now() - silentSince >= silenceRequired) break
        await sleep(100)
      }
    }

    // 7. Play the single chat page voiceover (only after AI is completely silent)
    await speak(page, NARRATION_TEXTS.chatNarration, 1.05)
  } finally {
    // 8. ALWAYS extract captured AI audio, even if conversation threw.
    //    PCM buffers accumulated up to the error are still in window.__demoPCMBuffers.
    //    Must happen while still on chat page (AudioContext still open).
    await extractChatAudio(page).catch((err) => {
      console.warn('  extractChatAudio failed:', err?.message || err)
    })
  }

  logSegment('Chat', t0)
}

/**
 * RECAP SEGMENT (2:00 - 2:20)
 * End session, scroll through Recap modal with pre-generated narration.
 */
async function recapSegment(page) {
  const t0 = Date.now()
  console.log('Segment: Recap')

  // End session
  const endBtn = page.locator('button[aria-label="End session"]')
  if (await endBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await endBtn.click()
  } else {
    const hangupBtn = page.locator('.chat-hangup')
    if (await hangupBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hangupBtn.click()
    }
  }

  // Wait for recap modal
  await page.waitForSelector('.recap-backdrop', { timeout: 15000 }).catch(() => {})
  await sleep(1000)

  // Speak pre-generated narration while scrolling through recap
  const narrationPromise = speak(page, NARRATION_TEXTS.recap, 1.05)

  // Scroll AI Summary
  await scrollTo(page, '.recap-card', 1000)

  // Tap "Why?" on a claim to show evidence
  const whyBtn = page.locator('.recap-receipt-toggle').first()
  if (await whyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await whyBtn.click()
    await sleep(1000)
    await dismissOverlays(page)
  }

  await sleep(200)

  // Tap + to save a suggested action
  const saveBtn = page.locator('.recap-suggested-save').first()
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click({ force: true }).catch(() => {})
    await sleep(200)
  }

  // Tap + to recover a rejected action
  const saveBtn2 = page.locator('.recap-suggested-save').first()
  if (await saveBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn2.click({ force: true }).catch(() => {})
    await sleep(200)
  }


  // MUST await narration before navigating
  await narrationPromise

  // Close recap and navigate back to Hub (instead of going directly to Reflect)
  await page.goto(BASE_URL + '/')
  await page.waitForLoadState('domcontentloaded')
  await sleep(100)

  logSegment('Recap', t0)
}

/**
 * HUB → REFLECT TRANSITION
 * Brief return to Hub after Recap, then navigate to Reflect via bottom nav.
 */
async function hubToReflectSegment(page) {
  const t0 = Date.now()
  console.log('Segment: Hub → Reflect')

  // Ensure we're on the Hub
  await page.goto(BASE_URL + '/')
  await page.waitForLoadState('domcontentloaded')
  await waitForFonts(page)
  await sleep(200)

  // Brief transition narration
  await speak(page, NARRATION_TEXTS.hubToReflect, 1.05)

  // Navigate to Reflect via bottom nav
  const reflectLink = page.locator('nav a[href*="/reflect"], a[href*="/reflect"]').first()
  if (await reflectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await reflectLink.click()
    await page.waitForLoadState('domcontentloaded')
  }

  await sleep(100)
  logSegment('Hub → Reflect', t0)
}

/**
 * REFLECT: MEMORIES
 * Navigate Memories tab (default) with narration.
 */
async function reflectMemories(page) {
  const t0 = Date.now()
  console.log('Segment: Reflect - Memories')

  // Should already be on /reflect (Memories is default tab)
  await page.goto(BASE_URL + '/reflect')
  await page.waitForLoadState('domcontentloaded')
  await waitForFonts(page)
  await sleep(200)

  await speak(page, NARRATION_TEXTS.reflectMemories, 1.05)
  await sleep(100)
  logSegment('Reflect: Memories', t0)
}

/**
 * REFLECT: ABOUT ME
 * Navigate About Me tab with narration.
 */
async function reflectAboutMe(page) {
  const t0 = Date.now()
  console.log('Segment: Reflect - About Me')

  // Navigate to About Me tab
  const profileTab = page.locator('a[href*="tab=profile"]')
  if (await profileTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await profileTab.click()
  } else {
    await page.goto(BASE_URL + '/reflect?tab=profile')
  }
  await page.waitForLoadState('domcontentloaded')
  await waitForFonts(page)
  await sleep(200)

  await speak(page, NARRATION_TEXTS.reflectAboutMe, 1.05)
  await sleep(100)
  logSegment('Reflect: About Me', t0)
}

/**
 * REFLECT: REVIEW QUEUE (2:34 - 2:46)
 * Navigate Review tab with pre-generated narration.
 */
async function reflectReviewQueue(page) {
  const t0 = Date.now()
  console.log('Segment: Reflect - Review Queue')

  // Navigate to Review tab
  const reviewTab = page.locator('a[href*="tab=review"]')
  if (await reviewTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await reviewTab.click()
  } else {
    await page.goto(BASE_URL + '/reflect?tab=review')
  }
  await page.waitForLoadState('domcontentloaded')
  await waitForFonts(page)
  await sleep(200)

  await speak(page, NARRATION_TEXTS.reflectReview, 1.05)
  await sleep(100)
  logSegment('Reflect: Review Queue', t0)
}

/**
 * REFLECT: COMMITMENTS — ACTIONS
 * Navigate Commitments tab (Actions sub-tab) with pre-generated narration.
 */
async function reflectCommitmentsActions(page) {
  const t0 = Date.now()
  console.log('Segment: Reflect - Commitments (Actions)')

  // Navigate to Commitments tab (defaults to Actions sub-tab)
  const commitTab = page.locator('a[href*="tab=follow-ups"]')
  if (await commitTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await commitTab.click()
  } else {
    await page.goto(BASE_URL + '/reflect?tab=follow-ups')
  }
  await page.waitForLoadState('domcontentloaded')
  await waitForFonts(page)
  // Scroll to top (previous tab may have left scroll position at bottom)
  await page.evaluate(() => {
    const container = document.querySelector('.reflect-main')
    if (container) container.scrollTop = 0
  }).catch(() => {})
  await sleep(200)

  await speak(page, NARRATION_TEXTS.reflectCommitmentsActions, 1.05)
  await sleep(100)
  logSegment('Reflect: Commitments (Actions)', t0)
}

/**
 * REFLECT: COMMITMENTS — GOALS
 * Switch to Goals sub-tab with pre-generated narration.
 */
async function reflectCommitmentsGoals(page) {
  const t0 = Date.now()
  console.log('Segment: Reflect - Commitments (Goals)')

  // Click the Goals chip to switch sub-tab
  const goalsChip = page.locator('button.reflect-chip', { hasText: 'Goals' })
  if (await goalsChip.isVisible({ timeout: 3000 }).catch(() => false)) {
    await goalsChip.click()
  }
  await sleep(200)

  await speak(page, NARRATION_TEXTS.reflectCommitmentsGoals, 1.05)
  await sleep(100)
  logSegment('Reflect: Commitments (Goals)', t0)
}

/**
 * CLOSE SEGMENT (2:50 - 3:00)
 * Inject tagline overlay on current page (after Review), play closing narration.
 */
async function closeSegment(page) {
  const t0 = Date.now()
  console.log('Segment: Close')

  // Inject full-screen tagline overlay on current page (no navigation)
  await page.evaluate(() => {
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:10000;opacity:0;transition:opacity 1s ease;'

    const stats = document.createElement('div')
    stats.style.cssText = 'color:#aaa;font-size:14px;letter-spacing:2px;margin-bottom:32px;text-align:center;'
    stats.textContent = '3 Gemini Models  |  12 Integration Points'
    overlay.appendChild(stats)

    const title = document.createElement('div')
    title.style.cssText = 'color:#fff;font-size:28px;font-weight:700;letter-spacing:1px;margin-bottom:8px;'
    title.textContent = 'Second-Self'
    overlay.appendChild(title)

    const subtitle = document.createElement('div')
    subtitle.style.cssText = 'color:#888;font-size:16px;font-style:italic;'
    subtitle.textContent = 'Your life, understood.'
    overlay.appendChild(subtitle)

    document.body.appendChild(overlay)
    requestAnimationFrame(() => { overlay.style.opacity = '1' })
  })

  // Wait for overlay fade-in, then play closing narration
  await sleep(1500)
  await speak(page, NARRATION_TEXTS.close, 0.95)
  await sleep(2000)
  logSegment('Close', t0)
}

// ---------------------------------------------------------------------------
// FFmpeg Audio Merge
// ---------------------------------------------------------------------------

/**
 * Merge the silent Playwright video with narration WAVs and captured chat AI audio.
 * Produces `final-demo.webm` in DEMO_OUTPUT_DIR.
 * Falls back to saving audioTimeline.json + instructions if ffmpeg-static is unavailable.
 */
async function mergeVideoAudio(videoPath) {
  if (!videoPath || !existsSync(videoPath)) {
    console.warn('  No video file found — skipping audio merge')
    return
  }

  // Log audio timeline
  console.log(`\n  Audio timeline (${audioTimeline.length} narration clips):`)
  for (const entry of audioTimeline) {
    console.log(`    ${entry.key}: offset=${entry.offsetMs}ms, rate=${entry.rate}`)
  }
  if (chatAudioFile && existsSync(chatAudioFile)) {
    console.log(`    chat-ai: offset=${chatAudioOffsetMs}ms`)
  }

  // Save timeline for reference / manual merge
  const timelinePath = path.join(DEMO_OUTPUT_DIR, 'audioTimeline.json')
  writeFileSync(timelinePath, JSON.stringify({ audioTimeline, chatAudioOffsetMs, chatAudioFile }, null, 2))

  if (!ffmpegPath) {
    console.warn('\n  ffmpeg-static not installed — skipping automatic merge.')
    console.log('  To merge manually:')
    console.log('    1. Install ffmpeg-static: npm install --save-dev ffmpeg-static')
    console.log('    2. Re-run the demo, or use the saved files:')
    console.log(`       - Video: ${videoPath}`)
    console.log(`       - Audio timeline: ${timelinePath}`)
    console.log(`       - WAV files: ${AUDIO_DIR}/`)
    return
  }

  console.log('\n  Merging video + audio with FFmpeg...')

  // Build FFmpeg inputs and filter_complex
  const inputs = ['-i', videoPath]
  const filterParts = []
  let inputIdx = 1 // 0 is the video

  // Count valid audio inputs first so we know N for volume boost
  const validNarration = audioTimeline.filter(e => existsSync(e.file) && statSync(e.file).size > 44)
  const hasChatAudio = chatAudioFile && existsSync(chatAudioFile) && statSync(chatAudioFile).size > 44
  const totalAudioInputs = validNarration.length + (hasChatAudio ? 1 : 0)
  // volume=N perfectly compensates amix's 1/N averaging (net 1×).
  // Use N/2 for a comfortable listening level (net 0.5×, i.e. −6 dB).
  const boost = totalAudioInputs / 2

  // Add narration WAV inputs (validate each file is a real WAV > 44 bytes header)
  // Pre-boost each input to compensate for amix's inherent 1/N averaging
  // across active inputs.  Without this, audio is nearly inaudible.
  for (const entry of validNarration) {
    inputs.push('-i', entry.file)
    const delayMs = Math.max(0, Math.round(entry.offsetMs))
    // Apply volume boost, playback rate via atempo, then delay
    if (entry.rate !== 1.0) {
      filterParts.push(`[${inputIdx}:a]volume=${boost},atempo=${entry.rate},adelay=${delayMs}|${delayMs}[a${inputIdx}]`)
    } else {
      filterParts.push(`[${inputIdx}:a]volume=${boost},adelay=${delayMs}|${delayMs}[a${inputIdx}]`)
    }
    inputIdx++
  }

  // Add chat AI audio if captured and valid
  if (hasChatAudio) {
    inputs.push('-i', chatAudioFile)
    const delayMs = Math.max(0, Math.round(chatAudioOffsetMs))
    filterParts.push(`[${inputIdx}:a]volume=${boost},adelay=${delayMs}|${delayMs}[a${inputIdx}]`)
    inputIdx++
  }

  if (filterParts.length === 0) {
    console.log('  No audio tracks to merge — copying video as-is')
    const finalPath = path.join(DEMO_OUTPUT_DIR, 'final-demo.webm')
    copyFileSync(videoPath, finalPath)
    console.log(`  Final video: ${finalPath}`)
    return
  }

  const numAudioInputs = inputIdx - 1
  // Each input was pre-boosted by volume=N, so amix's inherent 1/N averaging
  // brings them back to their original level.  normalize=0 prevents amix from
  // further adjusting levels when inputs drop out.
  const audioLabels = Array.from({ length: numAudioInputs }, (_, i) => `[a${i + 1}]`).join('')
  filterParts.push(`${audioLabels}amix=inputs=${numAudioInputs}:duration=longest:dropout_transition=0:normalize=0[aout]`)

  const filterComplex = filterParts.join(';')
  const finalPath = path.join(DEMO_OUTPUT_DIR, 'final-demo.webm')

  const ffmpegArgs = [
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '0:v',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-y',
    finalPath,
  ]

  try {
    console.log(`  Running: ffmpeg ... (${inputIdx} inputs, ${numAudioInputs} audio tracks)`)
    console.log(`  Filter: ${filterComplex.substring(0, 200)}...`)
    execFileSync(ffmpegPath, ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
    })
    console.log(`  Final video with audio: ${finalPath}`)
  } catch (err) {
    const stderr = err.stderr?.toString() || ''
    console.error(`  FFmpeg merge failed: ${err.message}`)
    if (stderr) console.error(`  FFmpeg stderr: ${stderr.slice(-500)}`)
    // Fallback: try without chat audio (in case it's the problematic input)
    if (chatAudioFile && existsSync(chatAudioFile) && numAudioInputs > 1) {
      console.log('  Retrying without chat AI audio...')
      try {
        const retryInputs = ['-i', videoPath]
        const retryParts = []
        let retryIdx = 1
        const retryValid = audioTimeline.filter(e => existsSync(e.file) && statSync(e.file).size > 44)
        const retryBoost = retryValid.length / 2
        for (const entry of retryValid) {
          retryInputs.push('-i', entry.file)
          const delayMs = Math.max(0, Math.round(entry.offsetMs))
          if (entry.rate !== 1.0) {
            retryParts.push(`[${retryIdx}:a]volume=${retryBoost},atempo=${entry.rate},adelay=${delayMs}|${delayMs}[a${retryIdx}]`)
          } else {
            retryParts.push(`[${retryIdx}:a]volume=${retryBoost},adelay=${delayMs}|${delayMs}[a${retryIdx}]`)
          }
          retryIdx++
        }
        if (retryParts.length > 0) {
          const retryNum = retryIdx - 1
          const retryLabels = Array.from({ length: retryNum }, (_, i) => `[a${i + 1}]`).join('')
          retryParts.push(`${retryLabels}amix=inputs=${retryNum}:duration=longest:dropout_transition=0:normalize=0[aout]`)
          const retryArgs = [
            ...retryInputs,
            '-filter_complex', retryParts.join(';'),
            '-map', '0:v', '-map', '[aout]',
            '-c:v', 'copy', '-c:a', 'libopus', '-b:a', '128k',
            '-y', finalPath,
          ]
          execFileSync(ffmpegPath, retryArgs, { stdio: 'pipe', timeout: 120000 })
          console.log(`  Retry succeeded: ${finalPath}`)
        }
      } catch (retryErr) {
        console.error(`  Retry also failed: ${retryErr.message}`)
        console.log(`  Silent video still available at: ${videoPath}`)
      }
    } else {
      console.log(`  Silent video still available at: ${videoPath}`)
    }
    console.log(`  Audio timeline saved to: ${timelinePath}`)
  }
}

// ---------------------------------------------------------------------------
// Main Orchestrator
// ---------------------------------------------------------------------------

async function main() {
  const totalStart = Date.now()
  console.log('=== Second-Self Demo Script ===\n')

  // Ensure output directory
  if (!existsSync(DEMO_OUTPUT_DIR)) {
    mkdirSync(DEMO_OUTPUT_DIR, { recursive: true })
  }

  // Push demo data (deletes existing data first, then pushes fresh data)
  console.log('Pushing demo data...')
  try {
    const pushScript = path.join(__dirname, 'push-demo-data.ts')
    if (process.platform === 'win32') {
      execFileSync(process.env.ComSpec || 'cmd.exe', [
        '/c', 'npx', 'tsx', pushScript,
      ], { cwd: APP_DIR, stdio: 'inherit', timeout: 60000 })
    } else {
      execFileSync('npx', [
        'tsx', pushScript,
      ], { cwd: APP_DIR, stdio: 'inherit', timeout: 60000 })
    }
    console.log('Demo data pushed\n')
  } catch (err) {
    console.warn(`  Warning: push-demo-data failed (${err.message}). Continuing anyway.\n`)
  }

  // Start server + pre-generate TTS audio in parallel
  await Promise.all([
    startServer(),
    pregenerateAllAudio(),
  ])

  // Launch browser
  console.log('\nLaunching browser...')
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })

  // Prepare BP image
  await prepareBpImage(browser)

  // Create context with video recording
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir: DEMO_OUTPUT_DIR,
      size: VIEWPORT,
    },
    permissions: ['microphone'],
  })

  // Inject click highlighting + audio capture into every page
  await context.addInitScript(clickHighlightScript)

  // Clear storage for clean start
  await context.clearCookies()

  const page = await context.newPage()
  page.setDefaultTimeout(15000)

  // Capture browser console for debugging attachment flow
  page.on('console', msg => {
    const text = msg.text()
    if (text.startsWith('[Attachment]') || text.startsWith('[LiveAPI]') || text.startsWith('[analyzeImage]')) {
      console.log(`  [browser] ${text}`)
    }
  })

  // Warmup TTS
  console.log('Warming up TTS...')
  await page.goto('about:blank')
  await warmupTTS(page)
  console.log('TTS ready\n')

  console.log('--- Running segments ---\n')

  // Track demo start time for audio timeline offsets
  demoStartMs = Date.now()

  // Run each segment with try/catch for resilience
  const segments = [
    () => coldOpen(page),
    () => hubSegment(page, context),
    () => chatSegment(page),
    () => recapSegment(page),
    () => hubToReflectSegment(page),
    () => reflectMemories(page),
    () => reflectAboutMe(page),
    () => reflectCommitmentsActions(page),
    () => reflectCommitmentsGoals(page),
    () => reflectReviewQueue(page),
    () => closeSegment(page),
  ]

  for (const segment of segments) {
    try {
      await segment()
    } catch (err) {
      console.error(`  ERROR in segment: ${err.message}`)
      // Stop any in-flight audio so it doesn't crash when the next segment navigates
      await stopAudio(page).catch(() => {})
      // Brief pause to let pending promises settle before navigating
      await sleep(200)
    }
  }

  // Get video path before closing page (must be called before page.close())
  const videoPath = await page.video()?.path() ?? null

  // Close and save video
  console.log('\n--- Saving video ---')
  await page.close()
  await context.close()
  await browser.close()

  // Merge video with audio tracks
  await mergeVideoAudio(videoPath)

  // Print timing summary
  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1)
  console.log('\n=== Timing Summary ===')
  for (const s of segmentTimings) {
    console.log(`  ${s.name.padEnd(24)} ${s.elapsed}`)
  }
  console.log(`  ${'TOTAL'.padEnd(24)} ${totalElapsed}s`)
  console.log(`\nVideo saved to ${DEMO_OUTPUT_DIR}/`)
  console.log('Demo complete!')
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

// Prevent stale audio promises from crashing the process after navigation
process.on('unhandledRejection', (err) => {
  const msg = err?.message || String(err)
  if (msg.includes('Execution context was destroyed') || msg.includes('Target closed') || msg.includes('Navigation')) {
    console.warn(`  [ignored] ${msg.slice(0, 120)}`)
    return
  }
  console.error('Unhandled rejection:', err)
})

main()
  .catch((err) => {
    console.error('Demo failed:', err)
    process.exitCode = 1
  })
  .finally(() => {
    stopServer()
    process.exit(process.exitCode ?? 0)
  })
