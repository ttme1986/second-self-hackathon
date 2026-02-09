import { describe, expect, it, vi, beforeEach } from 'vitest'

// Track extractClaimsAndActions calls to verify thought signature threading
const extractClaimsAndActionsMock = vi.fn()

vi.mock('../../src/api/backend', () => ({
  extractClaimsAndActions: extractClaimsAndActionsMock,
}))

/** Wait until the mock has been called `count` times (or timeout). */
const waitForCalls = async (mock: ReturnType<typeof vi.fn>, count: number, timeoutMs = 5000) => {
  const start = Date.now()
  while (mock.mock.calls.length < count) {
    if (Date.now() - start > timeoutMs) break
    await new Promise((r) => setTimeout(r, 25))
  }
}

describe('AnalyzerAgent thought signature preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes thought signatures from one turn to the next', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { AnalyzerAgent } = await import('../../src/agents/AnalyzerAgent')

    // First call returns a thought signature
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [],
      actions: [],
      thoughtSignatures: 'sig-turn-1',
    })

    // Second call should receive 'sig-turn-1' and return a new signature
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [],
      actions: [],
      thoughtSignatures: 'sig-turn-2',
    })

    // Third call should receive 'sig-turn-2'
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [],
      actions: [],
      thoughtSignatures: 'sig-turn-3',
    })

    const blackboard = new Blackboard()
    const agent = new AnalyzerAgent()
    agent.start(blackboard)

    // Enqueue three turns
    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'Turn 1', t_ms: 1000 },
    })
    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'Turn 2', t_ms: 2000 },
    })
    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'Turn 3', t_ms: 3000 },
    })

    // Wait for all tasks to be processed
    await blackboard.drain(5000)
    agent.stop()

    // Verify call count
    expect(extractClaimsAndActionsMock).toHaveBeenCalledTimes(3)

    // First call: no previous thought signatures
    expect(extractClaimsAndActionsMock.mock.calls[0][1]).toBeUndefined()

    // Second call: receives thought signature from first call
    expect(extractClaimsAndActionsMock.mock.calls[1][1]).toBe('sig-turn-1')

    // Third call: receives thought signature from second call
    expect(extractClaimsAndActionsMock.mock.calls[2][1]).toBe('sig-turn-2')
  })

  it('resets thought signatures on stop', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { AnalyzerAgent } = await import('../../src/agents/AnalyzerAgent')

    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [],
      actions: [],
      thoughtSignatures: 'sig-session-1',
    })

    const blackboard = new Blackboard()
    const agent = new AnalyzerAgent()
    agent.start(blackboard)

    // Process one turn
    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'Hello', t_ms: 1000 },
    })

    await blackboard.drain(5000)
    agent.stop()

    // Now restart the agent and process another turn
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [],
      actions: [],
      thoughtSignatures: 'sig-session-2',
    })

    const blackboard2 = new Blackboard()
    agent.start(blackboard2)

    blackboard2.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-2',
      turn: { speaker: 'user', text: 'Hi again', t_ms: 2000 },
    })

    await blackboard2.drain(5000)
    agent.stop()

    // The second session's first call should NOT have the previous session's signature
    expect(extractClaimsAndActionsMock).toHaveBeenCalledTimes(2)
    expect(extractClaimsAndActionsMock.mock.calls[1][1]).toBeUndefined()
  })

  it('handles undefined thought signatures gracefully', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { AnalyzerAgent } = await import('../../src/agents/AnalyzerAgent')

    // Returns no thought signature (undefined)
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [],
      actions: [],
      thoughtSignatures: undefined,
    })

    // Second call should receive undefined (no signature from previous)
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [],
      actions: [],
      thoughtSignatures: 'sig-recovery',
    })

    const blackboard = new Blackboard()
    const agent = new AnalyzerAgent()
    agent.start(blackboard)

    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'Turn 1', t_ms: 1000 },
    })
    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'Turn 2', t_ms: 2000 },
    })

    await blackboard.drain(5000)
    agent.stop()

    expect(extractClaimsAndActionsMock).toHaveBeenCalledTimes(2)
    // First call: no previous signatures
    expect(extractClaimsAndActionsMock.mock.calls[0][1]).toBeUndefined()
    // Second call: still undefined because first call returned undefined
    expect(extractClaimsAndActionsMock.mock.calls[1][1]).toBeUndefined()
  })
})

