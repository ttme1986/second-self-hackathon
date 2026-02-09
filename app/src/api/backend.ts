import { GoogleGenAI, Type, ThinkingLevel, MediaResolution } from '@google/genai'
import type { GenerateContentConfig } from '@google/genai'
import { ensureUserStore, loadStore, withStore } from './localStore'
import { syncDoc, deleteDocument, appendConversationClaim as fsAppendConversationClaim } from '../services/firestoreStore'
import { startDeferring as activateDeferring, isDeferring } from '../services/firestoreWriteGate'

type BackendResponse<T> = {
  data?: T
  error?: string
}

type ActionPermission = 'suggest' | 'draft' | 'execute'
type ActionType = 'reminder' | 'email' | 'calendar' | 'goal' | 'reading' | 'general'

type UserProfile = {
  uid: string
  displayName: string
  photoURL: string | null
  email: string | null
  geoCapture: boolean
  onboardingComplete: boolean
  defaultActionPermission?: ActionPermission
  actionPermissions?: Partial<Record<ActionType, ActionPermission>>
  memorySummary?: string
}

type TranscriptTurn = {
  speaker: 'user' | 'assistant'
  text: string
  t_ms: number
}

type GeoLocation = {
  latitude: number
  longitude: number
  timestamp: number
}

type ConversationSummary = {
  id: string
  summary: string
  startedAt: string
  endedAt: string
  durationMs: number
  transcriptPath?: string
  claimIds?: string[]
  confirmedActionIds?: string[]
  status?: 'active' | 'ended'
  location?: GeoLocation
  emotionalStates?: EmotionalState[]
}

type ClaimRecord = {
  id: string
  text: string
  category: string
  confidence: number
  evidence: string[]
  status: 'confirmed' | 'inferred' | 'rejected'
  conversationId: string
  pinned?: boolean
  createdAt?: string
  // Stored internally for agent similarity checks. Stripped from most UI-facing responses.
  embedding?: number[]
}

type ActionExecutionType = 'manual' | 'draft' | 'auto'
type ActionStatus = 'suggested' | 'approved' | 'executing' | 'completed' | 'dismissed' | 'failed' | 'confirmed' | 'done'

type ActionRecord = {
  id: string
  title: string
  context?: string
  evidence?: string[]
  dueWindow: 'Today' | 'This Week' | 'This Month' | 'Everything else'
  source: string
  reminder: boolean
  status: ActionStatus
  conversationId: string
  actionType?: ActionType
  executionType?: ActionExecutionType
  permission?: ActionPermission
  draftContent?: string
  executionResult?: string
  goalId?: string
  createdAt?: string
  updatedAt?: string
}

type ReviewSeverity = 'low' | 'medium' | 'high'

type ReviewRecord = {
  id: string
  claimIds?: [string, string]
  claims?: [string, string]
  actionIds?: string[]
  title?: string
  summary?: string
  conversationId: string
  status: 'pending' | 'resolved'
  severity?: ReviewSeverity
  resolution?: 'confirm-left' | 'confirm-right' | 'reject-both' | 'merge'
}

type GoalCategory = 'health' | 'career' | 'learning' | 'relationships' | 'finance' | 'personal' | 'other'
type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned'
type CheckInStatus = 'on-track' | 'behind' | 'ahead'

type Milestone = {
  id: string
  title: string
  completed: boolean
  completedAt?: string
}

type CheckIn = {
  id: string
  timestamp: string
  status: CheckInStatus
  notes: string
  aiResponse: string
  progressSnapshot?: number
}

type GoalRecord = {
  id: string
  title: string
  description: string
  category: GoalCategory
  status: GoalStatus
  progress: number // 0-100
  targetDate: string | null
  milestones: Milestone[]
  checkIns: CheckIn[]
  linkedActionIds: string[]
  linkedClaimIds: string[]
  createdAt?: string
  updatedAt?: string
}

type ConfirmedActionInput = {
  title: string
  dueWindow: string
  source: string
  reminder: boolean
}

type MomentRecord = {
  id: string
  userId: string
  summary?: string
  transcript?: string
  createdAt?: string
}

type OpenLoopRecord = {
  id: string
  userId: string
  title?: string
  dueWindow?: string
  source?: string
  reminder?: boolean
  createdAt?: string
}

type InsightType = 'memory' | 'pattern' | 'goal_progress' | 'upcoming' | 'wellness' | 'general'
type InsightStatus = 'active' | 'dismissed' | 'acted_on'

type InsightRecord = {
  id: string
  type: InsightType
  title: string
  content: string
  reasoning?: string
  linkedEntityId?: string
  linkedEntityType?: 'goal' | 'action' | 'claim' | 'conversation'
  actionLabel?: string
  status: InsightStatus
  priority: number // 1-10, higher is more important
  expiresAt?: string
  createdAt?: string
  updatedAt?: string
}

type EmotionCategory = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral' | 'stress' | 'calm'

type EmotionalState = {
  primary: EmotionCategory
  secondary?: EmotionCategory
  valence: number // -1 (negative) to 1 (positive)
  intensity: number // 0 (low) to 1 (high)
  confidence: number // 0 to 1
  timestamp?: string
}

type EmotionalSummary = {
  dominant: EmotionCategory
  valenceAvg: number
  arc: 'improving' | 'stable' | 'declining'
  turnCount: number
}

const TOKEN_KEY = 'sessionToken'
const USER_KEY = 'sessionUser'

const hasBackend = true

const nowIso = () => new Date().toISOString()

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

const getSessionToken = () => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

const getSessionUser = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { uid?: string }
  } catch {
    return null
  }
}

const resolveUserId = (fallback?: string | null) => {
  if (fallback) return fallback
  const sessionUser = getSessionUser()
  if (sessionUser?.uid) return sessionUser.uid
  const envUid = import.meta.env.VITE_DEV_USER_ID?.toString()
  return envUid || 'dev-user'
}

const normalizeProfile = (data: Partial<UserProfile> | null, userId: string): UserProfile => ({
  uid: data?.uid ?? userId,
  displayName: data?.displayName ?? 'New User',
  photoURL: data?.photoURL ?? null,
  email: data?.email ?? null,
  geoCapture: data?.geoCapture ?? true,
  onboardingComplete: data?.onboardingComplete ?? false,
  defaultActionPermission: data?.defaultActionPermission ?? 'suggest',
  actionPermissions: data?.actionPermissions ?? {},
  memorySummary: data?.memorySummary,
})

const arrayUnion = <T>(current: T[] | undefined, next: T[]) =>
  [...new Set([...(current ?? []), ...next])]

const getAiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.toString() ?? ''
  if (!apiKey) return null
  return new GoogleGenAI({ apiKey })
}

const isAiDisabled = () =>
  (import.meta.env.VITE_DISABLE_AI?.toString() ?? 'false').toLowerCase() === 'true'

