import type { Blackboard } from '../blackboard/Blackboard'
import type { BlackboardTask } from '../blackboard/types'
import {
  appendConversationClaim,
  cosineSimilarity,
  createReviewQueue,
  detectConflict,
  embedText,
  listActions,
  listRecentClaimsWithEmbedding,
  upsertClaimForAgent,
} from '../api/backend'

export class ValidatorAgent {
  private running = false
  private onStoredClaim?: (claim: {
    id: string
    text: string
    category: string
    confidence: number
    evidence: string[]
    status: 'inferred' | 'confirmed' | 'rejected'
    conversationId: string
  }) => void

  constructor(
    onStoredClaim?: (claim: {
      id: string
      text: string
      category: string
      confidence: number
      evidence: string[]
      status: 'inferred' | 'confirmed' | 'rejected'
      conversationId: string
    }) => void,
  ) {
    this.onStoredClaim = onStoredClaim
  }

  start(blackboard: Blackboard) {
    if (this.running) return
    this.running = true

    const loop = async () => {
      while (this.running) {
        const task = blackboard.take(
          (t): t is Extract<BlackboardTask, { type: 'claim.proposed' | 'action.proposed' }> =>
            t.type === 'claim.proposed' || t.type === 'action.proposed',
        )
        if (!task) {
          await new Promise((r) => setTimeout(r, 25))
          continue
        }

        try {
          if (task.type === 'action.proposed') {
            await this.validateAction(blackboard, task)
            continue
          }

          const text = task.claim.text.trim()
          const embedding = await embedText(text, 'gemini-embedding-001')

          const existingRes = await listRecentClaimsWithEmbedding(25)
          const existing = existingRes.data?.items ?? []
          let best: (typeof existing)[number] | null = null
          let bestScore = 0
          for (const c of existing) {
            const score = cosineSimilarity(embedding, c.embedding ?? [])
            if (score > bestScore) {
              bestScore = score
              best = c
            }
          }

          if (best && bestScore >= 0.9) {
            const updatedConfidence = Math.min(1.0, Number(best.confidence ?? 0.5) + 0.05)
            const mergedEvidence = Array.from(new Set([...(best.evidence ?? []), ...(task.claim.evidence ?? [])]))
            const upserted = await upsertClaimForAgent({
              id: best.id,
              text: best.text,
              category: best.category,
              confidence: updatedConfidence,
              evidence: mergedEvidence,
              status: best.status ?? 'inferred',
              conversationId: task.conversationId,
              embedding: best.embedding ?? embedding,
            })
            const claimId = upserted.data?.id ?? best.id
            await appendConversationClaim(task.conversationId, claimId)
            this.onStoredClaim?.({
              id: claimId,
              text,
              category: task.claim.category,
              confidence: updatedConfidence,
              evidence: mergedEvidence,
              status: (best.status ?? 'inferred') as 'inferred' | 'confirmed' | 'rejected',
              conversationId: task.conversationId,
            })
            blackboard.complete(task)
            continue
          }

          let conflict = false
          if (best && bestScore >= 0.7) {
            conflict = await detectConflict(text, best.text ?? '')
          }

          const upserted = await upsertClaimForAgent({
            text,
            category: task.claim.category,
            confidence: task.claim.confidence,
            evidence: task.claim.evidence,
            status: 'inferred',
            conversationId: task.conversationId,
            embedding,
          })
          const claimId = upserted.data?.id
          if (claimId) {
            await appendConversationClaim(task.conversationId, claimId)
          }
          this.onStoredClaim?.({
            id: claimId,
            text,
            category: task.claim.category,
            confidence: task.claim.confidence,
            evidence: task.claim.evidence,
            status: 'inferred',
            conversationId: task.conversationId,
          })

          if (conflict && best?.id && claimId) {
            const score = bestScore
            const severity = score >= 0.85 ? 'high' : score >= 0.75 ? 'medium' : 'low'
            await createReviewQueue({
              title: 'Potential conflict detected',
              summary: `Possible inconsistency between '${best.text ?? ''}' and '${text}'.`,
              claimIds: [best.id, claimId],
              conversationId: task.conversationId,
              status: 'pending',
              severity,
            })
          }

          blackboard.complete(task)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Validate failed'
          blackboard.fail(task, message)
        }
      }
    }

    void loop()
  }

  private async validateAction(
    blackboard: Blackboard,
    task: Extract<BlackboardTask, { type: 'action.proposed' }>,
  ) {
    const title = task.action.title.trim()
    const embedding = await embedText(title, 'gemini-embedding-001')

    // Compare against existing actions (limit to most recent 25)
    const existingRes = await listActions()
    const existing = (existingRes.data?.items ?? []).slice(0, 25)

    let best: (typeof existing)[number] | null = null
    let bestScore = 0
    for (const a of existing) {
      const existingEmbed = await embedText(a.title, 'gemini-embedding-001')
      const score = cosineSimilarity(embedding, existingEmbed)
      if (score > bestScore) {
        bestScore = score
        best = a
      }
    }

    // >= 0.9: duplicate — skip (don't publish)
    if (best && bestScore >= 0.9) {
      blackboard.complete(task)
      return
    }

    // 0.7-0.9: potential conflict — check with LLM
    if (best && bestScore >= 0.7) {
      const conflict = await detectConflict(title, best.title)
      if (conflict) {
        await createReviewQueue({
          title: 'Potential action conflict detected',
          summary: `Possible duplicate between '${best.title}' and '${title}'.`,
          actionIds: [best.id],
          conversationId: task.conversationId,
          status: 'pending',
          severity: bestScore >= 0.85 ? 'high' : bestScore >= 0.75 ? 'medium' : 'low',
        })
      }
    }

    // New or non-duplicate — enqueue as action.validated
    blackboard.enqueue({
      type: 'action.validated',
      conversationId: task.conversationId,
      action: task.action,
    })

    blackboard.complete(task)
  }

  stop() {
    this.running = false
  }
}
