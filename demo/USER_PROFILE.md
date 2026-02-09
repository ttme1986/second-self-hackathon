# Demo User Profile: Alex Chen

## The Problem We're Demonstrating

Every person alive manages a fragmented inner life: commitments they've made to family, health goals they're slowly abandoning, work promises that contradict each other, emotional patterns they can't see from the inside. No app solves this because:

- **Productivity tools require manual input** — they create more work, not less
- **Note-taking apps store information but don't *understand* it** — they can't detect contradictions, connect patterns, or take action
- **Therapists and coaches see you once a week** — they don't have the full picture of your daily life
- **Your own memory is unreliable** — you forget what you said last Tuesday, let alone how it contradicts what you said two weeks ago

Second-Self solves this by *listening to your life and acting on it*. The demo persona, Alex Chen, is designed to prove this through story arcs that showcase every AI capability while demonstrating impact that resonates with *any* judge — because everyone has commitments slipping through the cracks, health patterns they can't see, and promises they've broken without realizing it.

### Why Alex Resonates Broadly

Alex isn't special. Alex is *everyone*:

| Alex's Situation | Universal Version | Who Relates |
|---|---|---|
| Says "work-life balance is fine" then works until midnight | Self-deception about burnout | Every knowledge worker |
| Hasn't visited Mom in 2 months despite promising to | Letting family relationships slip | Anyone with aging parents |
| Doctor flags high blood pressure linked to stress pattern | Health consequences of lifestyle choices you can't see | 200M+ adults with unmanaged hypertension |
| Promised partner a trip but hasn't booked anything | Commitments that slowly die through inaction | Anyone in a relationship |
| Sets a fitness goal every January, usually abandons by March | Goal decay from lack of accountability | ~80% of New Year's resolution makers |

---

## Killer Demo Moments

These are the 4 moments designed to make a judge stop and think *"I want this."* Each moment showcases a capability that no existing app can replicate.

### Moment 1: The Health Warning No App Could Give
**Judging criteria**: Innovation / Wow Factor + Potential Impact

Over 3 weeks, across 5 separate conversations, Alex casually mentions: feeling stressed about work (Jan 15) → working until midnight (Jan 19) → sleeping poorly (Jan 19) → snapping at a colleague (Jan 22) → doctor flagging elevated blood pressure (Jan 25).

Alex never connects these. **Second-Self does.**

Hub insight: *"Your stress mentions have increased 3x over the past 3 weeks. You've averaged 5.5 hours of sleep on nights you work past 8pm. Your doctor flagged elevated blood pressure on Jan 25. Consider setting a hard stop at 7pm this week."*

**Why this matters**: This insight synthesizes 5 data points from 5 conversations spanning 3 weeks. No human remembers all of this. No note app connects it. No health app has the conversational context. This is what multi-model AI orchestration makes possible — and it could genuinely prevent a health crisis.

### Moment 2: The Contradiction You Didn't Know You Made
**Judging criteria**: Innovation / Wow Factor + Technical Execution

On January 8, Alex says *"I'm making real progress on work-life balance."*
On January 19, Alex says *"I worked until midnight three nights this week."*

Second-Self's ValidatorAgent embeds both claims (Gemini Embeddings), finds them in the 0.7-0.9 similarity range, and escalates to Gemini 3 Flash with **HIGH thinking mode** for nuanced conflict analysis. The Review Queue shows both statements side by side with evidence links.

**Why this matters**: People contradict themselves constantly without realizing it. Detecting this requires semantic understanding (embeddings), threshold-based routing, and high-depth reasoning (thinking mode) — a genuine multi-model pipeline, not a wrapper around a chat API.

### Moment 3: The Proactive Memory That Feels Like Magic
**Judging criteria**: Innovation / Wow Factor + Presentation

On January 10, Alex mentions wanting to propose to Jamie in Barcelona. On January 24, Alex celebrates a 150-day Duolingo streak and says "I want to be able to propose in Spanish."

