import type { Blackboard } from '../blackboard/Blackboard'
import type { BlackboardTask, TranscriptTurn, ActionProposed } from '../blackboard/types'
import { extractClaimsAndActions } from '../api/backend'

export class AnalyzerAgent {
  private running = false
  private thoughtSignatures: string | undefined
  private extractedClaims = new Set<string>()
  private extractedActions = new Set<string>()

  start(blackboard: Blackboard) {
    if (this.running) return
    this.running = true

    const loop = async () => {
      while (this.running) {
        const task = blackboard.take((t): t is Extract<BlackboardTask, { type: 'turn.ingest' }> => t.type === 'turn.ingest')
        if (!task) {
          // idle
          await new Promise((r) => setTimeout(r, 25))
          continue
        }

        try {
          const turn: TranscriptTurn = task.turn

          // Only extract knowledge from user statements — assistant responses
          // are context for the LLM but not a source of claims or actions.
          if (turn.speaker !== 'user') {
            blackboard.complete(task)
            continue
          }

          const { claims, actions, thoughtSignatures } = await extractClaimsAndActions(
            turn,
            this.thoughtSignatures,
            {
              claims: Array.from(this.extractedClaims),
              actions: Array.from(this.extractedActions),
            },
          )
          this.thoughtSignatures = thoughtSignatures

          const normalizeDue = (value: unknown): ActionProposed['dueWindow'] => {
            if (value === 'Today' || value === 'This Week' || value === 'This Month' || value === 'Everything else') {
              return value
            }
            return 'Everything else'
          }

          for (const rawAction of actions) {
            const title = typeof rawAction?.title === 'string' ? rawAction.title.trim() : ''
            if (!title) continue
            const actionKey = title.toLowerCase()
            if (this.extractedActions.has(actionKey)) continue
            this.extractedActions.add(actionKey)
            const dueWindow = normalizeDue(rawAction?.dueWindow)
            blackboard.enqueue({
              type: 'action.proposed',
              conversationId: task.conversationId,
              action: {
                title,
                dueWindow,
                source: 'conversation',
                reminder: Boolean(rawAction?.reminder),
                evidence: [turn.text],
              },
            })
          }

          for (const rawClaim of claims) {
            const text = (rawClaim?.text ?? '').trim()
            if (!text) continue
            const claimKey = text.toLowerCase()
            if (this.extractedClaims.has(claimKey)) continue
            this.extractedClaims.add(claimKey)
            const category = rawClaim?.category ?? 'other'
            const confidence = Number(rawClaim?.confidence ?? 0.5)
            const evidence = Array.isArray(rawClaim?.evidence)
              ? rawClaim.evidence.filter((item: unknown): item is string => typeof item === 'string')
              : typeof rawClaim?.evidence === 'string'
                ? [rawClaim.evidence]
                : []

            blackboard.enqueue({
              type: 'claim.proposed',
              conversationId: task.conversationId,
              claim: { text, category, confidence, evidence },
            })
          }

          blackboard.complete(task)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Analyze failed'
          blackboard.fail(task, message)
        }
      }
    }

    void loop()
  }

  stop() {
    this.running = false
    this.thoughtSignatures = undefined
    this.extractedClaims.clear()
    this.extractedActions.clear()
  }
}
