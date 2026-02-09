/**
 * Demo Data Seeding Utility
 *
 * Creates realistic demo data to showcase all features of the app.
 * Run this before demos to ensure a good starting state.
 */

import {
  createGoal,
  createAction,
  startConversation,
  endConversation,
  updateProfile,
  listGoals,
  listActions,
  listConversations,
} from '../api/backend'

/**
 * Clear all existing data for the demo user
 */
async function clearDemoData(): Promise<void> {
  // Note: In a real implementation, we'd have bulk delete functions
  // For now, we'll just note that data should be cleared manually if needed
  console.log('[Demo Seed] Clearing previous demo data...')
}

/**
 * Create demo user profile
 */
async function seedProfile(): Promise<void> {
  console.log('[Demo Seed] Creating demo profile...')
  await updateProfile({
    displayName: 'Alex',
    geoCapture: true,
    onboardingComplete: true,
    defaultActionPermission: 'draft',
    actionPermissions: {
      email: 'draft',
      calendar: 'draft',
      reminder: 'execute',
      general: 'suggest',
    },
  })
}

/**
 * Create demo goals
 */
async function seedGoals(): Promise<void> {
  console.log('[Demo Seed] Creating demo goals...')

  // Check if goals already exist
  const existing = await listGoals()
  if ((existing.data?.items ?? []).length > 0) {
    console.log('[Demo Seed] Goals already exist, skipping...')
    return
  }

  // Goal 1: Fitness goal at 70% progress
  await createGoal({
    title: 'Run a 5K in under 25 minutes',
    description: 'Improve my running endurance and speed to complete a 5K race in under 25 minutes by spring.',
    category: 'health',
    status: 'active',
    progress: 75,
    targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 60 days from now
    milestones: [
      { id: 'm1', title: 'Complete a 5K without stopping', completed: true },
      { id: 'm2', title: 'Run 5K in under 30 minutes', completed: true },
      { id: 'm3', title: 'Run 5K in under 27 minutes', completed: true },
      { id: 'm4', title: 'Run 5K in under 25 minutes', completed: false },
    ],
  })

  // Goal 2: Learning goal at 40% progress
  await createGoal({
    title: 'Learn conversational Spanish',
    description: 'Achieve conversational proficiency in Spanish for my trip to Spain in summer.',
    category: 'learning',
    status: 'active',
    progress: 40,
    targetDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 120 days from now
    milestones: [
      { id: 'm1', title: 'Complete beginner course', completed: true },
      { id: 'm2', title: 'Learn 500 vocabulary words', completed: true },
      { id: 'm3', title: 'Hold 5-minute conversation', completed: false },
      { id: 'm4', title: 'Watch a Spanish movie without subtitles', completed: false },
      { id: 'm5', title: 'Have 15-minute conversation with native speaker', completed: false },
    ],
  })

  // Goal 3: Career goal at 25% progress
  await createGoal({
    title: 'Get promoted to Senior Engineer',
    description: 'Work toward promotion by taking on leadership responsibilities and completing impactful projects.',
    category: 'career',
    status: 'active',
    progress: 25,
    targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 180 days from now
    milestones: [
      { id: 'm1', title: 'Lead a major project', completed: true },
      { id: 'm2', title: 'Mentor a junior developer', completed: false },
      { id: 'm3', title: 'Complete system design interview prep', completed: false },
      { id: 'm4', title: 'Get positive performance review', completed: false },
    ],
  })
}

/**
 * Create demo actions
 */
async function seedActions(): Promise<void> {
  console.log('[Demo Seed] Creating demo actions...')

  // Check if actions already exist
  const existing = await listActions()
  if ((existing.data?.items ?? []).length > 0) {
    console.log('[Demo Seed] Actions already exist, skipping...')
    return
  }

  // Action 1: Due today
  await createAction({
    title: 'Follow up with Sarah about project timeline',
    context: 'Mentioned in yesterday\'s meeting that deliverables need clarification',
    evidence: ['I need to check with Sarah about when we can expect the design mockups'],
    dueWindow: 'Today',
    source: 'conversation',
    reminder: false,
    status: 'confirmed',
    conversationId: 'demo-conv-1',
    permission: 'draft',
    executionType: 'draft',
    actionType: 'email',
  })

  // Action 2: Due this week with draft
  await createAction({
    title: 'Schedule dentist appointment',
    context: 'Overdue for 6-month checkup',
    dueWindow: 'This Week',
    source: 'conversation',
    reminder: true,
    status: 'approved',
    conversationId: 'demo-conv-2',
    permission: 'draft',
    executionType: 'draft',
    draftContent: 'Draft email to dentist office:\n\nSubject: Appointment Request - Regular Checkup\n\nHi,\n\nI would like to schedule a regular checkup at your earliest convenience. My preferred times are mornings on Tuesday or Thursday.\n\nPlease let me know what slots are available.\n\nBest regards,\nAlex',
    actionType: 'calendar',
  })

  // Action 3: Due this week
  await createAction({
    title: 'Review Spanish vocabulary flashcards',
    context: 'Part of language learning goal',
    dueWindow: 'This Week',
    source: 'system',
    reminder: false,
    status: 'suggested',
    conversationId: 'demo-conv-3',
    permission: 'suggest',
    executionType: 'manual',
    actionType: 'general',
  })

  // Action 4: Completed action
  await createAction({
    title: 'Send birthday message to Mom',
    context: 'Birthday was on Tuesday',
    evidence: ['Mom\'s birthday is coming up this Tuesday'],
    dueWindow: 'Today',
    source: 'conversation',
    reminder: false,
    status: 'done',
    conversationId: 'demo-conv-4',
    permission: 'execute',
    executionType: 'auto',
    executionResult: 'Message sent via iMessage at 9:15 AM',
    actionType: 'general',
  })
}

