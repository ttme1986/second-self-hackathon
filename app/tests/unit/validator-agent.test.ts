import { describe, expect, it, vi, beforeEach } from 'vitest'

const embedTextMock = vi.fn()
const cosineSimilarityMock = vi.fn()
const listRecentClaimsWithEmbeddingMock = vi.fn()
const upsertClaimForAgentMock = vi.fn()
const appendConversationClaimMock = vi.fn()
const detectConflictMock = vi.fn()
const createReviewQueueMock = vi.fn()
const listActionsMock = vi.fn()

vi.mock('../../src/api/backend', () => ({
  embedText: (...args: unknown[]) => embedTextMock(...args),
  cosineSimilarity: (...args: unknown[]) => cosineSimilarityMock(...args),
  listRecentClaimsWithEmbedding: (...args: unknown[]) => listRecentClaimsWithEmbeddingMock(...args),
  upsertClaimForAgent: (...args: unknown[]) => upsertClaimForAgentMock(...args),
  appendConversationClaim: (...args: unknown[]) => appendConversationClaimMock(...args),
  detectConflict: (...args: unknown[]) => detectConflictMock(...args),
  createReviewQueue: (...args: unknown[]) => createReviewQueueMock(...args),
  listActions: (...args: unknown[]) => listActionsMock(...args),
}))

/** Wait until a condition is true or timeout. */
const waitFor = async (condition: () => boolean, timeoutMs = 5000) => {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) break
    await new Promise((r) => setTimeout(r, 25))
  }
}

describe('ValidatorAgent action validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    embedTextMock.mockResolvedValue([0.1, 0.2, 0.3])
    listActionsMock.mockResolvedValue({ data: { items: [] } })
    detectConflictMock.mockResolvedValue(false)
    createReviewQueueMock.mockResolvedValue({ data: { id: 'review-1' } })
  })

  it('drops action.proposed with cosine >= 0.9 (duplicate)', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { ValidatorAgent } = await import('../../src/agents/ValidatorAgent')

    // Existing action in store
    listActionsMock.mockResolvedValue({
      data: { items: [{ id: 'action-1', title: 'Buy groceries' }] },
    })

    // First embed is for the new action title, second is for the existing action
    embedTextMock
      .mockResolvedValueOnce([1, 0, 0]) // new action
      .mockResolvedValueOnce([1, 0, 0]) // existing action (identical)
    cosineSimilarityMock.mockReturnValue(0.95) // >= 0.9 → duplicate

    const blackboard = new Blackboard()
    const validator = new ValidatorAgent()
    const validatedActions: string[] = []
    blackboard.subscribe((event) => {
      if (event.type === 'task.enqueued' && event.task.type === 'action.validated') {
        validatedActions.push(event.task.action.title)
      }
    })

    validator.start(blackboard)

    blackboard.enqueue({
      type: 'action.proposed',
      conversationId: 'conv-1',
      action: {
        title: 'Buy groceries',
        dueWindow: 'Today',
        source: 'conversation',
        reminder: false,
        evidence: ['Need to buy groceries'],
      },
    })

    // Wait for embedText to be called (means the task was picked up and processed)
    await waitFor(() => embedTextMock.mock.calls.length >= 2)
    // Small extra delay for the complete() call
    await new Promise((r) => setTimeout(r, 50))
    validator.stop()

    // Should NOT enqueue action.validated (duplicate dropped)
    expect(validatedActions).toEqual([])
  })

  it('creates review queue for action with cosine 0.7-0.9 and conflict', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { ValidatorAgent } = await import('../../src/agents/ValidatorAgent')

    listActionsMock.mockResolvedValue({
      data: { items: [{ id: 'action-1', title: 'Buy groceries' }] },
    })

    embedTextMock
      .mockResolvedValueOnce([1, 0, 0])
      .mockResolvedValueOnce([0.9, 0.1, 0])
    cosineSimilarityMock.mockReturnValue(0.8)
    detectConflictMock.mockResolvedValue(true)

    const blackboard = new Blackboard()
    const validator = new ValidatorAgent()
    const validatedActions: string[] = []
    blackboard.subscribe((event) => {
      if (event.type === 'task.enqueued' && event.task.type === 'action.validated') {
        validatedActions.push(event.task.action.title)
      }
    })

    validator.start(blackboard)

    blackboard.enqueue({
      type: 'action.proposed',
      conversationId: 'conv-1',
      action: {
        title: 'Get groceries',
        dueWindow: 'Today',
        source: 'conversation',
        reminder: false,
        evidence: ['get some groceries'],
      },
    })

    await waitFor(() => createReviewQueueMock.mock.calls.length >= 1)
    // Wait for enqueue + complete
    await new Promise((r) => setTimeout(r, 50))
    validator.stop()

    // Should still enqueue action.validated even with conflict
    expect(validatedActions).toEqual(['Get groceries'])
    // Should create a review queue item
    expect(createReviewQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Potential action conflict detected',
        status: 'pending',
        actionIds: ['action-1'],
      }),
    )
  })

  it('enqueues action.validated for new action with cosine < 0.7', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { ValidatorAgent } = await import('../../src/agents/ValidatorAgent')

    listActionsMock.mockResolvedValue({
      data: { items: [{ id: 'action-1', title: 'Buy groceries' }] },
    })

    embedTextMock
      .mockResolvedValueOnce([1, 0, 0])
      .mockResolvedValueOnce([0, 1, 0])
    cosineSimilarityMock.mockReturnValue(0.3) // < 0.7 → new

    const blackboard = new Blackboard()
    const validator = new ValidatorAgent()
    const validatedActions: string[] = []
    blackboard.subscribe((event) => {
      if (event.type === 'task.enqueued' && event.task.type === 'action.validated') {
        validatedActions.push(event.task.action.title)
      }
    })

    validator.start(blackboard)

    blackboard.enqueue({
      type: 'action.proposed',
      conversationId: 'conv-1',
      action: {
        title: 'Schedule dentist appointment',
        dueWindow: 'This Week',
        source: 'conversation',
        reminder: true,
        evidence: ['need to see dentist'],
      },
    })

    await waitFor(() => validatedActions.length >= 1)
    validator.stop()

    // Should enqueue action.validated
    expect(validatedActions).toEqual(['Schedule dentist appointment'])
    // Should NOT create a review queue item
    expect(createReviewQueueMock).not.toHaveBeenCalled()
  })

  it('enqueues action.validated when no existing actions', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { ValidatorAgent } = await import('../../src/agents/ValidatorAgent')

    listActionsMock.mockResolvedValue({ data: { items: [] } })

    const blackboard = new Blackboard()
    const validator = new ValidatorAgent()
    const validatedActions: string[] = []
    blackboard.subscribe((event) => {
      if (event.type === 'task.enqueued' && event.task.type === 'action.validated') {
        validatedActions.push(event.task.action.title)
      }
    })

    validator.start(blackboard)

    blackboard.enqueue({
      type: 'action.proposed',
      conversationId: 'conv-1',
      action: {
        title: 'New action',
        dueWindow: 'Today',
        source: 'conversation',
        reminder: false,
        evidence: ['evidence'],
      },
    })

    await waitFor(() => validatedActions.length >= 1)
    validator.stop()

    expect(validatedActions).toEqual(['New action'])
  })
})