The Hub surfaces: *"You first mentioned proposing on January 10. Your Spain trip is in 5 months. Ring research is still pending. Your italki lesson is tomorrow — consider practicing proposal phrases."*

**Why this matters**: The system connected a private admission from 2 weeks ago, an unrelated language learning milestone, a pending action, and a scheduled lesson into a single coherent suggestion. This is rolling memory + knowledge graph + proactive intelligence working together.

### Moment 4: The Photo That Updates Your Goals
**Judging criteria**: Technical Execution (Agentic Vision + Code Execution)

Alex shares a photo of a handwritten training plan. Gemini 3 Flash with **code execution tool** and **MEDIUM thinking mode** analyzes the image, extracts the weekly schedule (Mon: easy 5K, Wed: intervals, Sat: long run), and structures it into goal milestones that appear as checkable items in the Goals tab.

Later, Alex shares a photo of a blood pressure monitor display. Gemini extracts "142/91" via code execution, flags it as Stage 1 hypertension, and links it to the stress pattern from the Work Stress arc.

**Why this matters**: This isn't just OCR — it's agentic vision. The model reasons about what it sees (Think), writes code to extract structured data (Act), and connects it to existing knowledge (Observe). Two completely different image types, same intelligent pipeline.

---

## Demo Walkthrough Script (3 minutes)

> Optimized for the judges' scoring rubric. Each segment targets a specific criterion.

### 0:00-0:30 — Hub: "It Already Knows You" (Impact + Wow)

Open app. Hub greets: *"Good evening, Alex. You have 3 actions due today. Your stress levels have been elevated — your doctor mentioned blood pressure last week. Maya's birthday is in 5 days."*

**Judge takeaway**: Zero manual data entry. The AI built this picture entirely from voice conversations. *This is what "autonomous life operating system" means.*

### 0:30-1:15 — Reflect: "It Remembers Everything" (Technical + Wow)

Tap Reflect > **About Me**: 20+ claims organized by category. Tap evidence on *"Planning to propose to Jamie in Barcelona"* — shows exact quote with timestamp. Tap the **Review Queue** badge: *"Work-life balance"* conflict showing both contradictory statements with evidence.

Tap **Commitments > Goals**: Half-marathon at 55%, milestones checked off. Spanish at 40%. Tap **Actions**: 10 pending actions by urgency — overdue dentist, today's recovery run, this week's Maya birthday gift.

**Judge takeaway**: Structured knowledge graph with evidence trails, conflict detection, goal tracking, and autonomous action generation — all extracted from natural conversation.

### 1:15-2:15 — Chat: "Watch It Think" (Technical — Live API + Real-time Pipeline)

Start voice session. Speak naturally: *"Hey, I just got back from a run. Did 12K today — new personal best! Felt amazing. Oh, I also need to book a restaurant for Jamie's birthday dinner next Friday."*

**What happens in real-time while the judge watches**:
- Gemini Live API responds conversationally via bidirectional audio
- Claim card appears: *"Completed 12K run"* — with "Why?" evidence link
- Action card slides in: *"Book restaurant for Jamie's birthday dinner"* — with approve/dismiss
- Emotional state indicator updates to joy

**Judge takeaway**: This is NOT a post-conversation summary. Claims and actions are extracted *during* the conversation by a parallel agent pipeline. The user sees their life being understood in real-time.

### 2:15-2:45 — Recap: "Nothing Gets Lost" (Technical + Impact)

Tap end. Recap modal shows:
- AI-generated summary with emotional arc
- 2 claims extracted (with expandable evidence)
- 1 action confirmed, 1 suggested
- Emotional summary: joy, stable arc
- "Dismiss" an action → it moves to "Dismissed (recoverable)" — nothing is permanently lost

**Judge takeaway**: Deferred Firestore commit pattern — all data writes batch at recap close. The user has final control before anything persists.

### 2:45-3:00 — Hub Refresh: "Instant Integration" (Wow)

Navigate to Hub. Daily focus now includes: *"12K milestone achieved! Next up: 15K. You're 2 weeks ahead of your training plan."*

