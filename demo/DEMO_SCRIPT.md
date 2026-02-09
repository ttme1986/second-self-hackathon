# Second-Self Demo Video Script (~3:18)

> **Format**: Voiceover narration + screen recording of the live app.
> Timestamps are approximate. Each section includes narration, screen actions, and on-screen callouts.
> The demo uses the pre-populated demo account (Alex Chen) with a live 5-turn voice conversation and one live photo attachment.
> **All narration is pre-generated at startup** — no runtime TTS calls. Feature-focused, no specific data values.

---

## PRE-PRODUCTION NOTES

- **Screen**: Record on mobile viewport (390x844) or use browser DevTools mobile emulation
- **Demo account**: Sign in with "Sign in for Demo" to load Alex Chen's pre-populated data
- **Live segment**: During the Chat section, 5 user turns are typed + spoken via TTS simultaneously — a real Gemini Live API interaction
- **Photo attachment**: Have `demo/attachments/bp-reading.png` saved on the recording device. Screenshot the HTML mock at `demo/attachments/bp-reading.html` if needed.
- **Pacing**: Narration is timed at ~150 words per minute.
- **Audio tracks**: (1) Voiceover narration (pre-generated Chirp 3: HD), (2) App audio (Gemini Live API voice)
- **Pre-generated narration**: The `demo.mjs` script pre-generates ALL narration clips at startup via Gemini TTS. No dynamic/on-the-fly TTS generation during the demo.
- **Demo data**: Two pre-seeded conversations (conv-001 from 1 week ago, conv-002 from yesterday) populate the knowledge graph, actions, goals, and review queue before the demo starts.

---

## ATTACHMENT PREPARATION

Before recording, prepare these files on the recording device:

| File | Source | Purpose |
|------|--------|---------|
| `bp-reading.png` | Screenshot `demo/attachments/bp-reading.html` in a browser | Blood pressure photo for agentic vision demo |

---

## 0:00 – 0:14 | COLD OPEN: The Problem (14s)

### Screen
Black screen. Text fades in line by line, synced to narration.

### Narration (28 words)
> "You said you'd call your mom. You didn't.
> You said work-life balance was improving. You worked until midnight — again.
> What if something could connect all of this?"

### On-Screen Text (fade in/out)
```
"I'll call Mom this weekend."  — You didn't.
"Work-life balance is improving." — Midnight. Again.
What if something could connect all of this?
```

### Transition
Text fades. App opens on Login screen.

---

## 0:14 – 0:24 | SIGN-IN: Zero Backend (10s)

### Screen
Login screen visible. Narration plays over it.

### Narration (36 words)
> "This is Second-Self — an autonomous life operating system. Three Gemini models working together to capture your life through voice, extract knowledge in real time, and record actions and reminders autonomously. Let's now sign in as the Demo User."

### Screen Actions
1. Login screen loads with fonts
2. Narration plays over login screen
3. Tap **"Sign in for Demo"**
4. Hub loads

---

## 0:24 – 0:40 | HUB: Proactive Intelligence (16s)

### Screen
Hub page loads with personalized greeting, daily focus cards, and insights panel.

### Narration (38 words)
> "You start at the Hub — the intelligent dashboard. Gemini 3 generates a personalized daily focus from your life data. Gemini Embeddings connects patterns across weeks of conversations. Wellness alerts, action reminders, insights — all surfaced before you ask."

### Screen Actions
1. Hub loads — show greeting
2. Scroll to **Today's Focus** — show action cards
3. Scroll to **Insights** — pause on wellness alert card
4. Tap to expand — show full insight

### On-Screen Callouts
- **Gemini 3 Flash** — generates daily focus with thinking mode
- **Gemini Embeddings** — semantic search across conversations

---

## 0:40 – 0:48 | CHAT SETUP (8s)

### Screen
Tap **Chat** in bottom navigation. Tap microphone to start a live voice session.

### Narration (9 words)
> "You are about to see three Gemini models working together — live."

### Screen Actions
1. Navigate to /chat
2. Narration plays
3. Tap **microphone** — "Connecting..." then session active
4. AI greeting arrives

---

## 0:48 – 1:00 | CHAT TURN 1: Running Achievement (12s)

### User Message (17 words)
> "Hey! Just got back from a twelve K run — new personal best! The knee held up which was huge."

### Screen Actions
1. TTS speaks user message AND text appears in input simultaneously
2. Message sent to AI
3. AI responds conversationally
4. Claim card appears in knowledge banner (overlay at top)

