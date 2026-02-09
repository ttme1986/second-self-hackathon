# Second-Self V2 SPEC (Current Implementation)

## 1) Summary

Second-Self is an **Autonomous Life Operating System** — a mobile-first web app that captures life through voice, extracts knowledge in real-time, tracks goals, understands emotions, and executes actions autonomously with user permission.

**Four Pillars:**
1. **Multimodal Life Capture** — Voice, text, photos, location
2. **Proactive Intelligence** — Surface insights before users ask
3. **Goal & Accountability** — Track aspirations with AI coaching
4. **Autonomous Execution** — Take action with user-controlled permissions

**Primary Surfaces:**
- **Hub** — Intelligent dashboard with Today's Focus and Proactive Insights
- **Chat** — Voice-first capture with real-time extraction and action bar
- **Reflect** — Memory timeline, claims, goals, and follow-ups
- **Settings** — Privacy controls and autonomous action permissions

**Technical Stack:**
- React 19 + Vite + TypeScript (frontend)
- Gemini Live for real-time voice (`gemini-2.5-flash-native-audio-preview-12-2025`)
- Gemini 3 Flash for text generation and analysis
- Gemini 3 Pro for agentic vision (`gemini-3-pro-preview`)
- Text Embedding (`gemini-embedding-001`) for semantic search and deduplication
- Client-side blackboard pattern with specialized agents
- localStorage primary with Firebase cloud sync

---

## 2) Goals (Hackathon MVP)