**Judge takeaway**: The live conversation immediately integrated into the knowledge graph and updated all downstream surfaces (Hub, Reflect, Goals). Three Gemini models collaborated in real-time: Live API for voice, Flash for extraction, Embeddings for deduplication.

---

## Story Arcs (Ordered by Wow Factor)

### Arc 1: Work Stress → Health Wake-Up Call (Weeks 2-4)
*Conflict Detection + Wellness Intelligence + Emotional Trends + Thinking Modes*

**The strongest arc.** This is what no other app can do.

| Date | Conv | What Alex Says | AI Response |
|---|---|---|---|
| Jan 8 | conv-003 | "I'm making progress on work-life balance" | Claim extracted, calm emotion |
| Jan 15 | conv-006 | "Dashboard launch is under control, I've got this" | Stress emotion detected (contradicts calm), claim stored |
| Jan 19 | conv-009 | "Worked until midnight three nights in a row. Jamie's upset." | HIGH stress + sadness. **CONFLICT detected** with "under control" claim. Sleep deprivation noted. |
| Jan 22 | conv-011 | "I snapped at a junior engineer in standup today. I feel terrible." | Anger + guilt. Claim: "Lost temper with team member." Wellness pattern emerging. |
| Jan 25 | conv-012 | Shares **photo of blood pressure reading** — 142/91 | Fear emotion. **Agentic vision** extracts numbers. Stage 1 hypertension flag. **Unified wellness insight** connecting all 5 conversations. |

**Hub insight**: *"Your stress mentions have increased 3x over the past 3 weeks. You've averaged 5.5 hours of sleep on work-late nights. You lost your temper on Jan 22 — something you said you'd never do. Your doctor flagged elevated blood pressure on Jan 25. Consider: set a hard stop at 7pm, delegate the dashboard QA to your team lead, and schedule a recovery day this weekend."*

**Review Queue**:
- HIGH: "Making progress on work-life balance" vs "Worked until midnight three nights"
- HIGH: "Dashboard launch is under control" vs "I don't think we'll make the February deadline"
- MEDIUM: "Cutting back to one cup a day" vs "On my third espresso and it's only 2pm"

### Arc 2: The Proposal Plan (Weeks 1-3)
*Cross-Session Memory + Autonomous Actions + Google Search + URL Context*

| Date | Conv | What Alex Says | AI Response |
|---|---|---|---|
| Jan 3 | conv-002 | "Jamie and I are planning a Spain trip for June, can't wait" | Claims: partner Jamie, Spain trip June. Action: "Research Barcelona neighborhoods" |
| Jan 10 | conv-005 | "I think I want to propose to Jamie in Barcelona. Four years together. Feels right." | High-confidence claim (joy + nervousness). Action: "Research engagement rings" — draft uses **Google Search** for ring guides |
| Jan 17 | conv-007 | "I've been looking at rooftop restaurants in Barcelona for the proposal" | **Memory**: references Jan 10 proposal mention. Action: "Book restaurant" — draft uses **Google Search** for "best rooftop restaurants Barcelona" + **URL Context** to read a review page |
| Jan 24 | conv-010 | "Hit 150-day Duolingo streak! I want to be able to propose in Spanish" | **Memory**: "You first mentioned proposing on Jan 10." Milestone completion. Action: "Book italki lesson for proposal phrases" |

**Hub proactive insight**: *"Your Spain trip is in 5 months. Ring research is still pending. Your italki lesson is tomorrow — consider practicing proposal phrases. Hotel comparison from Jan 17 is saved in your attachments."*

### Arc 3: Running Progress (Weeks 1-4)
*Goal Tracking + Milestones + Agentic Vision + AI Coaching*