---

## 1:00 – 1:06 | CHAT TURN 2: Restaurant Booking (6s+)

### User Message (18 words)
> "Thanks! Can you help me book a restaurant for Jamie's birthday dinner next Friday? Something nice, maybe Italian."

### Screen Actions
1. TTS + type simultaneously
2. AI responds
3. **Action card** slides in: restaurant booking
4. **TAP + (approve)** — card confirms with animation

---

## 1:06 – 1:14 | CHAT TURN 3: Gift Reminder (8s)

### User Message (16 words)
> "Perfect. Also remind me to pick up a gift for Maya — her birthday is next week."

### Screen Actions
1. TTS + type simultaneously
2. AI responds
3. **Action card** appears: gift reminder
4. **TAP X (dismiss)** — card slides out (recoverable in Recap)

---

## 1:14 – 1:32 | CHAT TURN 4: Blood Pressure Photo (18s)

### User Message (15 words)
> "One more thing — I got my blood pressure checked today. Let me show you."

### Screen Actions
1. TTS + type simultaneously
2. Upload `bp-reading.png` via file input — centered overlay popup appears
3. Photo uploads — processing indicator shows
4. AI responds: identifies readings, flags hypertension, connects to stress pattern

---

## 1:32 – 1:44 | CHAT TURN 5: Wrap-Up (12s)

### User Message (18 words)
> "That's helpful. I've been stressed lately with work and I know I need to take better care of myself."

### Screen Actions
1. TTS + type simultaneously
2. AI responds with empathetic, connecting themes from the conversation

---

## 1:44 – 2:00 | NARRATOR: Chat Recap (16s)

### Narration (49 words)
> "Notice what happened during the conversation. Gemini 3 extracted knowledge in real time — claims, actions, emotional tone — all structured and linked to evidence. When the photo was shared, agentic vision analyzed the image, extracted the readings, and connected them to weeks of health data. All of this happened live, as the conversation unfolded. Now, let's hang up and review the session recap."

### On-Screen Callouts
- **Gemini 3 Flash** — structured JSON extraction with thinking mode
- **Gemini Embeddings** — deduplication check against existing claims
- **Agentic Vision** — Gemini 3 Flash + code execution

---

## 2:00 – 2:20 | RECAP: Nothing Gets Lost (20s)

### Screen
Tap the red **End Session** button. Recap modal slides up.

### Narration (33 words)
> "Here's the recap. An AI-generated summary with emotional analysis. Every claim is linked to evidence — tap 'Why' to see the receipt. Conflicts flagged automatically. Actions sorted by urgency. Nothing reaches the database until you confirm."

### Screen Actions
1. Tap **End Session** (red button)
2. Recap slides up
3. **AI Summary** — pause to show generated text
4. **Knowledge Inferred** — tap **"Why?"** on a claim — evidence expands
5. **Confirmed Actions** — restaurant booking with check
6. **Suggested Actions** — **TAP + to save** doctor follow-up
7. **Rejected Actions** — **TAP + to recover** Maya's gift
8. Cinematic scroll through all recap content
9. Navigate back to **Hub**

### On-Screen Callouts
- **Gemini 3 Flash** — summary + emotional arc generation
- **Evidence Trails** — every claim links to source quote
- **Deferred Write Pattern** — batch Firestore commit at modal close

---

## 2:20 – 2:28 | HUB → REFLECT: Transition (8s)

### Screen
Hub page loads briefly after Recap. Navigate to Reflect via bottom navigation.

### Narration (14 words)
> "Back at the Hub. Let's head over to Reflect — starting with your conversation history."

### Screen Actions
1. Hub loads — show updated state after conversation
2. Tap **Reflect** in bottom navigation
3. Reflect page loads (Memories tab is default)

---

## 2:28 – 2:38 | REFLECT: Memories (10s)

### Screen
Reflect page loads. Memories tab (default) showing conversation timeline.

### Narration (25 words)
> "Memories — a timeline of every conversation. Each session captured with an AI summary, emotional context, and linked media. Scroll through weeks of interactions, all organized chronologically."

### Screen Actions
1. **Memories** tab (default on Reflect)
2. Slow cinematic scroll through conversation timeline
3. Pause on conversation cards showing summaries and emotional states

---

## 2:38 – 2:48 | REFLECT: About Me (10s)

### Screen
About Me tab.