### Must Have (Demo-Ready)
- Voice-first Chat with Gemini Live audio and streaming transcripts
- Real-time claim extraction with evidence display
- Real-time action suggestion with approve/dismiss
- Autonomous action execution with permission levels (Suggest/Draft/Execute)
- Session recap with AI summary, knowledge, and categorized actions
- Proactive insights on Hub (Today's Focus, memory surfacing)
- Goal tracking with progress visualization and milestones
- Emotional tone detection during conversations
- Evidence-backed outputs (receipts for all AI claims)

### Should Have (Polish)
- Goal check-in flow with AI coaching suggestions
- Emotional trend visualization
- Wellness insights based on emotional patterns
- Draft & Review flow for autonomous actions
- Multimodal search across moments, claims, and goals

### Nice to Have (Stretch)
- Calendar integration for autonomous scheduling
- Email draft generation
- Push notifications for insights

### Implemented (Originally Stretch)
- Photo capture in Chat with live camera viewfinder
- File attachment capture in Chat with preview

---

## 3) Non-Goals (Current Scope)

- Offline/PWA support
- Multi-device real-time sync
- Server-hosted agent runtime
- Third-party integrations (calendar, email, task managers)
- Encryption at rest (required before production)
- Complex multi-user collaboration

---

## 4) Information Architecture

### 4.1 Hub
- Time-of-day greeting with user name and emotional awareness
- **Quick Capture** buttons: Voice, Note, Photo
- **Today's Focus** section:
  - Goal milestones due
  - Follow-ups due today
  - Suggested actions from recent conversations
  - Empty state: no card displayed (section hidden when empty)
- Navigation cards: Chat, Reflect
- **Attention Required** section:
  - Due Today pill (count of follow-ups due today)
  - Review Queue pill (count of pending review items)
- **Proactive Insights** cards (1-3 visible, positioned at bottom):
  - Memory surfacing ("This day last year...")
  - Pattern detection ("You seem most productive on...")
  - Connection making ("Based on what you mentioned...")
  - Wellness checks (if emotional patterns detected)
- Settings link in header

### 4.2 Chat
- Header with date, time, session timer (MM:SS format), and tune settings button
- Microphone button with state indicator (Listening/Paused/Connecting)
- Dual transcript display: user (bottom), assistant (top)
- **Knowledge banner** (sticky at top of chat main):
  - Shows newly inferred claims as a popup banner with auto_awesome icon
  - Auto-dismisses after 10 seconds, replaced by next new claim
  - Dismiss (X) button for manual close
  - Text truncated with ellipsis for long claims
- **Action bar** (top):
  - Shows 1 action at a time; badge (+N) for additional pending actions
  - Each action: title (truncated), execution type indicator, Why? button
  - Approve (+) → permission selector
  - Dismiss (X) → recoverable in recap
- **Attachment popup** (above mic button):
  - Camera button → opens live video viewfinder for photo capture
  - Attach file button → file picker for documents/images
  - Attachment previews shown as popup grid above mic icon
  - When attachments are added, image analysis runs immediately and results are sent to the Gemini Live API automatically
  - Auto-dismisses after AI responds to the message
  - Manual close (X) clears all attachments
- Tools drawer (infrastructure present; tool definitions in `toolPrompts.ts` with ids: bio, decision, weekly, growth — currently inactive, tools array empty in Chat.tsx)
- Auto-greeting on session start with memory context (addresses user by name, mentions urgent actions or recaps last conversation)
- Text input for typed notes → sends through Gemini Live API for conversational response
- End session button → Recap modal
- **Location capture**: When geoCapture is enabled, captures location at conversation start

### 4.3 Session Recap
- **Close button** (X icon, top right) → returns to Hub
- **AI Summary** with emotional context
- **Emotional Summary** of conversation arc (with mood visualization)
- **Knowledge Inferred** with count and expandable list
- **Conflicts for Review** with severity badges (shown when review queue items exist)
- **Confirmed Actions** with execution status
- **Suggested Actions** (can still approve)
- **Rejected Actions** (can revive with + button)
- CTA: "Go to Reflect" button → navigates to Reflect Follow-ups tab
- **Memory summary consolidation**: On session end, the conversation summary is consolidated into a rolling `memorySummary` on the user profile (500-word cap). Uses Gemini to merge the new conversation summary with the existing memory summary, prioritizing recent and actionable information.
- **Deferred Firestore commit**: On recap close (or "Go to Reflect"), all session data (conversation, claims, actions, memorySummary, review queue items) is batch-written to Firestore via `commitSessionToFirestore`. No Firestore writes occur during the active session — localStorage is the sole source of truth until the user confirms the recap.
- **Cloud upload**: On session end, uploads transcript, attachments, and photos to Firebase Cloud Storage

### 4.4 Reflect
Four tabs in bottom navigation: Memories, Profile, Commitments, Review

**Memories (Timeline):**
- Conversations as moment cards with media indicators
- Grouped: Recent (first 2) and Earlier
- Each moment: timestamp, summary, emotional indicator
- Tap to open detail modal with full transcript and linked entities
- No inline search box (search is separate overlay)

**Profile (About Me):**
- Filter chips: All, Confirmed, Inferred
- Grouped by category: Preferences, Skills, Relationships, Other
- Pinned claims first
- Each claim: text, confidence, status badge, evidence, pin toggle
- Tap to edit text, change status, view evidence
- No section header (clean UI)

**Commitments (Follow-ups):**
- Sub-tabs: Actions, Goals
- **Actions sub-tab:**
  - Grouped by due window: Today, This Week, This Month, Everything else
  - Each item: checkbox, title, execution status, source link, due dropdown, reminder toggle
  - View drafted content for draft actions
- **Goals sub-tab:**
  - Filter: Active, Completed, Paused
  - Each goal: title, category, progress bar, target date, next milestone
  - Tap for detail: description, milestones, progress chart, AI suggestions, check-in history
  - Check-in flow: quick status + AI coaching response
- No section header (clean UI)

**Review:**
- Conflicts sorted by severity (Contradiction/Medium/Low badges)
- Each item displays:
  - Two claim cards side-by-side with:
    - Date label (e.g., "NOTE FROM 22 JAN 2026")
    - Claim text
    - Selection radio button
    - "Newest" badge on most recent claim (amber color)
  - Resolution options:
    - **Confirm Selected**: Confirms the selected claim, rejects the other
    - **Edit button** (merge): Opens merge editor with AI-suggested text
- No section header (clean UI)

**Search:**
- Overlay with input field (accessible via search button)
- Results: moments (semantic), claims (keyword + semantic), goals
- Clear button to reset

### 4.5 Settings
- **Profile section:** Display name (read-only), email
- **Privacy section:**
  - Always capture location toggle
  - PII redaction toggle
- **Autonomous Actions section:**
  - Default permission level: Suggest Only / Draft & Review / Execute Now
  - Per-action-type overrides
- **Data section:**
  - Export all data button
  - Delete all data button (with confirmation)
- Sign out button in header

---

## 5) Core Entities

### 5.1 UserProfile
```typescript
interface UserProfile {
  uid: string
  displayName: string
  photoURL: string | null
  email: string | null
  geoCapture: boolean
  onboardingComplete: boolean
  defaultActionPermission?: ActionPermission  // defaults to 'suggest'
  actionPermissions?: Partial<Record<ActionType, ActionPermission>>
  memorySummary?: string  // Rolling 500-word-capped summary, consolidated at hangup
}

type ActionPermission = 'suggest' | 'draft' | 'execute'
type ActionType = 'reminder' | 'email' | 'calendar' | 'goal' | 'reading' | 'general'
```

### 5.2 Conversation (Moment)
```typescript
interface ConversationSummary {
  id: string
  summary: string
  startedAt: string  // ISO 8601
  endedAt: string    // ISO 8601
  durationMs: number
  transcriptPath?: string  // Firebase Storage path
  transcript?: TranscriptTurn[]
  claimIds?: string[]
  confirmedActionIds?: string[]
  embedding?: number[]
  status?: 'active' | 'ended'
  location?: GeoLocation
  emotionalStates?: EmotionalState[]  // AI-detected emotional states persisted at session end
}

interface TranscriptTurn {
  speaker: 'user' | 'assistant'
  text: string
  t_ms: number
}

interface GeoLocation {
  latitude: number
  longitude: number
  timestamp: number
}
```

### 5.3 Claim
```typescript
interface ClaimRecord {
  id: string
  text: string
  category: ClaimCategory
  confidence: number  // 0-1
  evidence: string[]  // Array of evidence text snippets
  status: 'confirmed' | 'inferred' | 'rejected'
  conversationId: string
  pinned?: boolean
  embedding?: number[]  // For similarity search
  createdAt?: string
  updatedAt?: string
}

type ClaimCategory = 'preferences' | 'skills' | 'relationships' | 'other'
```

**Claim text style:** Claims are written in first-person "About Me" style without "The user" prefix. For example: "Practises yoga daily" not "The user practises yoga daily". Since claims appear in the user's About Me profile, third-person references are redundant.

**Note:** Evidence is stored as `string[]` in the backend. The UI converts it to `Evidence[]` format for display:

```typescript
// UI Evidence format (in reflectData.ts)
interface Evidence {
  id: string
  momentTitle: string
  snippet: string
  timestamp: string  // ISO 8601
}
```

### 5.4 Goal
```typescript
interface GoalRecord {
  id: string
  title: string
  description: string
  category: GoalCategory
  status: GoalStatus
  progress: number  // 0-100
  targetDate: string | null  // ISO 8601
  milestones: Milestone[]
  checkIns: CheckIn[]
  linkedActionIds: string[]
  linkedClaimIds: string[]
  createdAt: string
  updatedAt: string
}

type GoalCategory = 'health' | 'career' | 'learning' | 'relationships' | 'finance' | 'personal' | 'other'
type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned'

interface Milestone {
  id: string
  title: string
  completed: boolean
  completedAt?: string
}

interface CheckIn {
  id: string
  timestamp: string
  status: CheckInStatus
  notes: string
  aiResponse: string
  progressSnapshot?: number
}

type CheckInStatus = 'on-track' | 'behind' | 'ahead'
```

### 5.5 Action
```typescript
interface ActionRecord {
  id: string
  title: string
  context?: string
  evidence?: string[]
  dueWindow: DueWindow
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

type DueWindow = 'Today' | 'This Week' | 'This Month' | 'Everything else'
type ActionStatus = 'suggested' | 'approved' | 'executing' | 'completed' | 'dismissed' | 'failed' | 'confirmed' | 'done'
type ActionExecutionType = 'manual' | 'draft' | 'auto'
type ActionPermission = 'suggest' | 'draft' | 'execute'
```

### 5.6 Insight
```typescript
interface InsightRecord {
  id: string
  type: InsightType
  title: string
  content: string
  reasoning?: string
  linkedEntityId?: string
  linkedEntityType?: 'goal' | 'action' | 'claim' | 'conversation'
  actionLabel?: string
  status: 'active' | 'dismissed' | 'acted_on'
  priority: number  // 1-10
  expiresAt?: string
  createdAt?: string
  updatedAt?: string
}

type InsightType = 'memory' | 'pattern' | 'goal_progress' | 'upcoming' | 'wellness' | 'general'
```

### 5.7 EmotionalState
```typescript
interface EmotionalState {
  primary: EmotionCategory
  secondary?: EmotionCategory
  valence: number   // -1 to 1 (negative to positive)
  intensity: number // 0 to 1
  confidence: number // 0 to 1
  timestamp?: string
}

type EmotionCategory = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral' | 'stress' | 'calm'
```

### 5.8 ReviewItem
```typescript
interface ReviewRecord {
  id: string
  claimIds?: [string, string]  // left, right
  claims?: [string, string]    // claim texts for display
  actionIds?: string[]         // linked action IDs
  title?: string
  summary?: string
  conversationId: string
  status: 'pending' | 'resolved'
  severity?: ReviewSeverity
  resolution?: ReviewResolution
}

type ReviewSeverity = 'low' | 'medium' | 'high'
type ReviewResolution = 'confirm-left' | 'confirm-right' | 'reject-both' | 'merge'
```

---

## 6) System Architecture

### 6.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          User Interface Layer                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────────┐  ┌──────────┐  ┌─────────┐  │
│  │   Hub   │  │  Chat   │  │   Reflect   │  │ Settings │  │  Login  │  │
│  └────┬────┘  └────┬────┘  └──────┬──────┘  └────┬─────┘  └────┬────┘  │
└───────┼────────────┼───────────────┼─────────────┼─────────────┼───────┘
        │            │               │             │             │
┌───────┼────────────┼───────────────┼─────────────┼─────────────┼───────┐
│       │      Component Layer       │             │             │        │
│  ┌────┴────┐  ┌────┴────┐  ┌──────┴──────┐  ┌──┴──┐  ┌───────┴─────┐  │
│  │ Today's │  │ Camera  │  │    Goal     │  │Perm │  │   Insight   │  │
│  │  Focus  │  │Viewfinder│  │ Components │  │Modal│  │    Cards    │  │
│  └─────────┘  └─────────┘  └─────────────┘  └─────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
        │            │               │             │
┌───────┴────────────┴───────────────┴─────────────┴─────────────────────┐
│                           Service Layer                                 │
│  ┌─────────────────┐  ┌───────────────────┐  ┌───────────────────────┐ │
│  │ Live Audio      │  │ Blackboard        │  │ Focus Generator       │ │
│  │ Service         │  │ Pipeline          │  │                       │ │
│  │ (Gemini Live)   │  │ (Agent Pipeline)  │  │                       │ │
│  └────────┬────────┘  └─────────┬─────────┘  └───────────────────────┘ │
│           │                     │                                       │
│  ┌────────┴────────┐  ┌─────────┴─────────┐  ┌───────────────────────┐ │
│  │ Action Executor │  │ Emotion Tracker   │  │ Storage Upload        │ │
│  └─────────────────┘  └───────────────────┘  └───────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┬─┘
                                                                        │
┌───────────────────────────────────────────────────────────────────────┴─┐
│                    Agent Pipeline (Blackboard Pattern)                   │
│                                                                          │
│   ┌──────────────┐                                                       │
│   │  Blackboard  │◄──── Task Queue + Event Bus                          │
│   │  Message Bus │                                                       │
│   └──────┬───────┘                                                       │
│          │                                                               │
│   ┌──────┴─────────────────────────────────────────────────────────┐    │
│   │                                                                 │    │
│   │  ┌─────────────────┐   ┌─────────────────┐   ┌──────────────┐  │    │
│   │  │ Analyzer Agent  │──►│ Validator Agent │──►│Action Publish│  │    │
│   │  │ Extract Claims  │   │ Dedupe/Conflict │   │   Agent      │  │    │
│   │  │ & Actions       │   │ Detection       │   │ Surface UI   │  │    │
│   │  └─────────────────┘   └─────────────────┘   └──────────────┘  │    │
│   │                                                                 │    │
│   └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┬┘
                                                                          │
┌─────────────────────────────────────────────────────────────────────────┴┐
│                          State Management                                │
│  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────────┐   │
│  │    Local Store     │  │  Profile Provider  │  │ Open Loops       │   │
│  │ localStorage+memory│  │   (React Context)  │  │ Provider         │   │
│  └─────────┬──────────┘  └────────────────────┘  └──────────────────┘   │
│            │                                                             │
└────────────┼─────────────────────────────────────────────────────────────┘
             │
┌────────────┴─────────────────────────────────────────────────────────────┐
│                         Backend Integration                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐  │
│  │  Backend API   │  │   Firestore    │  │    Firebase Storage        │  │
│  │(backend.ts)    │  │ Cloud Database │  │  Transcripts/Photos/Media  │  │
│  └────────────────┘  └────────────────┘  └────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
             │
┌────────────┴─────────────────────────────────────────────────────────────┐
│                            AI Services                                    │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌───────────────┐│
│  │   Gemini Live     │ │  Gemini 3 Pro    │ │ Gemini 3 Flash   │ │Text Embedding ││
│  │ gemini-2.5-flash- │ │ gemini-3-pro-    │ │ Text Generation   │ │gemini-embedding│
│  │ native-audio-     │ │ preview          │ │ Claims/Actions/etc│ │-001           ││
│  │ preview           │ │ Agentic Vision   │ │ Vision Fallback   │ │Semantic Search││
│  │ Voice: Kore       │ │ (primary)        │ │                   │ │               ││
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ └───────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Blackboard Task Types

The Blackboard pattern coordinates agents via typed tasks:

```typescript
type BlackboardTask =
  | { type: 'turn.ingest'; turn: TranscriptTurn; conversationId: string }
  | { type: 'claim.proposed'; claim: ClaimProposed; conversationId: string }
  | { type: 'action.proposed'; action: ActionProposed; conversationId: string }
  | { type: 'action.validated'; action: ActionProposed; conversationId: string }
  | { type: 'action.user_decision'; decision: UserDecision; conversationId: string }
  | { type: 'conversation.finalize'; conversationId: string }
```

### 6.3 Agent Pipeline Flow

```
Voice Input → Gemini Live → Transcript Turns
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  turn.ingest    │
                          │  (Blackboard)   │
                          └────────┬────────┘
                                   │
                          ┌────────▼────────┐
                          │ Analyzer Agent  │
                          │ extractClaims   │
                          │ AndActions()    │
                          │ (in-session     │
                          │  dedup)         │
                          └────────┬────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                              ▼
          ┌─────────────────┐            ┌─────────────────┐
          │ claim.proposed  │            │ action.proposed │
          └────────┬────────┘            └────────┬────────┘
                   │                              │
                   └──────────┬───────────────────┘
                              ▼
                    ┌─────────────────┐
                    │ Validator Agent │
                    │ - embedText()   │
                    │ - cosineSim     │
                    │ - detectConflict│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       Claims:          Claims:        Actions:
       Merge (≥0.9)     Conflict       action.validated
       increment        (0.7-0.9)      (≥0.9 dropped,
       confidence       ReviewItem     0.7-0.9 review)
                                            │
                                   ┌────────▼────────┐
                                   │ ActionPublish   │
                                   │ Agent           │
                                   │ - Surface to UI │
                                   │ - Persist action│
                                   └─────────────────┘
```

### 6.4 Data Flow: Voice Session

```
User speaks → Microphone
                  │
                  ▼
          AudioWorklet (16kHz PCM16)
                  │
                  ▼
          LiveAudioService.send()
                  │
                  ▼
          Gemini Live API ─────────────────┐
                  │                        │
                  ▼                        ▼
          Assistant audio         Server transcription
          (24kHz)                 (user/assistant turns)
                  │                        │
                  ▼                        │
          AudioScheduler                   │
          play()                           │
                  │                        │
                  ▼                        ▼
          Speaker output          Chat.tsx updates state
                                          │
                                          ▼
                                  Blackboard.enqueue(turn.ingest)
                                          │
                                          ▼
                                  Agent Pipeline processes
                                          │
                                          ▼
                                  UI updates (claims, actions)
```

---

## 7) Chat Surface Details

### 7.1 Voice Session & Text Chat
- Gemini Live API via @google/genai (client-side, no backend relay)
- Text chat (during voice session): `sendClientContent` sends typed text through the Live session
- Text-only mode: `connectTextOnly` creates a standard chat session via `ai.chats.create()` with `gemini-3-flash-preview` (the Live API's native audio model does not support text-only I/O). Responses stream via `sendMessageStream()`
- **Memory context loading**: On session start, `buildMemoryContext()` loads recent conversations (3 most recent), claims, actions, goals, and the rolling memorySummary from the user profile to assemble a dynamic system prompt with user memory
- **Dynamic system prompt**: Includes current date/time, rolling memorySummary (500-word cap), user knowledge, 3 most recent conversations (with date+time), outstanding actions, active goals, and greeting instructions
- **Auto-greeting**: After connection, a `[Session started. Please greet the user.]` trigger is sent via `sendClientContent`, causing the model to greet the user by name with context-aware content (urgent actions, last conversation recap, or simple greeting for new users)
- **Text-only auto-connect**: When `VITE_DISABLE_LIVE_AUDIO=true`, the text session auto-connects on page load (no gesture required) and sends the greeting trigger immediately
- Default voice model: `gemini-2.5-flash-native-audio-preview-12-2025` (env `VITE_GEMINI_LIVE_MODEL`)
- Default text model: `gemini-3-flash-preview` (env `VITE_GEMINI_TEXT_MODEL`)
- Default voice: `Kore` (env `VITE_GEMINI_LIVE_VOICE`)
- Input: 16 kHz PCM16 via AudioWorklet (32 ms frames)
- Output: 24 kHz
- Transcriptions enabled when `VITE_GEMINI_LIVE_TRANSCRIPTIONS=true` (default)
- Barge-in detection when user interrupts assistant
- Session timer shows elapsed time (MM:SS)
- **Mic permission denied handling**: If the browser denies microphone access, the UI shows "Mic unavailable" / "Tap mic to retry", and automatically falls back to a text-only session with greeting. The mic button remains enabled so the user can retry; on retry, the app clears the denied state and attempts `getUserMedia` again (succeeds if the user has updated browser permissions)
- **Transcript finalization (voice mode)**: Transcription events from the Gemini Live API arrive as incremental chunks without explicit finality signals. The `liveAudioService` accumulates transcription text and finalizes turns based on external signals: output transcription finalizes on `turnComplete`, input transcription finalizes on VAD end (`voiceActivityEnd`), and any pending transcription finalizes on disconnect or interruption. Only finalized turns are recorded in the transcript, persisted to Firestore, and enqueued to the blackboard pipeline for agent processing
- **Transcript finalization (text-only mode)**: In text-only mode, responses stream via `sendMessageStream()` from the Gemini Chat API. Each chunk is accumulated and emitted as non-final, with the complete response emitted as final when the stream ends

### 7.2 Real-Time Processing
- Finalized transcript turns fed to blackboard (non-final incremental updates only affect display)
- AnalyzerAgent extracts claims and actions with in-session dedup (skips already-extracted items)
- ValidatorAgent deduplicates both claims and actions via embedding similarity, detects conflicts
- ActionPublishAgent surfaces validated actions to UI (consumes `action.validated`)
- EmotionTracker detects emotional tone from transcript
- All processing visible in Chat UI with evidence

### 7.3 Action Bar
- 1 pending suggestion visible at a time; badge "+N" for additional pending actions
- Each action displays:
  - Title and context
  - Execution type indicator (manual/draft/auto)
  - "Why?" button for evidence
  - Approve (checkmark) → permission selector modal
  - Dismiss (X) → hidden but recoverable in recap
- Approved actions saved immediately with selected permission

### 7.4 Permission Selector Modal
When user approves an action:
1. Modal shows three options:
   - **Suggest Only** — Save to Follow ups for manual execution
   - **Draft & Review** — AI drafts content, user reviews before sending
   - **Execute Now** — AI executes immediately with notification
2. Selected permission applied to action
3. If Draft or Execute, processing begins immediately
4. Result notification shown

### 7.5 Session Recap
Opens after user taps "End session":
- **AI Summary**: 2-5 sentences with emotional context
- **Knowledge Inferred**: Claims extracted with count, expandable
- **Conflicts for Review**: Review queue items with severity badges (only shown when conflicts exist)
- **Confirmed Actions**: Approved during call with execution status icons
- **Suggested Actions**: Pending, can still approve
- **Rejected Actions**: Dismissed, can revive with "+" button
- **Emotional Summary**: Detected arc of conversation
- CTAs: "Follow ups" (→ Reflect tab), "Goals" (→ Reflect tab), "Close" (→ Hub)

---

## 8) Proactive Intelligence System

### 8.1 Insight Generation
Insights generated on app open and after conversation:
- Check for anniversaries ("This day last year...")
- Check for pattern matches (time of day, activity correlations)
- Check for goal-relevant events (milestone due, progress stall)
- Check for emotional patterns (stress mentions, mood trends)

### 8.2 Today's Focus Generation
On Hub load:
- Query goals for milestones due today/soon
- Query actions for due window = 'Today'
- Query recent conversations for suggested actions
- Prioritize by urgency and goal alignment
- Display top 3-5 items

### 8.3 Insight Display
- Cards on Hub (1-3 visible)
- Each card: title, brief explanation, "Why?" button, action button (if applicable)
- Tap to expand: full reasoning, evidence, suggested action
- Dismiss logs insight as dismissed (not resurfaced)

---

## 9) Goal & Accountability System

### 9.1 Goal Creation
From Chat (voice):
- User says "I want to [goal]"
- AI extracts goal intent
- Goal Setter tool prompts for details
- AI suggests initial milestones

From Goals tab:
- User taps "+" button
- Modal for title, description, category, target date
- AI suggests milestones based on goal type

### 9.2 Progress Tracking
Automatic updates:
- Completed milestones → progress recalculated
- Related actions marked done → progress increment
- Check-in responses → progress adjustment

Manual updates:
- User can edit progress directly
- User can add/complete milestones

### 9.3 Check-In Flow
Triggered weekly for active goals:
1. Modal shows goal summary and progress since last check-in
2. Quick response buttons: On track / Behind / Ahead
3. Optional notes input
4. Submit → AI generates coaching response
5. AI may suggest actions or milestone adjustments

### 9.4 Goal Visualization
- Progress bar (percentage)
- Milestone list with completion status
- Progress history chart (line graph over time)
- Streak indicator (days/weeks of consistent progress)

---

## 10) Emotional Intelligence System

### 10.1 Detection Methods
**Voice Analysis:**
- Gemini audio understanding extracts emotional signals
- Processed per transcript turn
- Outputs: emotion labels with confidence, valence, intensity

**Text Analysis:**
- Sentiment analysis on transcript text
- Keyword detection for emotional language
- Combined with voice for higher confidence

### 10.2 Real-Time Display
- Subtle indicator in Chat UI (e.g., colored dot or emoji)
- Not intrusive, visible on request
- Summary in session recap

### 10.3 Longitudinal Tracking
- EmotionalState records persisted on the conversation record at session end (`emotionalStates` field)
- `getEmotionTrends()` reads stored EmotionalState arrays from conversations for accurate trend data
- Falls back to keyword matching on conversation summaries for legacy conversations without stored emotional data
- Weekly aggregation for trend analysis
- Correlation with activities, goals, time of day

### 10.4 Wellness Insights
Generated when patterns detected:
- "I've noticed you've mentioned feeling stressed 3x this week"
- Links to evidence (specific moments)
- Shows past coping strategies that helped
- Suggests self-care action

### 10.5 Adaptive Responses
AI adjusts tone based on detected emotion:
- More supportive language when stress detected
- Celebratory when positive achievements discussed
- Gentle prompts when low energy detected

---

## 11) Autonomous Execution System

### 11.1 Permission Levels
1. **Suggest Only** — AI recommends, user executes manually
2. **Draft & Review** — AI drafts content, user approves before sending
3. **Execute Now** — AI executes immediately, user notified after

### 11.2 Supported Actions (V1 MVP)
| Action Type | Execution Options | Output |
|-------------|-------------------|--------|
| Follow-up reminder | Suggest, Draft, Execute | In-app notification |
| Email draft | Suggest, Draft | Draft text in Follow ups |
| Calendar event | Suggest, Draft | Event details in Follow ups |
| Goal milestone | Suggest, Execute | Milestone marked complete |
| Reading list add | Suggest, Execute | Item added to list |

### 11.3 Execution Flow
1. AI detects actionable intent in conversation
2. Action appears in action bar with evidence
3. User approves and selects permission level
4. If Suggest: saved to Follow ups as manual task
5. If Draft: AI generates content, saved for review
6. If Execute: AI performs action, result logged
7. Status visible in action bar, recap, and Follow ups

### 11.4 Draft Review Flow
For Draft & Review actions:
1. AI generates draft (email body, event details, etc.)
2. Draft saved to Follow ups with "Review" badge
3. User taps to see full draft
4. User can edit, approve, or delete
5. Approved drafts executed or marked ready

---

## 12) Data and Storage

### 12.1 Primary Storage (localStorage)
- Key: `secondSelfStore`
- Structure:
  ```json
  {
    "version": 2,
    "users": {
      "[uid]": {
        "profile": {},
        "claims": {},
        "goals": {},
        "reviewQueue": {},
        "actions": {},
        "conversations": {}
      }
    },
    "moments": {},
    "openLoops": {},
    "uploads": {}
  }
  ```
- Per-user data partitioning
- Offline-safe with memory fallback

### 12.2 Firebase (Persistent Backing Store)
- Firebase JS SDK for Auth, Firestore, Storage
- **Deferred write pattern**: During an active conversation session, ALL Firestore writes are deferred. localStorage remains the sole source of truth during the call. At recap confirmation, the final state is batch-written to Firestore via `writeBatch`.
  - **Write gate** (`firestoreWriteGate.ts`): A module-level flag controls whether Firestore writes are deferred
    - `startDeferring()` — called in `startConversation()`, activates the gate
    - `stopDeferring()` — called by `commitSessionToFirestore()` after batch commit
    - `isDeferring()` — checked by `syncDoc()`, `deleteDocument()`, and `fsAppendConversationClaim` to skip writes
  - **During session**: `syncDoc()` and `deleteDocument()` return immediately when deferring is active. All data modifications go to localStorage only.
  - **At recap close**: `commitSessionToFirestore(conversationId)` reads the final localStorage state (after any user edits in the recap modal) and batch-writes everything to Firestore in a single `writeBatch`:
    - Conversation document (summary, status, timestamps, emotional states)
    - Claims linked to the conversation
    - Actions (suggested + confirmed) linked to the conversation
    - `memorySummary` on user profile
    - Review queue items for the conversation
  - **Outside sessions**: Firestore writes proceed normally (e.g., `updateProfile`, `createGoal`, `resolveReviewQueue`)
  - **Crash recovery**: `hasUncommittedSession()` checks for a `second-self:active-session` localStorage key set at session start. On app load, if an uncommitted session is detected, `commitSessionToFirestore` is called to flush pending data. This ensures no data loss if the user closes the browser mid-session without reaching the recap.
  - **ActionPublishAgent**: Uses `backend.ts` functions (`createAction`, `appendConversationAction`) instead of direct Firestore calls, ensuring all action writes go through localStorage first with gated Firestore sync
- **Excluded from Firestore sync** (too large or transient):
  - `embedding` vectors (large arrays, only needed locally for semantic search)
  - `transcript` arrays (uploaded separately to Firebase Storage as JSON files)
  - Per-turn `appendConversationTurn` data (transient, not needed in Firestore)
- Firestore collections under `users/{uid}/`:
  - `claims/{claimId}`
  - `goals/{goalId}`
  - `actions/{actionId}`
  - `reviewQueue/{reviewId}`
  - `conversations/{conversationId}`
  - `insights/{insightId}`
  - `emotionalStates/{stateId}`

### 12.3 Transcript and Media Storage
- Full transcripts stored in Firebase Cloud Storage
- Path: `users/{uid}/conversations/{conversationId}/transcript.json`
- Attachments: `users/{uid}/conversations/{conversationId}/attachments/{filename}`
- Photos: `users/{uid}/conversations/{conversationId}/photos/{filename}`
- Excerpts embedded in conversation document for quick access
- Upload occurs at session end (hangup)

### 12.4 Demo Data Scripts
- **Push demo data** (`npm run push-demo-data`): Populates Firestore subcollections and Firebase Storage with demo data from `demo/data.json`
- **Delete demo data** (`npm run delete-demo-data`): Deletes all Firestore subcollection documents (actions, claims, conversations, goals, reviewQueue) and all Firebase Storage files under `users/{userId}/`. Preserves the user profile document. Uses batched deletes (500 docs per batch) for large collections.

### 12.5 Demo Video Script
- **Run demo** (`npm run demo`): Automated ~3:10 video recording via Playwright + Gemini TTS
- Script: `app/scripts/demo.mjs`
- **Pre-generated narration**: All 16 narration clips are pre-generated at startup via Gemini TTS. No runtime/on-the-fly TTS generation during the demo. Narration is feature-focused (no specific data values), name-drops "Gemini 3", "Gemini Embeddings", and "agentic vision" prominently.
- **Sign-in narration**: Plays over the login screen before Hub loads
- **5-turn chat**: Natural conversation flow — running achievement, restaurant booking (approve action), gift reminder (dismiss action), blood pressure photo (agentic vision), stress wrap-up. Realistic turn-taking: wait for AI text + audio to finish, play user simulation audio, then send user text. No voiceover during live interaction; chat narrations (extraction, vision) play after the final AI response.
- **Flow per segment**: Navigate → speak pre-generated narration (scroll/click during speech) → await completion → navigate next
- **Max silence**: No silence longer than 5 seconds between narration segments (except during Chat AI interaction waits)
- **TTS**: Gemini `gemini-2.5-flash-preview-tts` with Chirp 3: HD voice, falls back to browser speechSynthesis
- **Click highlighting**: Injected via `context.addInitScript()` on every page — blue 24px cursor dot follows mouse, expanding ring ripple animation on every click (`pointer-events: none`, z-index 99999)
- **Audio capture**: Narration WAV files saved to `demo-output/audio/`. In-browser AI voice captured via AudioNode.connect monkey-patch (intercepts Live API GainNode → AudioDestinationNode). Audio timeline tracked with per-clip offset timestamps.
- **FFmpeg post-merge**: After Playwright video is saved, `ffmpeg-static` merges the silent `.webm` with narration WAVs (with `atempo` rate adjustment and `adelay` offsets) and captured chat AI audio via `amix`. Output: `demo-output/final-demo.webm`. Falls back to saving `audioTimeline.json` + individual files with manual merge instructions if `ffmpeg-static` is not installed.

---

## 13) AI and ML

### 13.1 Gemini Live (Voice)
- Real-time bidirectional audio via @google/genai
- Model: `gemini-2.5-flash-native-audio-preview-12-2025`
- Voice: `Kore` (configurable via env)
- Echo cancellation, noise suppression, auto-gain control
- Voice Activity Detection (VAD) feedback
- Configurable voice and model via environment variables

### 13.2 Gemini Text (Analysis)
- Model: `gemini-3-flash-preview` for text generation
- Model: `gemini-3-pro-preview` for agentic vision (image analysis, primary)
- Model: `gemini-embedding-001` for embeddings
- Functions:
  - `extractClaimsAndActions()` — from transcript turns (supports thought signature preservation for cross-turn continuity)
  - `detectConflict()` — between existing and new claims
  - `summarizeTranscript()` — AI summary with emotional context
  - `embedText()` — for semantic search
  - `generateInsight()` — proactive intelligence
  - `detectEmotion()` — from transcript text
  - `generateGoalMilestones()` — suggest milestones for new goals
  - `generateCheckInResponse()` — AI coaching for goal check-ins
  - `generateActionDraft()` — draft content for autonomous actions
  - `consolidateMemorySummary()` — merge new conversation summary into rolling memory summary (500-word cap)
  - `analyzeImage()` — Agentic Vision (Think/Act/Observe): multimodal image input with code execution and thinking mode for intelligent data extraction from photos (receipts, schedules, charts, documents). Uses `gemini-3-pro-preview` as primary model with `gemini-3-flash-preview` as fallback. Retry with exponential backoff (4 attempts per model with jitter)
- Automatic context caching: all generateContent calls log cache hit metrics via `usageMetadata.cachedContentTokenCount` for cost monitoring

### 13.3 Agent Pipeline
- **AnalyzerAgent**: Extracts claims/actions from transcript turns; preserves Gemini thought signatures across sequential turn processing for reasoning continuity; performs in-session deduplication by tracking already-extracted claim texts and action titles (case-insensitive) and passing them to the LLM prompt to prevent re-extraction
- **ValidatorAgent**: Handles both `claim.proposed` and `action.proposed` tasks. Deduplicates claims (cosine ≥ 0.9 merges, 0.7-0.9 conflict detection). Deduplicates actions (cosine ≥ 0.9 drops, 0.7-0.9 creates review queue item). Validated actions are emitted as `action.validated` tasks
- **ActionPublishAgent**: Consumes `action.validated` tasks (not `action.proposed`), surfaces actions to UI, manages persistence
- Blackboard pattern for inter-agent communication

---

## 14) Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_GEMINI_API_KEY` | Yes | - | Gemini API key |
| `VITE_FIREBASE_API_KEY` | Yes | - | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | - | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | - | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | - | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | - | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Yes | - | Firebase app ID |
| `VITE_GEMINI_LIVE_MODEL` | No | gemini-2.5-flash-native-audio-preview-12-2025 | Live audio model |
| `VITE_GEMINI_TEXT_MODEL` | No | gemini-3-flash-preview | Text-only chat model |
| `VITE_GEMINI_LIVE_VOICE` | No | Kore | Voice selection |
| `VITE_GEMINI_LIVE_TRANSCRIPTIONS` | No | true | Enable transcription |
| `VITE_DISABLE_AI` | No | false | Disable AI features |
| `VITE_DISABLE_AUTH` | No | false | Disable auth (tests) |
| `VITE_SKIP_AUTH` | No | false | Skip auth (dev) |
| `VITE_DISABLE_LIVE_AUDIO` | No | false | Disable voice (tests) |

---

## 15) UI Requirements

### 15.1 Layout
- Portrait-only layout (max 390px width, 844px height)
- Mobile-first responsive design
- Phone frame wrapper for desktop preview

### 15.2 Theme by Surface
- **Hub**: Minimal, light theme, focus on content cards
- **Chat**: Dark theme, voice-centric, live transcripts, action bar prominent
- **Reflect**: Bright notebook theme, tabs at bottom, search overlay
- **Settings**: Simple list layout, grouped sections

### 15.3 Components
- Consistent card design across surfaces
- Toggle buttons for settings
- Progress bars for goals
- Badge indicators for counts
- Modal overlays for details and confirmations

---

## 16) Error and Empty States

| Screen | Empty State |
|--------|-------------|
| Hub Today's Focus | Section hidden (no card displayed) |
| Hub Insights | Section hidden when no insights |
| Action Bar | "No suggested actions yet" with "Tap mic to generate" |
| Memories | "No moments yet. Start a conversation!" |
| Profile (Claims) | "No claims available." |
| Review | "No items in review queue." |
| Goals | "No goals yet. Set your first goal!" |
| Follow ups (Actions) | "All caught up!" |
| Search | "No moments/claims match your query." |

---

## 17) Analytics Events

- auth_sign_in, auth_sign_in_failed, auth_sign_out
- voice_session_start, voice_session_stop
- action_suggested, action_approved, action_dismissed, action_executed
- claim_extracted, claim_status_updated, claim_pinned
- goal_created, goal_updated, goal_checkin, goal_completed
- insight_surfaced, insight_acted, insight_dismissed
- emotion_detected, wellness_insight_surfaced
- search_query, search_result_clicked
- tool_opened, tool_completed
- review_queue_resolved

---

## 18) Testing Infrastructure

### 18.1 Unit Tests (Vitest)
- Location: `app/tests/unit/`
- Config: `vitest.config.ts`
- Tests React components with React Testing Library

### 18.2 Integration Tests (Vitest)
- Location: `app/tests/integration/`
- Config: `vitest.integration.config.ts`
- Tests agent pipeline, backend utilities, Firebase, and Gemini API integrations
- Key tests:
  - `firebase.blackboard-schema.integration.test.ts` - Blackboard schema validation with Firebase
  - `firebase.integration.test.ts` - Firebase CRUD operations
  - `firebase.service-layer.integration.test.ts` - Service layer Firebase integration
  - `backend.utilities.integration.test.ts` - Backend utility function integration
  - `gemini.integration.test.ts` - Gemini API text generation and extraction
  - `gemini.embeddings.integration.test.ts` - Gemini embedding generation and similarity

### 18.3 E2E Tests (Playwright)
- Location: `app/tests/e2e/`
- Config: `playwright.config.ts`
- Tests full user flows with demo account

### 18.4 User Flow Tests (Playwright + Gemini)
- Location: `app/tests/other/user-flow.spec.ts`
- Config: `playwright.user-flow.config.ts`
- Trigger: `npm run test:user-flow`
- **First session**: Auto-greeting captured before first user turn → 10-turn text conversation → hang up → recap modal → Reflect validation → Gemini extraction validation
- **Second session**: Navigate back to /chat → greeting verified (contains user name, concise, context-aware) → 5-turn follow-up conversation with memory-aware simulated user → Gemini validates continuity (assistant references prior context without re-asking known questions)
- Requires: Firebase auth (demo user), Gemini API key
- Text chat via Gemini Chat API (VITE_DISABLE_LIVE_AUDIO=true disables voice, text uses `ai.chats.create()` with streaming)
- Timeout: 600 seconds (10 minutes) to accommodate both sessions

### 18.5 User Flow Audio Tests (Playwright + Gemini Live API)
- Location: `app/tests/other/user-flow-live.spec.ts`
- Config: `playwright.user-flow-live.config.ts`
- Trigger: `npm run test:user-flow-live`
- Identical flow to user-flow test but uses the Gemini Live API with audio instead of the text-only Chat API
- Chromium launched with `--use-fake-device-for-media-stream` and `--use-file-for-fake-audio-capture=silence.wav` to simulate a microphone streaming silence
- Runs in headed mode (`headless: false`) — headless Chromium does not support AudioWorklet, which causes the Live API audio path to fail and fall back to the text-only Chat API path
- Voice session auto-starts on first gesture; assistant responds with audio + transcription
- User messages are typed via text input (sent through `sendClientContent` on the active Live session)
- Longer timeouts (45s) to accommodate audio transcription latency
- No app code changes required — uses the standard voice path
- Timeout: 600 seconds (10 minutes) to accommodate both sessions

### 18.6 User Flow Image Tests (Playwright + Gemini)
- Location: `app/tests/other/user-flow-image.spec.ts`
- Config: `playwright.user-flow-image.config.ts`
- Trigger: `npm run test:user-flow-image`
- Tests image/photo attachment flow in text-only mode

---

## 19) Deployment

### 19.1 Firebase Hosting
- Deploy command: `npm run deploy` (from `app/` directory)
- Script: `app/scripts/deploy.mjs` — builds the app and deploys to Firebase Hosting in one step
- Public URL: `https://<project-id>.web.app`
- See `DEPLOYMENT_GUIDE.md` for setup and configuration details

### 19.2 Architecture Documentation
- `doc/architecture.mmd` — Mermaid source for component dependency diagram
- `doc/architecture.html` — Self-contained HTML viewer for the architecture diagram
- `doc/infrastructure.drawio` — draw.io system infrastructure diagram

---

## 20) Future Roadmap (Post-Hackathon)

- Third-party integrations (Google Calendar, Gmail, Notion)
- Push notifications for insights and reminders
- PWA installability
- Multi-device real-time sync
- Wearable integration for passive capture
- Voice-first widget for quick capture
- Shared goals with accountability partners
- Advanced emotional analytics dashboard
- AI-powered life coaching modules