| Date | Conv | What Alex Says | AI Response |
|---|---|---|---|
| Jan 2 | conv-001 | "This year I'm running a half-marathon. No excuses." | Goal created: half-marathon, target April 15 |
| Jan 7 | conv-004 | "Just did my first 5K without stopping!" Shares **photo of handwritten training plan** | Milestone checked. **Agentic vision**: code execution extracts weekly schedule → structured milestones. Joy emotion. |
| Jan 14 | conv-008 | "Knee's been hurting. Worried I'll have to stop training." | Fear/concern emotion. AI coaching: "Rest days are part of training. Consider: easy walk tomorrow, ice tonight." |
| Jan 19 | conv-008b | "Ran 10K today! Knee held up, personal best!" | Joy + surprise. Milestone checked. Insight: "You're 2 weeks ahead of your training plan!" |
| Jan 28 | conv-013 | Shares **screenshot of Strava monthly stats** | **Agentic vision**: extracts total miles (68), avg pace (5:45/km), longest run (10.2K) → goal progress update |

**Cross-session insight**: *"You ran 12% faster on days after 7+ hours of sleep. Your best runs were on mornings after you stopped working before 7pm."* (Connects running data with sleep/work data from Arc 1.)

### Arc 4: Family Reconnection (Weeks 2-4)
*Proactive Reminders + Memory Surfacing + Emotional Sensitivity*

| Date | Conv | What Alex Says | AI Response |
|---|---|---|---|
| Jan 12 | conv-005b | "I haven't seen Mom in 2 months. Dad's anniversary is coming up. I feel guilty." | Sadness emotion. Actions: "Visit Mom in Sacramento", "Send flowers for Dad's anniversary" |
| Jan 16 | conv-006b | "Maya's birthday is February 3rd, need to get her something" | Claim: Maya birthday Feb 3. Action: "Send birthday gift to Maya" — draft uses **Google Search** for gift ideas |
| Jan 26 | conv-012b | "Mom called. She's having minor surgery next month. I need to be there." | Surprise + concern. "Visit Mom" action escalated to urgent. |

**Hub insight**: *"Maya's birthday is in 5 days — you haven't ordered a gift yet. Mom's surgery is in 3 weeks. You have 3 family commitments this month. Consider blocking a Sacramento weekend."*

### Arc 5: Spanish Learning (Weekly)
*Goal Milestones + Streak Tracking + Semantic Deduplication*

| Date | Conv | What Alex Says | AI Response |
|---|---|---|---|
| Jan 3 | conv-002 | "Learning Spanish for the Spain trip" | Claim linked to Spanish goal |
| Jan 10 | conv-005 | "140-day Duolingo streak but getting bored with the app" | Claim update (streak count), emotional dip. Semantic dedup merges with existing Spanish claim. |
| Jan 24 | conv-010 | "150-day streak! Ready for real conversation practice" | Milestone completion. Action: "Book italki lesson" |

---

## Feature-to-Arc Coverage Map

Every Gemini integration point is demonstrated by at least one arc.

| Gemini Feature | Arc | Evidence |
|---|---|---|
| **Live API** (bidiGenerateContent) | Live demo (Chat) | Real-time voice conversation |
| **Native Audio Model** | Live demo (Chat) | Bidirectional audio with Kore voice |
| **Server-side Transcription** | Live demo (Chat) | User + assistant text appears during call |
| **Structured JSON Output** | All arcs | Every claim/action extraction |
| **Thinking Mode HIGH** | Arc 1 (Wake-Up Call) | Conflict detection reasoning |
| **Thinking Mode MEDIUM** | Arc 3 (Running) | Agentic vision photo analysis |
| **Thinking Mode LOW** | All arcs | Memory consolidation at session end |
| **Streaming Responses** | Live demo (text fallback) | Text-only chat when mic unavailable |
| **Text Embeddings** | Arc 1, 5 | Semantic dedup, conflict similarity routing |
| **Code Execution Tool** | Arc 1, 3 | Blood pressure extraction, training plan parsing, Strava stats |
| **Google Search Tool** | Arc 2, 4 | Ring research, restaurant search, gift ideas |
| **URL Context Tool** | Arc 2 | Barcelona restaurant review page |
| **Context Caching** | All arcs | usageMetadata tracking in console |

