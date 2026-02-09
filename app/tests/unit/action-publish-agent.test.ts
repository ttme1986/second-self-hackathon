import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/backend', () => ({
  createAction: vi.fn().mockResolvedValue({ data: { id: 'action-id-1', action: {} } }),
  appendConversationAction: vi.fn().mockResolvedValue({ data: { updated: true } }),
}))

describe('ActionPublishAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('processes action.validated tasks using backend.ts functions', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { ActionPublishAgent } = await import('../../src/agents/ActionPublishAgent')
    const { createAction, appendConversationAction } = await import('../../src/api/backend')

    const sinkCalls: Array<{ title: string; dueWindow: string }> = []
    const sink = (action: { title: string; dueWindow: string; evidence: string[] }) => {
      sinkCalls.push({ title: action.title, dueWindow: action.dueWindow })
    }

    const blackboard = new Blackboard()
    const agent = new ActionPublishAgent(sink)
    agent.start(blackboard)

    // Enqueue action.validated (should be processed)
    blackboard.enqueue({
      type: 'action.validated',
      conversationId: 'conv-1',
      action: {
        title: 'Validated action',
        dueWindow: 'Today',
        source: 'conversation',
        reminder: false,
        evidence: ['evidence'],
      },
    })

    await blackboard.drain(5000)
    agent.stop()

    expect(sinkCalls).toEqual([{ title: 'Validated action', dueWindow: 'Today' }])
    // Verify it called backend.ts createAction (not firestoreStore upsertAction)
    expect(vi.mocked(createAction)).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Validated action',
        status: 'suggested',
        conversationId: 'conv-1',
      }),
    )
    // Verify it called backend.ts appendConversationAction
    expect(vi.mocked(appendConversationAction)).toHaveBeenCalledWith('conv-1', 'action-id-1')
  })

  it('ignores action.proposed tasks', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { ActionPublishAgent } = await import('../../src/agents/ActionPublishAgent')

    const sinkCalls: Array<{ title: string }> = []
    const sink = (action: { title: string; dueWindow: string; evidence: string[] }) => {
      sinkCalls.push({ title: action.title })
    }

    const blackboard = new Blackboard()
    const agent = new ActionPublishAgent(sink)
    agent.start(blackboard)

    // Enqueue action.proposed (should NOT be processed by ActionPublishAgent)
    blackboard.enqueue({
      type: 'action.proposed',
      conversationId: 'conv-1',
      action: {
        title: 'Proposed action',
        dueWindow: 'Today',
        source: 'conversation',
        reminder: false,
        evidence: ['evidence'],
      },
    })

    // Give the agent time to poll (it should not find this task)
    await new Promise((r) => setTimeout(r, 100))
    agent.stop()

    // action.proposed should not be processed
    expect(sinkCalls).toEqual([])
    // The task should still be in the queue (pending)
    expect(blackboard.pendingCount).toBe(1)
  })

  it('processes action.user_decision tasks using backend.ts createAction', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { ActionPublishAgent } = await import('../../src/agents/ActionPublishAgent')
    const { createAction } = await import('../../src/api/backend')

    const sinkCalls: Array<{ title: string }> = []
    const sink = (action: { title: string; dueWindow: string; evidence: string[] }) => {
      sinkCalls.push({ title: action.title })
    }

    const blackboard = new Blackboard()
    const agent = new ActionPublishAgent(sink)
    agent.start(blackboard)

    blackboard.enqueue({
      type: 'action.user_decision',
      conversationId: 'conv-2',
      decision: {
        title: 'User decided action',
        dueWindow: 'This Week',
        accepted: true,
      },
    })

    await blackboard.drain(5000)
    agent.stop()

    // User decisions don't go through sink
    expect(sinkCalls).toEqual([])
    // But they are persisted via backend.ts createAction
    expect(vi.mocked(createAction)).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'User decided action',
        status: 'approved',
        conversationId: 'conv-2',
      }),
    )
  })
})