/** Log context caching metrics from Gemini response usageMetadata */
const logCacheMetrics = (caller: string, usageMetadata: { promptTokenCount?: number; cachedContentTokenCount?: number } | undefined) => {
  if (!usageMetadata) return
  const { promptTokenCount = 0, cachedContentTokenCount = 0 } = usageMetadata
  if (cachedContentTokenCount > 0) {
    const pct = ((cachedContentTokenCount / promptTokenCount) * 100).toFixed(1)
    console.debug(`[cache] ${caller}: ${cachedContentTokenCount}/${promptTokenCount} tokens cached (${pct}%)`)
  }
}

const generateText = async (prompt: string, model: string, extraConfig?: Partial<GenerateContentConfig>) => {
  if (isAiDisabled()) throw new Error('AI disabled')
  const client = getAiClient()
  if (!client) throw new Error('Gemini API key missing')
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: { temperature: 1.0, ...extraConfig },
  })
  logCacheMetrics('generateText', response.usageMetadata)
  return response.text ?? ''
}

/** Generate structured JSON output with a responseSchema — Gemini 3 native structured output */
const generateJson = async <T>(prompt: string, model: string, responseSchema: unknown, extraConfig?: Partial<GenerateContentConfig>): Promise<T> => {
  if (isAiDisabled()) throw new Error('AI disabled')
  const client = getAiClient()
  if (!client) throw new Error('Gemini API key missing')
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 1.0,
      responseMimeType: 'application/json',
      responseSchema,
      ...extraConfig,
    },
  })
  logCacheMetrics('generateJson', response.usageMetadata)
  return JSON.parse(response.text ?? '{}') as T
}

const embedText = async (text: string, model: string) => {
  if (isAiDisabled()) return [] as number[]
  const client = getAiClient()
  if (!client) return [] as number[]
  const response = await client.models.embedContent({ model, contents: text })
  return response.embeddings?.[0]?.values ?? []
}

const cosineSimilarity = (vecA: number[], vecB: number[]) => {
  if (!vecA.length || !vecB.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < Math.min(vecA.length, vecB.length); i += 1) {
    dot += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

const summarizeTranscript = async (transcript: TranscriptTurn[]) => {
  if (!transcript.length) return ''
  const turns = transcript.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n')
  const prompt = [
    'Summarize this conversation in 2-5 sentences. Keep it concise and factual.',
    '',
    turns,
  ].join('\n')
  try {
    return await generateText(prompt, 'gemini-3-flash-preview')
  } catch {
    return ''
  }
}

/** Schema for structured claim/action extraction — Gemini 3 native JSON output */
const claimsActionsSchema = {
  type: Type.OBJECT,
  properties: {
    claims: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          category: { type: Type.STRING, enum: ['preferences', 'skills', 'relationships', 'other'] },
          confidence: { type: Type.NUMBER },
          evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['text', 'category', 'confidence', 'evidence'],
      },
    },
    actions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          dueWindow: { type: Type.STRING, enum: ['Today', 'This Week', 'This Month', 'Everything else'] },
          source: { type: Type.STRING },
          reminder: { type: Type.BOOLEAN },
        },
        required: ['title', 'dueWindow'],
      },
    },
  },
  required: ['claims', 'actions'],
}

const extractClaimsAndActions = async (
  turn: TranscriptTurn,
  previousThoughtSignatures?: string,
  alreadyExtracted?: { claims: string[]; actions: string[] },
) => {
  const promptParts = [
    'You extract user knowledge (claims) and follow-up actions from a single conversation turn.',
    'Only include claims/actions when the user has clearly confirmed them in the conversation context.',
    'IMPORTANT: Write claims in first-person "About Me" style WITHOUT "The user" prefix.',
    'For example: "Practises yoga daily" NOT "The user practises yoga daily".',
    '"Prefers dark roast coffee" NOT "The user prefers dark roast coffee".',
    `Turn speaker: ${turn.speaker}`,
    `Turn text: ${turn.text}`,
  ]

  if (alreadyExtracted?.claims.length) {
    promptParts.push(`\nAlready extracted claims (DO NOT re-extract these or similar):\n${alreadyExtracted.claims.map(c => `- ${c}`).join('\n')}`)
  }
  if (alreadyExtracted?.actions.length) {
    promptParts.push(`\nAlready extracted actions (DO NOT re-extract these or similar):\n${alreadyExtracted.actions.map(a => `- ${a}`).join('\n')}`)
  }

  const prompt = promptParts.join('\n')

  try {
    if (isAiDisabled()) throw new Error('AI disabled')
    const client = getAiClient()
    if (!client) throw new Error('Gemini API key missing')

    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = []
    // If we have previous thought signatures, include them for continuity
    if (previousThoughtSignatures) {
      contents.push({ role: 'model', parts: [{ thoughtSignature: previousThoughtSignatures }] })
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] })

    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        temperature: 1.0,
        responseMimeType: 'application/json',
        responseSchema: claimsActionsSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW, includeThoughts: true },
      },
    })

    // Extract thought signatures for next turn continuity (not yet in SDK types)
    const responseRecord = response as unknown as Record<string, unknown>
    const candidates = responseRecord.candidates as Array<Record<string, unknown>> | undefined
    const newThoughtSignatures = (candidates?.[0]?.thoughtSignature as string) ?? undefined

    const parsed = JSON.parse(response.text ?? '{}')
    return {
      claims: Array.isArray(parsed.claims) ? parsed.claims : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      thoughtSignatures: newThoughtSignatures,
    }
  } catch {
    return { claims: [], actions: [], thoughtSignatures: undefined }
  }
}

const detectConflict = async (newText: string, existingText: string) => {
  const prompt = [
    'Determine if the following two statements about a user conflict or are inconsistent.',
    "Return only 'yes' or 'no'.",
    '',
    `Statement A: ${existingText}`,
    `Statement B: ${newText}`,
  ].join('\n')
  try {
    const text = await generateText(prompt, 'gemini-3-flash-preview', {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    })
    return text.trim().toLowerCase().startsWith('y')
  } catch {
    return false
  }
}

/** Schema for structured emotion detection — Gemini 3 native JSON output */
const emotionSchema = {
  type: Type.OBJECT,
  properties: {
    primary: { type: Type.STRING, enum: ['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral', 'stress', 'calm'] },
    secondary: { type: Type.STRING, enum: ['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral', 'stress', 'calm'] },
    valence: { type: Type.NUMBER, description: 'From -1 (very negative) to 1 (very positive)' },
    intensity: { type: Type.NUMBER, description: 'From 0 (low) to 1 (high)' },
    confidence: { type: Type.NUMBER, description: 'From 0 to 1' },
  },
  required: ['primary', 'valence', 'intensity', 'confidence'],
}