---

## Conflict Detection Scenarios

| Conflict | Statement A | Statement B | Severity | Thinking Mode |
|---|---|---|---|---|
| Work-life balance | "I'm making progress on work-life balance" (Jan 8) | "Worked until midnight three nights this week" (Jan 19) | **High** | HIGH |
| Dashboard confidence | "Dashboard launch is under control" (Jan 15) | "I don't think we'll make the February deadline" (Jan 22) | **High** | HIGH |
| Coffee consumption | "Cutting back to one cup a day" (Jan 8) | "On my third espresso and it's only 2pm" (Jan 15) | **Medium** | HIGH |
| Exercise schedule | "I'm a morning runner, always before 7am" (Jan 7) | "Had a great evening run along the Embarcadero" (Jan 19) | **Low** | HIGH |

---

## Emotional Arc Across the Month

```
Week 1:  joy ████████░░  calm ██████░░░░  (New Year optimism, goal setting)
Week 2:  joy ████░░░░░░  stress ████████░░  sadness ████░░░░░░  (Work pressure, family guilt)
Week 3:  stress ██████████  anger ████░░░░░░  fear ████░░░░░░  (Burnout peak, snapped at colleague, doctor visit)
Week 4:  calm ██████░░░░  joy ████████░░  surprise ████░░░░░░  (Recovery, milestones, wake-up call working)
```

V-shaped recovery arc insight: *"After a difficult stretch in mid-January, your mood has been improving. The boundaries you set after your doctor visit seem to be helping."*

All 8 emotion categories are represented: joy, sadness, anger, fear, surprise, neutral, stress, calm.

---

## Cross-Session Intelligence (Dot-Connecting)

These insights connect data points that Alex never explicitly linked — the core capability that no other app offers.

1. **Sleep-Performance Correlation**: Sleep quality (conv-009) + run performance (conv-008, conv-008b) → *"You ran 12% faster on days after 7+ hours of sleep."*

2. **Stress-Health Cascade**: Work hours (conv-006, conv-009) + sleep (conv-009) + temper (conv-011) + blood pressure (conv-012) → unified wellness alert across 4 conversations over 3 weeks

3. **Proposal Timeline**: Proposal intent (conv-005) + ring action + hotel screenshot (conv-007) + Spanish milestone (conv-010) → *"5 months to Spain. Ring research pending. Italki lesson tomorrow."*

4. **Family Pattern**: Mom guilt (conv-005b) + Maya birthday (conv-006b) + Mom surgery (conv-012b) → *"3 family commitments this month. Block a Sacramento weekend."*

---

## Demo Data Specifications

### Conversations: 13 total
- 10 from January (historical), capturing all story arcs
- 2 from "today" (showing recent context for Hub)
- 1 active (for live demo if desired)

### Claims: 20+
- 6 categories: career, relationships, personal, health, learning, preferences
- Mix: 15 confirmed, 4 inferred, 1 rejected
- Pinned: job title, partner name, half-marathon goal, proposal plan, promotion goal

### Goals: 3
1. **Run a half-marathon** — 55% progress, 2/4 milestones, 2 check-ins with AI coaching
2. **Learn conversational Spanish** — 40% progress, 1/4 milestones
3. **Get promoted to Director** — 20% progress, 0/3 milestones (career tracking)

### Actions: 11
- Overdue (1): Dentist appointment (2 months — recurring reminders)
- Due Today (2): Recovery run, Draft email to Mom
- Due This Week (3): Visit Mom, Schedule 12K run, Send Maya birthday gift
- Due This Month (3): Research rings, Book italki lesson, Schedule dentist
- Completed (2): Book hotel for Spain trip, Update training plan

### Review Queue: 4 items
- 2 high severity (work-life balance, dashboard confidence)
- 1 medium (coffee consumption)
- 1 low (exercise schedule)

