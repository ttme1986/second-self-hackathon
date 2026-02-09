export type Speaker = 'user' | 'assistant'

export type TranscriptTurn = {
  speaker: Speaker
  text: string
  t_ms: number
}

export type ClaimProposed = {
  text: string
  category: string
  confidence: number
  evidence: string[]
}

export type ActionProposed = {
  title: string
  dueWindow: 'Today' | 'This Week' | 'This Month' | 'Everything else'
  source: 'conversation'
  reminder: boolean
  evidence: string[]
}

export type BlackboardTask =
  | {
      id: string
      type: 'turn.ingest'
      conversationId: string
      turn: TranscriptTurn
      createdAt: number
    }
  | {
      id: string
      type: 'claim.proposed'
      conversationId: string
      claim: ClaimProposed
      createdAt: number
    }
  | {
      id: string
      type: 'action.proposed'
      conversationId: string
      action: ActionProposed
      createdAt: number
    }
  | {
      id: string
      type: 'action.validated'
      conversationId: string
      action: ActionProposed
      createdAt: number
    }
  | {
      id: string
      type: 'action.user_decision'
      conversationId: string
      decision: { title: string; dueWindow: string; accepted: boolean }
      createdAt: number
    }
  | {
      id: string
      type: 'conversation.finalize'
      conversationId: string
      createdAt: number
    }

export type BlackboardEvent =
  | { type: 'task.enqueued'; task: BlackboardTask }
  | { type: 'task.started'; task: BlackboardTask }
  | { type: 'task.completed'; task: BlackboardTask }
  | { type: 'task.failed'; task: BlackboardTask; error: string }