### Narration (17 words)
> "About Me — a living knowledge graph. Every claim extracted by Gemini 3, organized by category, backed by evidence."

### Screen Actions
1. Tap **About Me** tab
2. Slow cinematic scroll through claim cards grouped by category
3. No interactions — just showcase the knowledge graph

### On-Screen Callouts
- **Evidence Trails** — every claim links to source conversation

---

## 2:48 – 2:58 | REFLECT: Commitments (10s)

### Screen
Commitments tab.

### Narration (15 words)
> "Commitments — goals with milestones, actions sorted by urgency. Nothing gets lost. Everything stays connected."

### Screen Actions
1. Tap **Commitments** tab
2. Slow cinematic scroll through goals with progress bars and actions
3. No interactions — just showcase

### On-Screen Callouts
- **Goal Tracking** — milestones and progress from conversation data

---

## 2:58 – 3:08 | REFLECT: Review Queue (10s)

### Screen
Review Queue tab.

### Narration (23 words)
> "The Review Queue. Gemini Embeddings flagged contradictions — claims that conflict with each other. Users can resolve them to keep their knowledge graph accurate."

### Screen Actions
1. Tap **Review Queue** tab
2. Brief scroll through conflict cards
3. Show the work-life balance contradiction (claim-006 vs claim-012)
4. No interactions — just showcase

### On-Screen Callouts
- **Gemini Embeddings** — cosine similarity for contradiction detection

---

## 3:08 – 3:18 | CLOSE: Three Models, Zero Servers (10s)

### Screen
Full-screen tagline overlay injected on the current page (Review tab). No navigation back to Hub.

### Narration (18 words)
> "Three Gemini models. Twelve integration points. Everything runs in the browser. Second-Self — your life, understood."

### On-Screen Text (fade in)
```
3 Gemini Models  |  12 Integration Points  |  0 Backend Servers

Second-Self
Your life, understood.
```

---

## TIMING SUMMARY

| Segment | Duration | Cumulative | Narration |
|---------|----------|------------|-----------|
| Cold Open | 14s | 0:14 | coldOpen (14s) |
| Sign-In | 10s | 0:24 | signIn (14s) + click |
| Hub | 16s | 0:40 | hub (14s) + scrolling |
| Chat Setup | 8s | 0:48 | chatSetup (5s) + mic connect |
| Chat Turn 1 | 12s | 1:00 | user TTS (6s) + AI response (~6s) |
| Chat Turn 2 | 6s | 1:06 | user TTS (5s) + AI (~5s) + action approve |
| Chat Turn 3 | 8s | 1:14 | user TTS (4s) + AI (~4s) + action dismiss |
| Chat Turn 4 | 18s | 1:32 | user TTS (5s) + photo + AI (~13s) |
| Chat Turn 5 | 12s | 1:44 | user TTS (6s) + AI (~5s) |
| Chat Narration | 16s | 2:00 | chatNarration narrator |
| Recap | 20s | 2:20 | recap (14s) + interactions |
| Hub → Reflect | 8s | 2:28 | hubToReflect (6s) + nav |
| Reflect: Memories | 10s | 2:38 | reflectMemories (8s) + scroll |
| Reflect: About Me | 10s | 2:48 | reflectAboutMe (7s) + scroll |
| Reflect: Commitments | 10s | 2:58 | reflectCommitments (6s) + scroll |
| Reflect: Review Queue | 10s | 3:08 | reflectReview (7s) + scroll |
| Close | 10s | 3:18 | close (8s) + overlay |
| **Total** | **~198s** | **~3:18** | |

---

## DEMO DATA: Pre-Seeded Conversations

Two conversations are pre-seeded before the demo starts to populate the knowledge graph:

### conv-001 (1 week ago — Feb 2, 2026)
**Theme**: Morning check-in. Running progress (8K), yoga, work-life balance ("leaving office by six"), Spain trip planning, proposal idea, family (Mom overdue, Maya birthday tomorrow), Duolingo streak at 142 days.
**Key claim**: "Making real progress on work-life balance — leaving office by six daily"

### conv-002 (1 day ago — Feb 8, 2026)
**Theme**: Evening wind-down. 10K run success, Maya birthday gift received, work stress escalation (midnight twice), Jamie's birthday dinner plans, Mom's surgery news, ring browsing, Duolingo at 148 days.
**Key claim**: "Stayed past midnight twice this week for dashboard launch prep"
**Contradiction**: claim-006 (work-life balance progress) vs claim-012 (midnight dashboard prep) — HIGH severity in Review Queue