const detectEmotion = async (text: string): Promise<EmotionalState> => {
  const prompt = [
    'Analyze the emotional state expressed in this text.',
    '',
    `Text: ${text}`,
  ].join('\n')

  try {
    const parsed = await generateJson<{
      primary: string
      secondary?: string | null
      valence: number
      intensity: number
      confidence: number
    }>(prompt, 'gemini-3-flash-preview', emotionSchema)

    const validEmotions = ['joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral', 'stress', 'calm']
    const primary = validEmotions.includes(parsed.primary ?? '')
      ? (parsed.primary as EmotionCategory)
      : 'neutral'
    const secondary = parsed.secondary && validEmotions.includes(parsed.secondary)
      ? (parsed.secondary as EmotionCategory)
      : undefined

    return {
      primary,
      secondary,
      valence: Math.max(-1, Math.min(1, parsed.valence ?? 0)),
      intensity: Math.max(0, Math.min(1, parsed.intensity ?? 0.5)),
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      timestamp: nowIso(),
    }
  } catch {
    return {
      primary: 'neutral',
      valence: 0,
      intensity: 0.3,
      confidence: 0.3,
      timestamp: nowIso(),
    }
  }
}

/**
 * Analyze an image using Gemini 3 Flash Agentic Vision — Think/Act/Observe loop.
 * Combines multimodal image input, thinking mode, and code execution so the model
 * can reason about the image, write code to extract structured data (OCR, charts,
 * receipts), observe the results, and iterate before producing a final description.
 */
const analyzeImage = async (
  base64Data: string,
  mimeType: string = 'image/jpeg',
  context: string = '',
): Promise<BackendResponse<{ description: string; codeExecuted?: boolean }>> => {
  if (isAiDisabled()) return { data: { description: '', codeExecuted: false } }
  const client = getAiClient()
  if (!client) return { error: 'Gemini API key missing' }

  const agenticPrompt = context
    ? `Analyze this image in the context of a personal life assistant. ${context}\n\nIf the image contains text, tables, charts, receipts, schedules, or other structured data, use code execution to extract and organize the information. Provide a concise, actionable summary.`
    : 'Analyze this image for a personal life assistant. Describe what you see and extract any actionable information. If the image contains text, numbers, tables, charts, receipts, business cards, schedules, or other structured content, use code execution to extract and organize the data precisely. Provide a concise, actionable summary.'

  const models = ['gemini-3-pro-preview', 'gemini-3-flash-preview'] as const
  const maxRetries = 4

  for (const model of models) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: [
            { inlineData: { mimeType, data: base64Data } },
            { text: agenticPrompt },
          ],
          config: {
            temperature: 1.0,
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
            tools: [{ codeExecution: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })

        logCacheMetrics('analyzeImage', response.usageMetadata)

        const parts = response.candidates?.[0]?.content?.parts ?? []
        const codeExecuted = parts.some(
          (p) => 'executableCode' in p || 'codeExecutionResult' in p,
        )

        return { data: { description: response.text ?? '', codeExecuted } }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const isRetryable = /503|429|UNAVAILABLE|overloaded|capacity|Failed to fetch|network|ECONNRESET|timeout/i.test(message)
        if (isRetryable && attempt < maxRetries - 1) {
          const jitter = Math.random() * 500
          const delay = 1000 * 2 ** attempt + jitter // ~1s, ~2s, ~4s, ~8s
          console.warn(`[Attachment] Retry ${attempt + 1}/${maxRetries} (${model}) after ${Math.round(delay)}ms`)
          await new Promise(r => setTimeout(r, delay))
          continue
        }
        // Non-retryable error or last retry: try next model
        if (attempt === maxRetries - 1) {
          console.warn(`[Attachment] ${model} exhausted retries, trying fallback...`)
          break // try next model
        }
        return { error: message }
      }
    }
  }
  return { error: 'Image analysis failed after retries on all models' }
}

const calculateEmotionalSummary = (states: EmotionalState[]): EmotionalSummary => {
  if (states.length === 0) {
    return { dominant: 'neutral', valenceAvg: 0, arc: 'stable', turnCount: 0 }
  }

  // Count emotion occurrences
  const counts: Record<string, number> = {}
  let valenceSum = 0

  for (const state of states) {
    counts[state.primary] = (counts[state.primary] ?? 0) + 1
    valenceSum += state.valence
  }

  // Find dominant emotion
  let dominant: EmotionCategory = 'neutral'
  let maxCount = 0
  for (const [emotion, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      dominant = emotion as EmotionCategory
    }
  }

  // Calculate average valence
  const valenceAvg = valenceSum / states.length

  // Determine arc (compare first half to second half)
  let arc: 'improving' | 'stable' | 'declining' = 'stable'
  if (states.length >= 4) {
    const midpoint = Math.floor(states.length / 2)
    const firstHalfAvg = states.slice(0, midpoint).reduce((sum, s) => sum + s.valence, 0) / midpoint
    const secondHalfAvg = states.slice(midpoint).reduce((sum, s) => sum + s.valence, 0) / (states.length - midpoint)
    const diff = secondHalfAvg - firstHalfAvg

    if (diff > 0.2) arc = 'improving'
    else if (diff < -0.2) arc = 'declining'
  }

  return {
    dominant,
    valenceAvg: Math.round(valenceAvg * 100) / 100,
    arc,
    turnCount: states.length,
  }
}

const getUserStore = (uid: string) => {
  const store = loadStore()
  const user = ensureUserStore(store, uid)
  return { store, user }
}

const setUserProfile = (uid: string, updates: Partial<UserProfile>, createIfMissing = true) => {
  withStore((store) => {
    const user = ensureUserStore(store, uid)
    const current = user.profile ?? (createIfMissing ? normalizeProfile(null, uid) : null)
    if (!current) return
    user.profile = {
      ...current,
      ...updates,
      uid,
    }
  })
}

const listRecords = <T extends Record<string, unknown>>(
  records: Record<string, T>,
): Array<T & { id: string }> =>
  Object.entries(records).map(([id, item]) => ({
    ...item,
    id,
  }))

const stripEmbedding = <T extends { embedding?: number[] }>(record: T) => {
  const { embedding: _, ...rest } = record
  return rest
}


export async function callGemini(prompt: string, model = 'gemini-3-flash-preview') {
  if (!prompt) return { error: 'prompt required' }
  try {
    const text = await generateText(prompt, model)
    return { data: { text } }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Request failed' }
  }
}

export async function transcribe(audioText: string, model = 'gemini-3-flash-preview') {
  if (!audioText) return { error: 'audioText required' }
  const prompt = [
    'Transcribe the following speech into a clean transcript. Return only the transcript text.',
    '',
    audioText,
  ].join('\n')
  try {
    const text = await generateText(prompt, model)
    return { data: { text } }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Request failed' }
  }
}

export async function transcribeStream(audioText: string, model = 'gemini-3-flash-preview') {
  return transcribe(audioText, model)
}

export async function embedQuery(text: string) {
  if (!text) return { error: 'text required' }
  try {
    const embedding = await embedText(text, 'gemini-embedding-001')
    return { data: { embedding } }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Request failed' }
  }
}

export async function createSession(user: {
  uid: string
  displayName?: string
  email?: string | null
  photoURL?: string | null
}) {
  if (!user.uid) return { error: 'uid required' }
  const updates: Partial<UserProfile> = {
    uid: user.uid,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
  }
  // Only set displayName if provided - don't overwrite existing profile data
  if (user.displayName) {
    updates.displayName = user.displayName
  }
  setUserProfile(user.uid, updates, true)
  return { data: { token: `local-${user.uid}-${Date.now()}` } }
}

