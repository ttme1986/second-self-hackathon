type ToolId = 'bio' | 'decision' | 'weekly' | 'growth'

type ToolPromptInput = {
  toolId: ToolId
  answers: string[]
  displayName?: string
}

const toolPromptTemplates: Record<ToolId, (answers: string[], displayName: string) => string> = {
  bio: (answers, displayName) => {
    const [role, knownFor] = answers
    return [
      `You are drafting a concise personal bio for ${displayName}.`,
      'Use a confident, warm tone and keep it to 2–5 sentences.',
      `Current role: ${role}.`,
      `Known for: ${knownFor}.`,
      'Return only the bio text.',
    ].join(' ')
  },
  decision: (answers, displayName) => {
    const [decision, constraints] = answers
    return [
      `You are helping ${displayName} make a decision.`,
      `Decision: ${decision}.`,
      `Constraints: ${constraints}.`,
      'Provide a short recommendation and one follow-up question.',
    ].join(' ')
  },
  weekly: (answers, displayName) => {
    const [week, focus] = answers
    return [
      `Summarize the week for ${displayName}.`,
      `Week to summarize: ${week}.`,
      `Focus areas: ${focus}.`,
      'Return a short highlight paragraph and 3 bullet takeaways.',
    ].join(' ')
  },
  growth: (answers, displayName) => {
    const [outcome, blocker] = answers
    return [
      `Create a 30-day growth plan for ${displayName}.`,
      `Desired outcome: ${outcome}.`,
      `Biggest blocker: ${blocker}.`,
      'Return 3 concrete steps and one accountability reminder.',
    ].join(' ')
  },
}

const DEFAULT_ANSWER = 'Not provided'

const normalizeAnswers = (answers: string[], expected: number) => {
  const trimmed = answers.map((answer) => answer?.trim() || DEFAULT_ANSWER)
  while (trimmed.length < expected) {
    trimmed.push(DEFAULT_ANSWER)
  }
  return trimmed.slice(0, expected)
}

export const buildToolPrompt = ({ toolId, answers, displayName }: ToolPromptInput) => {
  const formatter = toolPromptTemplates[toolId]
  if (!formatter) {
    throw new Error(`Unknown tool: ${toolId}`)
  }

  const name = displayName?.trim() || 'the user'
  const normalized = normalizeAnswers(answers, 2)
  return formatter(normalized, name)
}

export type { ToolId, ToolPromptInput }