describe('AnalyzerAgent in-session dedup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not enqueue duplicate claim texts within a session', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { AnalyzerAgent } = await import('../../src/agents/AnalyzerAgent')

    // Turn 1 returns a claim
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [{ text: 'Likes yoga', category: 'preferences', confidence: 0.8, evidence: ['I do yoga'] }],
      actions: [],
      thoughtSignatures: undefined,
    })

    // Turn 2 returns the same claim (same text, different case)
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [{ text: 'likes yoga', category: 'preferences', confidence: 0.9, evidence: ['yoga is great'] }],
      actions: [],
      thoughtSignatures: undefined,
    })

    const blackboard = new Blackboard()
    const agent = new AnalyzerAgent()
    const enqueued: string[] = []
    blackboard.subscribe((event) => {
      if (event.type === 'task.enqueued' && event.task.type === 'claim.proposed') {
        enqueued.push(event.task.claim.text)
      }
    })

    agent.start(blackboard)

    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'I do yoga', t_ms: 1000 },
    })
    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'yoga is great', t_ms: 2000 },
    })

    // Wait for both mock calls to complete (don't use drain — pending claim tasks exist)
    await waitForCalls(extractClaimsAndActionsMock, 2)
    agent.stop()

    // Only the first claim should be enqueued
    expect(enqueued).toEqual(['Likes yoga'])
  })

  it('does not enqueue duplicate action titles within a session', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { AnalyzerAgent } = await import('../../src/agents/AnalyzerAgent')

    // Turn 1 returns an action
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [],
      actions: [{ title: 'Buy groceries', dueWindow: 'Today', reminder: false }],
      thoughtSignatures: undefined,
    })

    // Turn 2 returns the same action (different case)
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [],
      actions: [{ title: 'buy groceries', dueWindow: 'This Week', reminder: true }],
      thoughtSignatures: undefined,
    })

    const blackboard = new Blackboard()
    const agent = new AnalyzerAgent()
    const enqueued: string[] = []
    blackboard.subscribe((event) => {
      if (event.type === 'task.enqueued' && event.task.type === 'action.proposed') {
        enqueued.push(event.task.action.title)
      }
    })

    agent.start(blackboard)

    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'Need to buy groceries', t_ms: 1000 },
    })
    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'Yes get groceries', t_ms: 2000 },
    })

    await waitForCalls(extractClaimsAndActionsMock, 2)
    agent.stop()

    // Only the first action should be enqueued
    expect(enqueued).toEqual(['Buy groceries'])
  })

  it('passes alreadyExtracted items to extractClaimsAndActions', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { AnalyzerAgent } = await import('../../src/agents/AnalyzerAgent')

    // Turn 1 returns a claim and action
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [{ text: 'Likes coffee', category: 'preferences', confidence: 0.8, evidence: ['I like coffee'] }],
      actions: [{ title: 'Buy coffee beans', dueWindow: 'Today', reminder: false }],
      thoughtSignatures: undefined,
    })

    // Turn 2: should receive alreadyExtracted from turn 1
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [],
      actions: [],
      thoughtSignatures: undefined,
    })

    const blackboard = new Blackboard()
    const agent = new AnalyzerAgent()
    agent.start(blackboard)

    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'I like coffee', t_ms: 1000 },
    })
    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'More about coffee', t_ms: 2000 },
    })

    await waitForCalls(extractClaimsAndActionsMock, 2)
    agent.stop()

    expect(extractClaimsAndActionsMock).toHaveBeenCalledTimes(2)

    // First call: empty alreadyExtracted
    const firstAlreadyExtracted = extractClaimsAndActionsMock.mock.calls[0][2]
    expect(firstAlreadyExtracted).toEqual({ claims: [], actions: [] })

    // Second call: should contain the extracted claim and action (lowercased keys)
    const secondAlreadyExtracted = extractClaimsAndActionsMock.mock.calls[1][2]
    expect(secondAlreadyExtracted.claims).toContain('likes coffee')
    expect(secondAlreadyExtracted.actions).toContain('buy coffee beans')
  })

  it('resets dedup sets on stop', async () => {
    const { Blackboard } = await import('../../src/blackboard/Blackboard')
    const { AnalyzerAgent } = await import('../../src/agents/AnalyzerAgent')

    // Session 1: extract a claim
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [{ text: 'Likes tea', category: 'preferences', confidence: 0.8, evidence: ['tea'] }],
      actions: [],
      thoughtSignatures: undefined,
    })

    const blackboard = new Blackboard()
    const agent = new AnalyzerAgent()
    const enqueued: string[] = []

    blackboard.subscribe((event) => {
      if (event.type === 'task.enqueued' && event.task.type === 'claim.proposed') {
        enqueued.push(event.task.claim.text)
      }
    })

    agent.start(blackboard)

    blackboard.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-1',
      turn: { speaker: 'user', text: 'tea', t_ms: 1000 },
    })

    await waitForCalls(extractClaimsAndActionsMock, 1)
    agent.stop()

    // Session 2: same claim should be enqueued again (sets cleared)
    extractClaimsAndActionsMock.mockResolvedValueOnce({
      claims: [{ text: 'Likes tea', category: 'preferences', confidence: 0.8, evidence: ['tea'] }],
      actions: [],
      thoughtSignatures: undefined,
    })

    const blackboard2 = new Blackboard()
    blackboard2.subscribe((event) => {
      if (event.type === 'task.enqueued' && event.task.type === 'claim.proposed') {
        enqueued.push(event.task.claim.text)
      }
    })

    agent.start(blackboard2)

    blackboard2.enqueue({
      type: 'turn.ingest',
      conversationId: 'conv-2',
      turn: { speaker: 'user', text: 'tea again', t_ms: 2000 },
    })

    await waitForCalls(extractClaimsAndActionsMock, 2)
    agent.stop()

    // Both sessions should have enqueued the claim
    expect(enqueued).toEqual(['Likes tea', 'Likes tea'])
  })
})