export async function getProfile() {
  const userId = resolveUserId()
  let profile: UserProfile = normalizeProfile(null, userId)
  withStore((store) => {
    const user = ensureUserStore(store, userId)
    if (!user.profile) {
      user.profile = normalizeProfile(null, userId)
    }
    profile = normalizeProfile(user.profile, userId)
  })
  return { data: { profile } }
}

export async function updateProfile(updates: Partial<UserProfile>) {
  const userId = resolveUserId()
  const allowed = new Set([
    'displayName',
    'photoURL',
    'email',
    'geoCapture',
    'onboardingComplete',
    'defaultActionPermission',
    'actionPermissions',
    'memorySummary',
  ])
  const sanitized: Record<string, unknown> = {}
  Object.entries(updates).forEach(([key, value]) => {
    if (allowed.has(key)) {
      sanitized[key] = value
    }
  })
  setUserProfile(userId, sanitized as Partial<UserProfile>)
  syncDoc(`users/${userId}`, sanitized)
  return getProfile()
}

export async function deleteProfileData() {
  const userId = resolveUserId()
  withStore((store) => {
    delete store.users[userId]
    Object.entries(store.moments).forEach(([id, moment]) => {
      if (moment.userId === userId) delete store.moments[id]
    })
    Object.entries(store.openLoops).forEach(([id, loop]) => {
      if (loop.userId === userId) delete store.openLoops[id]
    })
  })
  return { data: { deleted: true } }
}

export async function startConversation(conversationId: string, location?: GeoLocation) {
  if (!conversationId) return { error: 'conversationId required' }
  activateDeferring()
  const userId = resolveUserId()
  const startedAt = nowIso()
  withStore((store) => {
    const user = ensureUserStore(store, userId)
    user.conversations[conversationId] = {
      ...(user.conversations[conversationId] ?? {}),
      summary: user.conversations[conversationId]?.summary ?? '',
      startedAt,
      status: 'active',
      createdAt: nowIso(),
      ...(location ? { location } : {}),
    }
  })
  syncDoc(`users/${userId}/conversations/${conversationId}`, {
    id: conversationId,
    startedAt,
    status: 'active',
    ...(location ? { location } : {}),
  })
  return { data: { startedAt } }
}

const consolidateMemorySummary = async (
  existingMemorySummary: string,
  newConversationSummary: string,
): Promise<string> => {
  if (!newConversationSummary) return existingMemorySummary
  if (isAiDisabled()) return existingMemorySummary

  const prompt = existingMemorySummary
    ? [
        'You maintain a rolling memory summary for a personal AI assistant.',
        'Update the existing summary to incorporate the key information from the latest conversation.',
        'Keep the updated summary under 500 words. Prioritize recent and actionable information.',
        'Return ONLY the updated summary text, nothing else.',
        '',
        'Existing memory summary:',
        existingMemorySummary,
        '',
        'Latest conversation summary:',
        newConversationSummary,
      ].join('\n')
    : [
        'You maintain a rolling memory summary for a personal AI assistant.',
        'Create an initial memory summary from this conversation.',
        'Keep it under 500 words. Focus on key facts, preferences, and actionable items.',
        'Return ONLY the summary text, nothing else.',
        '',
        'Conversation summary:',
        newConversationSummary,
      ].join('\n')

  try {
    const result = await generateText(prompt, 'gemini-3-flash-preview', {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    })
    const words = result.trim().split(/\s+/)
    if (words.length > 500) {
      return words.slice(0, 500).join(' ')
    }
    return result.trim()
  } catch {
    return existingMemorySummary
  }
}

export async function endConversation(conversationId: string, transcript: TranscriptTurn[], emotionalStates?: EmotionalState[]) {
  if (!conversationId) return { error: 'conversationId required' }
  if (!Array.isArray(transcript)) return { error: 'transcript must be a list' }

  const userId = resolveUserId()
  const endedAt = nowIso()
  const summary = await summarizeTranscript(transcript)
  const embedding = summary ? await embedText(summary, 'gemini-embedding-001') : []

  let durationMs = 0
  const { user } = getUserStore(userId)
  const existing = user.conversations[conversationId] ?? {}
  if (existing.startedAt) {
    const startedAt = Date.parse(existing.startedAt)
    const endedAtMs = Date.parse(endedAt)
    if (!Number.isNaN(startedAt) && !Number.isNaN(endedAtMs)) {
      durationMs = Math.max(0, endedAtMs - startedAt)
    }
  }

  // If previous background processing marked the conversation as final and we have no new transcript,
  // do not overwrite the summary with empty or default.
  // Use existing transcript if the provided transcript is empty (which happens in some test cases/mocks).
  const finalTranscript = transcript.length > 0 ? transcript : existing.transcript ?? []
  if (transcript.length === 0 && finalTranscript.length > 0) {
    // Possibly update summary only if it was missing? 
    // For now, if we are ending with empty transcript argument but have stored transcript, use stored.
  }

  // If summary generation fails (returns empty), keep the old one if it existed
  const finalSummary = summary || existing.summary || ''
  const finalEmbedding = embedding.length > 0 ? embedding : existing.embedding || []

  // Consolidate memorySummary
  const existingProfile = (user.profile ?? {}) as Partial<UserProfile>
  const existingMemorySummary = existingProfile.memorySummary ?? ''
  const updatedMemorySummary = await consolidateMemorySummary(existingMemorySummary, finalSummary)

  const transcriptPath = `users/${userId}/conversations/${conversationId}/transcript.json`

  // Merge provided emotional states with any already stored on the conversation
  const existingEmotionalStates: EmotionalState[] = existing.emotionalStates ?? []
  const finalEmotionalStates = emotionalStates && emotionalStates.length > 0
    ? emotionalStates
    : existingEmotionalStates

  withStore((nextStore) => {
    const nextUser = ensureUserStore(nextStore, userId)
    nextUser.conversations[conversationId] = {
      ...(nextUser.conversations[conversationId] ?? {}),
      summary: finalSummary,
      embedding: finalEmbedding,
      endedAt,
      durationMs,
      transcriptPath,
      transcript: finalTranscript,
      updatedAt: nowIso(),
      status: 'ended',
      ...(finalEmotionalStates.length > 0 ? { emotionalStates: finalEmotionalStates } : {}),
    }
    if (updatedMemorySummary && nextUser.profile) {
      nextUser.profile = { ...nextUser.profile, memorySummary: updatedMemorySummary }
    }
  })
  syncDoc(`users/${userId}/conversations/${conversationId}`, {
    id: conversationId,
    summary: finalSummary,
    endedAt,
    durationMs,
    transcriptPath,
    status: 'ended',
    ...(finalEmotionalStates.length > 0 ? { emotionalStates: finalEmotionalStates } : {}),
  })
  if (updatedMemorySummary) {
    syncDoc(`users/${userId}`, { memorySummary: updatedMemorySummary })
  }

  return { data: { summary: finalSummary, endedAt, durationMs } }
}

