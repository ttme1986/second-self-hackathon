import type { Blackboard } from '../blackboard/Blackboard'
import type { BlackboardTask } from '../blackboard/types'
import { createAction, appendConversationAction } from '../api/backend'

export type ActionSink = (action: { title: string; dueWindow: string; evidence: string[] }) => void

export class ActionPublishAgent {
  private running = false
  private sink: ActionSink

  constructor(sink: ActionSink) {
    this.sink = sink
  }

  start(blackboard: Blackboard) {
    if (this.running) return
    this.running = true

    const loop = async () => {
      while (this.running) {
        const task = blackboard.take(
          (t): t is Extract<BlackboardTask, { type: 'action.validated' | 'action.user_decision' | 'conversation.finalize' }> =>
            t.type === 'action.validated' || t.type === 'action.user_decision' || t.type === 'conversation.finalize',
        )

        if (!task) {
          await new Promise((r) => setTimeout(r, 25))
          continue
        }

        try {
          if (task.type === 'action.validated') {
            // Push to UI immediately during call.
            this.sink({
              title: task.action.title,
              dueWindow: task.action.dueWindow,
              evidence: task.action.evidence,
            })

            // Persist suggested action to localStorage (+ gated Firestore sync).
            const result = await createAction({
              title: task.action.title,
              dueWindow: task.action.dueWindow as 'Today' | 'This Week' | 'This Month' | 'Everything else',
              source: task.action.source,
              reminder: task.action.reminder,
              status: 'suggested',
              conversationId: task.conversationId,
            })
            if (result.data) {
              await appendConversationAction(task.conversationId, result.data.id)
            }

            blackboard.complete(task)
            continue
          }

          if (task.type === 'action.user_decision') {
            // Store decision to localStorage (+ gated Firestore sync).
            await createAction({
              title: task.decision.title,
              dueWindow: task.decision.dueWindow as 'Today' | 'This Week' | 'This Month' | 'Everything else',
              source: 'conversation',
              reminder: false,
              status: task.decision.accepted ? 'approved' : 'dismissed',
              conversationId: task.conversationId,
            })
            blackboard.complete(task)
            continue
          }

          // finalize: nothing to do for now; exists to ensure drain waits.
          blackboard.complete(task)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Action publish failed'
          blackboard.fail(task, message)
        }
      }
    }

    void loop()
  }

  stop() {
    this.running = false
  }
}