/**
 * Create demo insights
 * Note: Insights feature has been removed from the app
 */
// async function seedInsights(): Promise<void> {
//   console.log('[Demo Seed] Creating demo insights...')
//   // Insights functionality removed
// }

/**
 * Create demo conversations with summaries
 */
async function seedConversations(): Promise<void> {
  console.log('[Demo Seed] Creating demo conversations...')

  // Check if conversations already exist
  const existing = await listConversations()
  if ((existing.data?.items ?? []).length > 0) {
    console.log('[Demo Seed] Conversations already exist, skipping...')
    return
  }

  // Conversation 1: Work-related (yesterday)
  const conv1Id = `demo-conv-${Date.now()}-1`
  await startConversation(conv1Id)
  await endConversation(conv1Id, [
    { speaker: 'user', text: "Had a productive meeting with the team today. We discussed the new feature roadmap and I volunteered to lead the authentication redesign.", t_ms: Date.now() - 86400000 },
    { speaker: 'assistant', text: "That's great! Taking the lead on authentication sounds like a good opportunity. What's the timeline looking like?", t_ms: Date.now() - 86400000 + 5000 },
    { speaker: 'user', text: "We're targeting end of Q1. I need to follow up with Sarah about the design mockups.", t_ms: Date.now() - 86400000 + 10000 },
  ])

  // Conversation 2: Personal (2 days ago)
  const conv2Id = `demo-conv-${Date.now()}-2`
  await startConversation(conv2Id)
  await endConversation(conv2Id, [
    { speaker: 'user', text: "Went for a run this morning and did my best 5K time yet - 26:30! Getting closer to my goal.", t_ms: Date.now() - 172800000 },
    { speaker: 'assistant', text: "Amazing progress! You're only 1:30 away from your 25-minute goal. How did it feel?", t_ms: Date.now() - 172800000 + 5000 },
    { speaker: 'user', text: "Felt great actually. The interval training is really paying off.", t_ms: Date.now() - 172800000 + 10000 },
  ])

  // Conversation 3: Mixed emotions (3 days ago)
  const conv3Id = `demo-conv-${Date.now()}-3`
  await startConversation(conv3Id)
  await endConversation(conv3Id, [
    { speaker: 'user', text: "Feeling a bit stressed about the upcoming deadline. There's so much to do.", t_ms: Date.now() - 259200000 },
    { speaker: 'assistant', text: "I understand. What's the biggest priority right now?", t_ms: Date.now() - 259200000 + 5000 },
    { speaker: 'user', text: "Probably the API documentation. Once that's done, the team can start integration testing.", t_ms: Date.now() - 259200000 + 10000 },
  ])
}

/**
 * Main seed function - creates all demo data
 */
export async function seedDemoData(): Promise<void> {
  console.log('[Demo Seed] Starting demo data seeding...')

  try {
    await clearDemoData()
    await seedProfile()
    await seedGoals()
    await seedActions()
    // await seedInsights() // Insights feature removed
    await seedConversations()

    console.log('[Demo Seed] Demo data seeding complete!')
  } catch (error) {
    console.error('[Demo Seed] Error seeding demo data:', error)
    throw error
  }
}

/**
 * Quick seed - only adds missing data, doesn't overwrite existing
 */
export async function quickSeedIfNeeded(): Promise<void> {
  const [goals, actions, conversations] = await Promise.all([
    listGoals(),
    listActions(),
    listConversations(),
  ])

  const hasData =
    (goals.data?.items ?? []).length > 0 ||
    (actions.data?.items ?? []).length > 0 ||
    (conversations.data?.items ?? []).length > 0

  if (!hasData) {
    console.log('[Demo Seed] No data found, seeding demo data...')
    await seedDemoData()
  } else {
    console.log('[Demo Seed] Data already exists, skipping seed.')
  }
}

export default seedDemoData
