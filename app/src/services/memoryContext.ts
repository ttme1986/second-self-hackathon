import {
  listConversations,
  listClaims,
  listActions,
  listGoals,
  getProfile,
  type ConversationSummary,
  type ClaimRecord,
  type ActionRecord,
  type GoalRecord,
  type UserProfile,
} from '../api/backend'

export async function buildMemoryContext(
  displayName: string,
): Promise<{ systemPrompt: string }> {
  const name = displayName || 'there'

  // Load data in parallel — each call may fail independently
  const [convResult, claimResult, actionResult, goalResult, profileResult] = await Promise.all([
    listConversations().catch(() => ({ data: { items: [] as ConversationSummary[] } })),
    listClaims().catch(() => ({ data: { items: [] as ClaimRecord[] } })),
    listActions(['confirmed', 'approved', 'suggested']).catch(() => ({ data: { items: [] as ActionRecord[] } })),
    listGoals('active').catch(() => ({ data: { items: [] as GoalRecord[] } })),
    getProfile().catch(() => ({ data: { profile: null as UserProfile | null } })),
  ])

  // Recent 3 ended conversations with summaries
  const conversations = (convResult.data?.items ?? [])
    .filter((c) => c.status === 'ended' && c.summary)
    .slice(0, 3)

  // All non-rejected claims (capped at 50)
  const claims = (claimResult.data?.items ?? [])
    .filter((c) => c.status !== 'rejected')
    .slice(0, 50)

  // Active actions (capped at 30)
  const actions = (actionResult.data?.items ?? []).slice(0, 30)

  // Active goals (capped at 10)
  const goals = (goalResult.data?.items ?? []).slice(0, 10)

  // Build sections
  const sections: string[] = [
    `You are Second Self, a personal AI life assistant for ${name}.`,
  ]

  // Current date and time
  const now = new Date()
  sections.push(`\n## Current date and time\n${now.toLocaleString()} (${now.toISOString()})`)

  // Memory summary from profile
  const memorySummary = profileResult.data?.profile?.memorySummary ?? ''
  if (memorySummary) {
    sections.push(`\n## Memory summary\n${memorySummary}`)
  }

  // Claims grouped by category
  if (claims.length > 0) {
    const grouped: Record<string, string[]> = {}
    for (const claim of claims) {
      const cat = (claim.category ?? 'other').toLowerCase()
      const key = cat === 'preferences' ? 'Preferences'
        : cat === 'skills' ? 'Skills'
        : cat === 'relationships' ? 'Relationships'
        : 'Other'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(`- ${claim.text}`)
    }
    let claimSection = `\n## What you know about ${name}`
    for (const category of ['Preferences', 'Skills', 'Relationships', 'Other']) {
      if (grouped[category]?.length) {
        claimSection += `\n### ${category}\n${grouped[category].join('\n')}`
      }
    }
    sections.push(claimSection)
  }

  // Recent conversations
  if (conversations.length > 0) {
    const convLines = conversations.map((c) => {
      const date = c.endedAt ? new Date(c.endedAt).toLocaleString() : 'unknown date'
      return `- ${date}: ${c.summary}`
    })
    sections.push(`\n## Recent conversations\n${convLines.join('\n')}`)
  }

  // Outstanding actions
  if (actions.length > 0) {
    const dueToday = actions.filter((a) => a.dueWindow === 'Today')
    const other = actions.filter((a) => a.dueWindow !== 'Today')
    let actionSection = '\n## Outstanding actions'
    if (dueToday.length > 0) {
      actionSection += '\n### Due Today'
      actionSection += '\n' + dueToday.map((a) => `- ${a.title}`).join('\n')
    }
    if (other.length > 0) {
      actionSection += '\n### Other'
      actionSection += '\n' + other.map((a) => `- ${a.title} (${a.dueWindow})`).join('\n')
    }
    sections.push(actionSection)
  }

  // Active goals
  if (goals.length > 0) {
    const goalLines = goals.map((g) => `- ${g.title} (${g.progress ?? 0}% complete)`)
    sections.push(`\n## Active goals\n${goalLines.join('\n')}`)
  }

  // Instructions
  sections.push(`
## Instructions
- Use memory for continuity across sessions.
- Do not re-ask questions already answered in memory unless confirmation is needed.
- Treat memory as potentially stale — accept corrections gracefully.
- Be concise and natural.

## Greeting behavior
When the session starts (first message is "[Session started. Please greet the user.]"):
- Greet the user by name in exactly 1 short sentence. Nothing else.`)

  return { systemPrompt: sections.join('\n') }
}