export async function listConversations() {
  const userId = resolveUserId()
  const { user } = getUserStore(userId)
  const items = listRecords(user.conversations as Record<string, ConversationSummary & { embedding?: number[] }>)
    .map((item) => stripEmbedding(item))
    .map((item) => ({
      ...item,
      id: item.id,
      summary: item.summary ?? '',
      startedAt: item.startedAt ?? '',
      endedAt: item.endedAt ?? '',
      durationMs: item.durationMs ?? 0,
      claimIds: item.claimIds ?? [],
      confirmedActionIds: item.confirmedActionIds ?? [],
      emotionalStates: item.emotionalStates ?? [],
    }))
  return { data: { items } }
}

export async function searchConversations(query: string) {
  const userId = resolveUserId()
  const trimmed = query.trim()
  if (!trimmed) return { data: { items: [] } }
  const queryEmbedding = await embedText(trimmed, 'gemini-embedding-001')
  if (!queryEmbedding.length) return { data: { items: [] } }

  const { user } = getUserStore(userId)
  type ConversationWithEmbedding = ConversationSummary & { embedding?: number[] }
  const scored = listRecords(user.conversations as Record<string, ConversationWithEmbedding>)
    .map((record) => {
      const embedding = record.embedding ?? []
      const score = cosineSimilarity(queryEmbedding, embedding)
      return { score, record }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((entry) => stripEmbedding(entry.record))

  return { data: { items: scored } }
}

export async function getConversationTranscript(conversationId: string) {
  const userId = resolveUserId()
  const { user } = getUserStore(userId)
  const record = user.conversations[conversationId]
  return { data: { turns: record?.transcript ?? [] } }
}

export async function appendConversationTurn(conversationId: string, turn: TranscriptTurn) {
  if (!conversationId || !turn) return { error: 'conversationId and turn required' }
  const userId = resolveUserId()
  withStore((store) => {
    const user = ensureUserStore(store, userId)
    const conversation = user.conversations[conversationId]
    if (conversation) {
      const transcript = conversation.transcript ?? []
      transcript.push(turn)
      user.conversations[conversationId] = {
        ...conversation,
        transcript,
        updatedAt: nowIso(),
      }
    }
  })
  return { data: { updated: true } }
}

export async function getActiveConversation() {
  const userId = resolveUserId()
  const { user } = getUserStore(userId)
  const conversations = user.conversations as Record<string, ConversationSummary & { embedding?: number[] }>
  const activeEntry = Object.entries(conversations).find(
    ([_, c]) => c.status === 'active'
  )
  if (!activeEntry) return { data: { conversation: null } }
  const [id, record] = activeEntry
  return { data: { conversation: { ...stripEmbedding(record), id } } }
}

export async function confirmActions(conversationId: string, actions: ConfirmedActionInput[]) {
  if (!conversationId) return { error: 'conversationId required' }
  if (!Array.isArray(actions)) return { error: 'actions must be a list' }
  const userId = resolveUserId()
  const createdIds: string[] = []

  const actionRecords: Array<Record<string, unknown>> = []
  withStore((store) => {
    const user = ensureUserStore(store, userId)
    actions.forEach((action) => {
      const id = createId('action')
      const record = {
        id,
        title: action.title,
        dueWindow: action.dueWindow as ActionRecord['dueWindow'],
        source: action.source,
        reminder: Boolean(action.reminder),
        status: 'confirmed' as const,
        conversationId,
        createdAt: nowIso(),
      }
      user.actions[id] = record
      createdIds.push(id)
      actionRecords.push(record)
    })

    const conversation = user.conversations[conversationId] ?? {}
    conversation.confirmedActionIds = arrayUnion(conversation.confirmedActionIds, createdIds)
    user.conversations[conversationId] = conversation
  })
  for (const record of actionRecords) {
    syncDoc(`users/${userId}/actions/${record.id}`, record)
  }

  return { data: { ids: createdIds } }
}

export async function listActions(status?: ActionStatus | ActionStatus[]) {
  const userId = resolveUserId()
  const { user } = getUserStore(userId)
  let items = listRecords(user.actions as Record<string, ActionRecord>)
  if (status) {
    const statuses = Array.isArray(status) ? status : [status]
    items = items.filter((item) => statuses.includes(item.status))
  }
  return { data: { items } }
}

export async function getAction(actionId: string): Promise<BackendResponse<{ action: ActionRecord | null }>> {
  if (!actionId) return { error: 'actionId required' }
  const userId = resolveUserId()
  const { user } = getUserStore(userId)
  const action = (user.actions?.[actionId] as ActionRecord | undefined) ?? null
  return { data: { action } }
}

export async function updateAction(
  actionId: string,
  updates: Partial<Omit<ActionRecord, 'id' | 'conversationId'>>
): Promise<BackendResponse<{ updated: boolean; action?: ActionRecord }>> {
  if (!actionId) return { error: 'actionId required' }
  const userId = resolveUserId()
  let updatedAction: ActionRecord | undefined

  withStore((store) => {
    const user = ensureUserStore(store, userId)
    const current = user.actions[actionId] as ActionRecord | undefined
    if (!current) return

    updatedAction = {
      ...current,
      ...updates,
      id: actionId,
      updatedAt: nowIso(),
    }
    user.actions[actionId] = updatedAction as ActionRecord
  })

  if (!updatedAction) return { error: 'Action not found' }
  syncDoc(`users/${userId}/actions/${actionId}`, { ...updates, id: actionId })
  return { data: { updated: true, action: updatedAction } }
}

export async function createAction(
  payload: Omit<ActionRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<BackendResponse<{ id: string; action: ActionRecord }>> {
  const userId = resolveUserId()
  const id = createId('action')
  const now = nowIso()

  const action: ActionRecord = {
    ...payload,
    id,
    createdAt: now,
    updatedAt: now,
  }

  withStore((store) => {
    const user = ensureUserStore(store, userId)
    user.actions[id] = action

    // Link to conversation if conversationId provided
    if (payload.conversationId) {
      const conversation = user.conversations[payload.conversationId] ?? {}
      conversation.confirmedActionIds = arrayUnion(conversation.confirmedActionIds, [id])
      user.conversations[payload.conversationId] = { ...conversation, updatedAt: now } as Record<string, unknown>
    }
  })
  syncDoc(`users/${userId}/actions/${id}`, action as unknown as Record<string, unknown>)

  return { data: { id, action } }
}

export async function listClaims(status?: 'confirmed' | 'inferred' | 'rejected') {
  const userId = resolveUserId()
  const { user } = getUserStore(userId)
  let items = listRecords(user.claims as Record<string, ClaimRecord>).map((item) => stripEmbedding(item))
  if (status) {
    items = items.filter((item) => item.status === status)
  }
  return { data: { items } }
}

// Agent-only: returns recent claims including embeddings (if present).
export async function listRecentClaimsWithEmbedding(max = 25) {
  const userId = resolveUserId()
  const { user } = getUserStore(userId)
  const items = listRecords(user.claims as Record<string, ClaimRecord>)
    .slice(0, Math.max(0, max))
  return { data: { items } }
}

// Agent-only: create or update a claim record.
export async function upsertClaimForAgent(payload: Omit<ClaimRecord, 'id'> & { id?: string }) {
  const userId = resolveUserId()
  const id = payload.id || createId('claim')
  withStore((store) => {
    const user = ensureUserStore(store, userId)
    const existing = user.claims[id]
    user.claims[id] = {
      ...(existing ?? {}),
      ...(payload as Omit<ClaimRecord, 'id'>),
      id,
      updatedAt: nowIso(),
      createdAt: existing?.createdAt ?? nowIso(),
    }
  })
  const { embedding: _, ...claimWithoutEmbedding } = payload
  syncDoc(`users/${userId}/claims/${id}`, { ...claimWithoutEmbedding, id })
  return { data: { id } }
}

// Agent-only: link a claim to a conversation.
export async function appendConversationClaim(conversationId: string, claimId: string) {
  if (!conversationId || !claimId) return { error: 'conversationId and claimId required' }
  const userId = resolveUserId()
  withStore((store) => {
    const user = ensureUserStore(store, userId)
    const conversation = user.conversations[conversationId] ?? { id: conversationId }
    conversation.claimIds = arrayUnion(conversation.claimIds, [claimId])
    user.conversations[conversationId] = { ...conversation, updatedAt: nowIso() } as Record<string, unknown>
  })
  if (!isDeferring()) {
    void fsAppendConversationClaim(userId, conversationId, claimId)
  }
  return { data: { updated: true } }
}

export async function appendConversationAction(conversationId: string, actionId: string) {
  if (!conversationId || !actionId) return { error: 'conversationId and actionId required' }
  const userId = resolveUserId()
  withStore((store) => {
    const user = ensureUserStore(store, userId)
    const conversation = user.conversations[conversationId] ?? { id: conversationId }
    conversation.actionIds = arrayUnion(conversation.actionIds, [actionId])
    user.conversations[conversationId] = { ...conversation, updatedAt: nowIso() } as Record<string, unknown>
  })
  if (!isDeferring()) {
    const { appendConversationAction: fsAppend } = await import('../services/firestoreStore')
    void fsAppend(userId, conversationId, actionId)
  }
  return { data: { updated: true } }
}

export async function commitSessionToFirestore(conversationId: string) {
  const { writeBatch, doc: firestoreDoc, serverTimestamp } = await import('firebase/firestore')
  const { stopDeferring } = await import('../services/firestoreWriteGate')
  const { app } = await import('../lib/firebase')
  const { getFirestore } = await import('firebase/firestore')

  const userId = resolveUserId()
  const { user } = getUserStore(userId)

  const firestore = getFirestore(app as import('firebase/app').FirebaseApp)
  const batch = writeBatch(firestore)

  // 1. Conversation document
  const conv = user.conversations[conversationId]
  if (conv) {
    const { transcript, embedding, ...convData } = conv as Record<string, unknown>
    batch.set(firestoreDoc(firestore, `users/${userId}/conversations/${conversationId}`), {
      ...convData,
      id: conversationId,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  // 2. Claims created/updated in this session
  const claimIds: string[] = (conv?.claimIds as string[]) ?? []
  for (const claimId of claimIds) {
    const claim = user.claims[claimId]
    if (claim) {
      const { embedding: _, ...claimData } = claim as Record<string, unknown> & { embedding?: unknown }
      batch.set(firestoreDoc(firestore, `users/${userId}/claims/${claimId}`), {
        ...claimData,
        id: claimId,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    }
  }

  // 3. Actions created/updated in this session
  const actionIds: string[] = [
    ...((conv?.actionIds as string[]) ?? []),
    ...((conv?.confirmedActionIds as string[]) ?? []),
  ]
  const uniqueActionIds = [...new Set(actionIds)]
  for (const actionId of uniqueActionIds) {
    const action = user.actions[actionId]
    if (action) {
      batch.set(firestoreDoc(firestore, `users/${userId}/actions/${actionId}`), {
        ...action,
        id: actionId,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    }
  }

  // 4. memorySummary on user profile
  if (user.profile?.memorySummary) {
    batch.set(firestoreDoc(firestore, `users/${userId}`), {
      memorySummary: user.profile.memorySummary,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  // 5. Review queue items for this conversation
  const reviewItems = Object.values(user.reviewQueue ?? {})
    .filter((r: Record<string, unknown>) => r.conversationId === conversationId)
  for (const item of reviewItems) {
    const reviewItem = item as Record<string, unknown> & { id: string }
    batch.set(firestoreDoc(firestore, `users/${userId}/reviewQueue/${reviewItem.id}`), {
      ...reviewItem,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  await batch.commit()
  stopDeferring()
}

export async function updateClaim(claimId: string, updates: Record<string, unknown>) {
  if (!claimId || typeof updates !== 'object') {
    return { error: 'claimId and updates required' }
  }
  const userId = resolveUserId()
  withStore((store) => {
    const user = ensureUserStore(store, userId)
    const current = user.claims[claimId]
    if (!current) return
    user.claims[claimId] = {
      ...current,
      ...updates,
      updatedAt: nowIso(),
    }
  })
  const { embedding: _, ...updatesWithoutEmbedding } = updates as Record<string, unknown> & { embedding?: unknown }
  syncDoc(`users/${userId}/claims/${claimId}`, { ...updatesWithoutEmbedding, id: claimId })
  return { data: { updated: true } }
}

export async function listReviewQueue(status = 'pending') {
  const userId = resolveUserId()
  const { user } = getUserStore(userId)
  let items = listRecords(user.reviewQueue as Record<string, ReviewRecord>)
  if (status) {
    items = items.filter((item) => item.status === status)
  }
  return { data: { items } }
}

export async function resolveReviewQueue(reviewId: string, resolution: string) {
  if (!reviewId || !resolution) {
    return { error: 'reviewId and resolution required' }
  }
  const userId = resolveUserId()
  withStore((store) => {
    const user = ensureUserStore(store, userId)
    const current = user.reviewQueue[reviewId]
    if (!current) return
    user.reviewQueue[reviewId] = {
      ...current,
      status: 'resolved',
      resolution,
    }
  })
  syncDoc(`users/${userId}/reviewQueue/${reviewId}`, { id: reviewId, status: 'resolved', resolution })
  return { data: { updated: true } }
}

export async function createClaim(
  payload: Omit<ClaimRecord, 'id'> & { userId?: string },
) {
  const userId = resolveUserId(payload.userId)
  const id = createId('claim')
  withStore((store) => {
    const user = ensureUserStore(store, userId)
    user.claims[id] = {
      ...payload,
      id,
      createdAt: nowIso(),
    }
  })
  const { embedding: _, userId: __, ...claimWithoutEmbedding } = payload as Record<string, unknown>
  syncDoc(`users/${userId}/claims/${id}`, { ...claimWithoutEmbedding, id })
  return { data: { id } }
}

export async function createReviewQueue(
  payload: Omit<ReviewRecord, 'id'> & { userId?: string },
) {
  const userId = resolveUserId(payload.userId)
  const id = createId('review')
  withStore((store) => {
    const user = ensureUserStore(store, userId)
    user.reviewQueue[id] = {
      ...payload,
      id,
      createdAt: nowIso(),
    }
  })
  const { userId: __, ...recordWithoutUserId } = payload as Record<string, unknown>
  syncDoc(`users/${userId}/reviewQueue/${id}`, { ...recordWithoutUserId, id })
  return { data: { id } }
}

export async function listMoments(userId?: string) {
  const resolvedId = resolveUserId(userId)
  // Note: getUserStore returns user store, but moments are in root store.moments
  // filtered by userId field.

  // Since moments are historically in root store.moments, we should migrate or filter.
  // The current `listMoments` implementation uses:
  // const items = Object.entries(store.moments).filter(...)
  // We want to scope them under user store if possible, or filter by userId strictly from the root collection.
  
  // Actually, `getUserStore` returns `store.users[uid]`, which doesn't contain `moments` yet in our schema.
  // The `ensureUserStore` schema:
  // store.users[uid] = { profile, claims, reviewQueue, actions, conversations }
  // Moments are separate in `store.moments` with a `userId` field.
  // This IS already partitioned by `userId` filter in the list function.
  // "Feature 13: Per-user data partitioning" implies enforcing this structure more strictly or migrating data?
  // Let's check `createMoment`.
  
  const store = loadStore()
  const items = Object.entries(store.moments)
    .map(([id, item]) => ({ ...(item as MomentRecord), id }))
    .filter((item) => item.userId === resolvedId)
  return { data: { items } }
}

export async function createMoment(payload: Omit<MomentRecord, 'id'>) {
  const userId = resolveUserId(payload.userId)
  const id = createId('moment')
  const payloadWithUser = { ...payload, userId }
  withStore((store) => {
    store.moments[id] = { ...payloadWithUser, id, createdAt: nowIso() }
  })
  return { data: { id } }
}

export async function listOpenLoops(userId?: string) {
  const resolvedId = resolveUserId(userId)
  const store = loadStore()
  const items = Object.entries(store.openLoops)
    .map(([id, item]) => ({ ...(item as OpenLoopRecord), id }))
    .filter((item) => item.userId === resolvedId)
  return { data: { items } }
}

export async function createOpenLoop(payload: Omit<OpenLoopRecord, 'id'>) {
  const userId = resolveUserId(payload.userId)
  const id = createId('open-loop')
  const payloadWithUser = { ...payload, userId }
  withStore((store) => {
    store.openLoops[id] = { ...payloadWithUser, id, createdAt: nowIso() }
  })
  return { data: { id } }
}

// === Goal CRUD Functions ===

export async function createGoal(
  payload: Omit<GoalRecord, 'id' | 'createdAt' | 'updatedAt' | 'milestones' | 'checkIns' | 'linkedActionIds' | 'linkedClaimIds'> & {
    milestones?: Milestone[]
  }
): Promise<BackendResponse<{ id: string; goal: GoalRecord }>> {
  const userId = resolveUserId()
  const id = createId('goal')
  const now = nowIso()

  const goal: GoalRecord = {
    id,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    status: payload.status ?? 'active',
    progress: payload.progress ?? 0,
    targetDate: payload.targetDate ?? null,
    milestones: payload.milestones ?? [],
    checkIns: [],
    linkedActionIds: [],
    linkedClaimIds: [],
    createdAt: now,
    updatedAt: now,
  }

  withStore((store) => {
    const user = ensureUserStore(store, userId)
    user.goals[id] = goal
  })
  syncDoc(`users/${userId}/goals/${id}`, goal as unknown as Record<string, unknown>)

  return { data: { id, goal } }
}

export async function updateGoal(
  goalId: string,
  updates: Partial<Omit<GoalRecord, 'id' | 'createdAt'>>
): Promise<BackendResponse<{ updated: boolean; goal?: GoalRecord }>> {
  if (!goalId) return { error: 'goalId required' }
  const userId = resolveUserId()
  let updatedGoal: GoalRecord | undefined

  withStore((store) => {
    const user = ensureUserStore(store, userId)
    const current = user.goals[goalId] as GoalRecord | undefined
    if (!current) return

    updatedGoal = {
      ...current,
      ...updates,
      id: goalId,
      updatedAt: nowIso(),
    } as GoalRecord
    user.goals[goalId] = updatedGoal as GoalRecord
  })

  if (!updatedGoal) return { error: 'Goal not found' }
  syncDoc(`users/${userId}/goals/${goalId}`, { ...updates, id: goalId } as Record<string, unknown>)
  return { data: { updated: true, goal: updatedGoal } }
}

export async function deleteGoal(goalId: string): Promise<BackendResponse<{ deleted: boolean }>> {
  if (!goalId) return { error: 'goalId required' }
  const userId = resolveUserId()
  let found = false

  withStore((store) => {
    const user = ensureUserStore(store, userId)
    if (user.goals[goalId]) {
      delete user.goals[goalId]
      found = true
    }
  })

  if (found) {
    deleteDocument(`users/${userId}/goals/${goalId}`)
  }
  return found ? { data: { deleted: true } } : { error: 'Goal not found' }
}

export async function getGoal(goalId: string): Promise<BackendResponse<{ goal: GoalRecord | null }>> {
  if (!goalId) return { error: 'goalId required' }
  const userId = resolveUserId()
  const { user } = getUserStore(userId)
  const goal = (user.goals?.[goalId] as GoalRecord | undefined) ?? null
  return { data: { goal } }
}

export async function listGoals(
  status?: GoalStatus | GoalStatus[]
): Promise<BackendResponse<{ items: GoalRecord[] }>> {
  const userId = resolveUserId()
  const { user } = getUserStore(userId)
  let items = listRecords(user.goals as Record<string, GoalRecord>)

  if (status) {
    const statuses = Array.isArray(status) ? status : [status]
    items = items.filter((item) => statuses.includes(item.status))
  }

  // Sort by updatedAt descending (most recent first)
  items.sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
    return dateB - dateA
  })

  return { data: { items } }
}

export async function addMilestoneToGoal(
  goalId: string,
  milestone: Omit<Milestone, 'id'>
): Promise<BackendResponse<{ milestone: Milestone }>> {
  if (!goalId) return { error: 'goalId required' }
  const userId = resolveUserId()
  const milestoneId = createId('milestone')

  const newMilestone: Milestone = {
    id: milestoneId,
    title: milestone.title,
    completed: milestone.completed ?? false,
    completedAt: milestone.completedAt,
  }

  withStore((store) => {
    const user = ensureUserStore(store, userId)
    const goal = user.goals[goalId]
    if (goal) {
      goal.milestones = [...(goal.milestones ?? []), newMilestone]
      goal.updatedAt = nowIso()
    }
  })

  return { data: { milestone: newMilestone } }
}

export async function updateMilestone(
  goalId: string,
  milestoneId: string,
  updates: Partial<Omit<Milestone, 'id'>>
): Promise<BackendResponse<{ updated: boolean }>> {
  if (!goalId || !milestoneId) return { error: 'goalId and milestoneId required' }
  const userId = resolveUserId()
  let found = false

  withStore((store) => {
    const user = ensureUserStore(store, userId)
    const goal = user.goals[goalId]
    if (!goal) return

    goal.milestones = (goal.milestones ?? []).map((m: Milestone) => {
      if (m.id === milestoneId) {
        found = true
        return { ...m, ...updates }
      }
      return m
    })

    // Recalculate progress based on milestone completion
    const completedCount = goal.milestones.filter((m: Milestone) => m.completed).length
    const totalCount = goal.milestones.length
    goal.progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    goal.updatedAt = nowIso()
  })

  return found ? { data: { updated: true } } : { error: 'Milestone not found' }
}

export async function deleteMilestone(
  goalId: string,
  milestoneId: string
): Promise<BackendResponse<{ deleted: boolean }>> {
  if (!goalId || !milestoneId) return { error: 'goalId and milestoneId required' }
  const userId = resolveUserId()
  let found = false

  withStore((store) => {
    const user = ensureUserStore(store, userId)
    const goal = user.goals[goalId]
    if (!goal) return

    const before = goal.milestones?.length ?? 0
    goal.milestones = (goal.milestones ?? []).filter((m: Milestone) => m.id !== milestoneId)
    found = (goal.milestones.length < before)

    // Recalculate progress
    const completedCount = goal.milestones.filter((m: Milestone) => m.completed).length
    const totalCount = goal.milestones.length
    goal.progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    goal.updatedAt = nowIso()
  })

  return found ? { data: { deleted: true } } : { error: 'Milestone not found' }
}

export async function addCheckIn(
  goalId: string,
  checkIn: Omit<CheckIn, 'id' | 'timestamp'>
): Promise<BackendResponse<{ checkIn: CheckIn }>> {
  if (!goalId) return { error: 'goalId required' }
  const userId = resolveUserId()
  const checkInId = createId('checkin')

  const newCheckIn: CheckIn = {
    id: checkInId,
    timestamp: nowIso(),
    status: checkIn.status,
    notes: checkIn.notes,
    aiResponse: checkIn.aiResponse,
    progressSnapshot: checkIn.progressSnapshot,
  }

  withStore((store) => {
    const user = ensureUserStore(store, userId)
    const goal = user.goals[goalId]
    if (goal) {
      goal.checkIns = [...(goal.checkIns ?? []), newCheckIn]
      goal.updatedAt = nowIso()
    }
  })

  return { data: { checkIn: newCheckIn } }
}

export async function generateGoalMilestones(
  goalTitle: string,
  goalDescription: string,
  category: GoalCategory
): Promise<BackendResponse<{ milestones: Omit<Milestone, 'id'>[] }>> {
  const prompt = [
    'You are helping a user break down their goal into actionable milestones.',
    'Generate 3-5 specific, measurable milestones for the following goal.',
    '',
    `Goal: ${goalTitle}`,
    `Description: ${goalDescription}`,
    `Category: ${category}`,
  ].join('\n')

  const milestonesSchema = {
    type: Type.OBJECT,
    properties: {
      milestones: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            completed: { type: Type.BOOLEAN },
          },
          required: ['title', 'completed'],
        },
      },
    },
    required: ['milestones'],
  }

  try {
    const parsed = await generateJson<{ milestones: Array<{ title: string; completed: boolean }> }>(
      prompt,
      'gemini-3-flash-preview',
      milestonesSchema,
      { tools: [{ googleSearch: {} }] },
    )
    const milestones = (parsed.milestones ?? []).map((m) => ({
      title: m.title,
      completed: m.completed ?? false,
    }))
    return { data: { milestones } }
  } catch {
    // Return empty array if AI fails - user can add milestones manually
    return { data: { milestones: [] } }
  }
}

export async function generateCheckInResponse(
  goalTitle: string,
  goalProgress: number,
  checkInStatus: CheckInStatus,
  checkInNotes: string,
  previousCheckIns: CheckIn[]
): Promise<BackendResponse<{ response: string; suggestions?: string[] }>> {
  const recentCheckIns = previousCheckIns.slice(-3).map((c) =>
    `- ${c.timestamp}: ${c.status} - ${c.notes}`
  ).join('\n')

  const prompt = [
    'You are an empathetic AI life coach. Respond to a user\'s goal check-in.',
    'Be encouraging but realistic. Offer specific, actionable advice.',
    '',
    `Goal: ${goalTitle}`,
    `Current progress: ${goalProgress}%`,
    `Check-in status: ${checkInStatus}`,
    `User notes: ${checkInNotes}`,
    recentCheckIns ? `Recent check-ins:\n${recentCheckIns}` : '',
  ].join('\n')

  const checkInSchema = {
    type: Type.OBJECT,
    properties: {
      response: { type: Type.STRING, description: 'Coaching message (2-3 sentences)' },
      suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Actionable suggestions' },
    },
    required: ['response', 'suggestions'],
  }

  try {
    const parsed = await generateJson<{ response: string; suggestions: string[] }>(
      prompt,
      'gemini-3-flash-preview',
      checkInSchema,
      {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        tools: [{ googleSearch: {} }],
      },
    )
    return {
      data: {
        response: parsed.response ?? 'Keep up the great work on your goal!',
        suggestions: parsed.suggestions ?? [],
      }
    }
  } catch {
    // Fallback response if AI fails
    const fallback = checkInStatus === 'on-track'
      ? 'Great job staying on track! Keep up the momentum.'
      : checkInStatus === 'ahead'
        ? 'Excellent progress! You\'re ahead of schedule.'
        : 'Don\'t be discouraged - every step forward counts. Consider breaking down your next action into smaller steps.'
    return { data: { response: fallback, suggestions: [] } }
  }
}

export async function upload(path: string, dataBase64: string, contentType = 'application/octet-stream') {
  if (!path || !dataBase64) return { error: 'path and dataBase64 required' }
  withStore((store) => {
    store.uploads[path] = { dataBase64, contentType, updatedAt: nowIso() }
  })
  return { data: { path } }
}

// === Insights ===
// Note: Insights are computed dynamically from claims, goals, and conversations.
// See focusGenerator.ts computeInsights() function.
// Dismissed insights are tracked in localStorage ('dismissedInsights' key).

export async function getGeminiSessionKey() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.toString() ?? ''
  if (!apiKey) return { error: 'Gemini API key missing' }
  return { data: { jwe: apiKey } }
}

export {
  hasBackend,
  getSessionToken,
  getSessionUser,
  resolveUserId,
  embedText,
  cosineSimilarity,
  extractClaimsAndActions,
  detectConflict,
  detectEmotion,
  analyzeImage,
  calculateEmotionalSummary,
}

export type {
  BackendResponse,
  TranscriptTurn,
  ConversationSummary,
  GeoLocation,
  ClaimRecord,
  ActionRecord,
  ActionStatus,
  ActionType,
  ActionPermission,
  ActionExecutionType,
  ReviewRecord,
  UserProfile,
  GoalRecord,
  GoalCategory,
  GoalStatus,
  Milestone,
  CheckIn,
  CheckInStatus,
  InsightRecord,
  InsightType,
  InsightStatus,
  EmotionCategory,
  EmotionalState,
  EmotionalSummary,
}