### Insights: 5+
1. **Wellness alert** (priority 10): Sleep + stress + blood pressure cascade
2. **Goal progress** (priority 8): Running milestones ahead of schedule
3. **Pattern** (priority 7): Sleep-performance correlation
4. **Memory surfacing** (priority 6): Dad's anniversary, Maya's birthday
5. **Upcoming** (priority 5): Spain trip countdown, ring research pending

### Emotional States: Full spectrum across 13 conversations
- Joy: conv-001, conv-002, conv-008b, conv-010, conv-013
- Stress: conv-006, conv-009, conv-011
- Sadness: conv-005, conv-005b
- Fear: conv-008, conv-012
- Anger: conv-011
- Calm: conv-003, conv-013
- Surprise: conv-008b, conv-012b
- Neutral: conv-006b

### Attachments: 5
1. `training-plan.jpg` — handwritten schedule (agentic vision)
2. `barcelona-hotels-screenshot.png` — hotel comparison (agentic vision)
3. `blood-pressure-reading.jpg` — BP monitor display (agentic vision + wellness)
4. `strava-monthly-summary.png` — running stats (agentic vision)
5. `luna-park.jpg` — Luna at the park (image recognition)

---

## Persona Reference

> Compact reference for generating realistic demo conversations and data.

### Alex Chen — Snapshot

| Field | Value |
|---|---|
| Name | Alex Chen |
| Age | 34 |
| Location | San Francisco, CA |
| Job | Senior Product Manager at CloudSync (Series B, ~150 employees) |
| Partner | Jamie (marketing director, together 4 years) |
| Family | Mom in Sacramento (retired teacher), Dad passed 3 years ago, Sister Maya (28, NYC, finance) |
| Pet | Luna, 2-year-old Golden Retriever |
| Education | BS CS from UC Berkeley, MBA from Stanford |

### Personality
- Organized, empathetic, curious learner
- Overcommits, perfectionist, avoids difficult conversations
- Processes thoughts by talking (ideal voice-first user)
- 80% voice / 20% text

### Active Life
- Running: training for April half-marathon (3-4x/week)
- Spanish: Duolingo daily (150+ day streak) + planning italki
- Yoga: 2x/week for stress
- Hiking: weekends with Jamie and Luna

### Health Context
- Sleep: averages 6.5 hours, wants 7.5
- Stress: work-related, escalates around launches
- Lower back pain from desk work
- Coffee: 3 cups/day (trying to reduce)
- Dentist overdue by 2 months
- Doctor flagged elevated blood pressure (Jan 25)

### Work Context
- Dashboard launch: end of February (high pressure)
- Wants Director of Product promotion in 18 months
- Team: 2 designers, 8 engineers, 1 data analyst
- Performance reviews mid-January

### Personal Context
- Considering proposing to Jamie during June Spain trip
- Hasn't visited Mom in 2 months (guilt)
- Dad's anniversary approaching
- Maya's birthday February 3
- Mom having minor surgery next month
- Saving for house down payment

### Communication Examples
These are the kinds of things Alex says naturally during voice sessions:

**Morning commute** (optimistic, planning):
> "Morning! So I was thinking about the dashboard launch... I need to talk to the engineering lead about the timeline. Also, Luna was so funny this morning — she stole Jamie's shoe again."

**Post-meeting dump** (processing, sometimes stressed):
> "Just got out of the product review. VP wants to pull in the launch date by two weeks. I told them it's under control but honestly I'm not sure we can do it without cutting corners."

**Evening wind-down** (reflective, emotional):
> "Long day. I worked until midnight again. Jamie made dinner and I missed it. I keep saying I'll get better at this but... I don't know. Maybe I need to actually set some hard boundaries."

**Goal check-in** (motivated or discouraged):
> "Ran 10K today! Can't believe it. Two months ago I could barely do 3K. The knee held up which was my biggest worry."

**Family moments** (warm, sometimes guilty):
> "Mom called today. She's having surgery next month, nothing major but she sounded worried. I need to get up there. I keep saying 'this weekend' and then something comes up."