### Demo conversation (today — Feb 9, 2026)
**Theme**: Post-run check-in. 12K personal best, restaurant booking for Jamie, Maya gift reminder, blood pressure photo, stress acknowledgment.
**Further contradiction**: When Alex says "I've been stressed lately with work," this reinforces the contradiction with the earlier "making progress on work-life balance" claim.

---

## FEATURE COVERAGE CHECKLIST

| Requirement | Where Shown | Timestamp |
|-------------|-------------|-----------|
| Interesting conversation with ChatAgent | Chat — 5 turns: running, restaurant, gift, BP, stress | 0:48–2:00 |
| Multi-model inputs/attachments | Photo of BP reading analyzed by agentic vision | 1:14–1:32 |
| Real-time action confirmation | Tap + on restaurant action card | 1:00–1:06 |
| Real-time action rejection | Tap X on gift reminder action card | 1:06–1:14 |
| Deferred action decision | Doctor follow-up left untouched during chat | 1:32 |
| Change action status in RECAP | Save suggested action (doctor), recover rejected (gift) | 2:00–2:20 |
| Conflict detection | Pre-seeded in Review Queue + reinforced during demo | 2:58–3:08 |
| Navigate REFLECT: Memories | Conversation timeline with summaries | 2:28–2:38 |
| Navigate REFLECT: About Me | Claims by category, cinematic scroll | 2:38–2:48 |
| Navigate REFLECT: Commitments | Goals with progress, Actions by urgency | 2:48–2:58 |
| Navigate REFLECT: Review Queue | Contradiction cards | 2:58–3:08 |
| Evidence trails ("receipts") | Why? buttons on claims in Recap | 2:00–2:20 |
| Emotional analysis | EmotionArc in Recap | 2:00–2:20 |
| Deferred Firestore writes | Mentioned in Recap narration | 2:00–2:20 |

---

## GEMINI MODEL CALLOUTS

Every Gemini model and feature is explicitly mentioned in narration:

| Gemini Model/Feature | Narration Segment | What's Highlighted |
|----------------------|-------------------|-------------------|
| **Gemini 3 Flash** — daily focus | Hub | Generates daily focus from life data |
| **Gemini Embeddings** — pattern connection | Hub | Connects patterns across weeks of conversations |
| **Gemini 3 Flash** — real-time extraction | Chat Narration | Builds knowledge as conversation happens |
| **Gemini 3 Flash** — agentic vision | Chat Narration | Code execution analyzes image, extracts readings |
| **Gemini 3 Flash** — claims | Reflect: About Me | Every claim extracted by Gemini 3 Flash |
| **Gemini Embeddings** — contradictions | Reflect: Review Queue | Flagged contradictions between statements |

---

## SCORING STRATEGY

### Technical Execution (40%)
- **Live API 5-turn conversation** with real bidirectional audio
- **Real-time extraction pipeline** — claims and actions appear during conversation
- **Agentic vision** — photo analysis with code execution + thinking mode
- **Conflict detection** — embeddings for similarity routing + HIGH thinking for reasoning
- **Deferred Firestore writes** — batch commit pattern shown and explained
- **Three models named** at every integration point
- **Evidence trails** demonstrated with "Why?" buttons

### Potential Impact (20%)
- **Cold open** frames universal problem (everyone forgets commitments)
- **Wellness insight** is the centerpiece — cross-session intelligence
- **Blood pressure connection** — could genuinely prevent a health crisis
- **Stress wrap-up** — connects emotional patterns to health data

### Innovation / Wow Factor (30%)
- **Moment 1 (Hub)**: Cross-session wellness intelligence surfaced proactively
- **Moment 2 (Chat)**: Real-time extraction *during* live 5-turn conversation
- **Moment 3 (Photo)**: Blood pressure analyzed and connected to stress pattern
- **Moment 4 (Reflect)**: Contradiction detection — AI caught what the user missed
- **Moment 5 (Recap)**: Action recovery — nothing is permanently lost

### Presentation (10%)
- Opens with emotional hook, not a feature list
- Every section has a clear judge takeaway
- Gemini models explicitly named in narration
- Features shown through natural 5-turn conversation, not explained abstractly
- Ends with memorable "Three models. Everything in the browser." tagline
- Clean ~3:18 pacing with no dead time
- Reflect pages are scroll-only — no interactions that could break during recording
