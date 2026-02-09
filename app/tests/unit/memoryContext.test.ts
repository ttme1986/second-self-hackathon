import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/backend', () => ({
  listConversations: vi.fn(),
  listClaims: vi.fn(),
  listActions: vi.fn(),
  listGoals: vi.fn(),
  getProfile: vi.fn(),
}))

import { buildMemoryContext } from '../../src/services/memoryContext'
import { listConversations, listClaims, listActions, listGoals, getProfile } from '../../src/api/backend'

const mockListConversations = vi.mocked(listConversations)
const mockListClaims = vi.mocked(listClaims)
const mockListActions = vi.mocked(listActions)
const mockListGoals = vi.mocked(listGoals)
const mockGetProfile = vi.mocked(getProfile)

describe('buildMemoryContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListConversations.mockResolvedValue({ data: { items: [] } })
    mockListClaims.mockResolvedValue({ data: { items: [] } })
    mockListActions.mockResolvedValue({ data: { items: [] } })
    mockListGoals.mockResolvedValue({ data: { items: [] } })
    mockGetProfile.mockResolvedValue({ data: { profile: {} as any } })
  })

  it('produces a valid minimal prompt for first-time user', async () => {
    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('Alex')
    expect(systemPrompt).toContain('Second Self')
    expect(systemPrompt).toContain('Greeting behavior')
    expect(systemPrompt).toContain('Instructions')
  })

  it('uses "there" when displayName is empty', async () => {
    const { systemPrompt } = await buildMemoryContext('')

    expect(systemPrompt).toContain('a personal AI life assistant for there')
  })

  it('includes current date and time in prompt', async () => {
    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('## Current date and time')
  })

  it('includes memorySummary when available', async () => {
    mockGetProfile.mockResolvedValue({
      data: { profile: { memorySummary: 'User likes hiking and coffee' } as any },
    })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('## Memory summary')
    expect(systemPrompt).toContain('User likes hiking and coffee')
  })

  it('omits memorySummary section when empty', async () => {
    mockGetProfile.mockResolvedValue({ data: { profile: {} as any } })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).not.toContain('## Memory summary')
  })

  it('includes claims grouped by category', async () => {
    mockListClaims.mockResolvedValue({
      data: {
        items: [
          { id: '1', text: 'Loves hiking', category: 'preferences', status: 'confirmed', confidence: 0.9, evidence: [], conversationId: 'c1' },
          { id: '2', text: 'Knows Python', category: 'skills', status: 'inferred', confidence: 0.8, evidence: [], conversationId: 'c1' },
          { id: '3', text: 'Has a sister named Maya', category: 'relationships', status: 'confirmed', confidence: 0.95, evidence: [], conversationId: 'c1' },
          { id: '4', text: 'Born in 1990', category: 'other', status: 'confirmed', confidence: 0.7, evidence: [], conversationId: 'c1' },
        ],
      },
    })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('### Preferences')
    expect(systemPrompt).toContain('Loves hiking')
    expect(systemPrompt).toContain('### Skills')
    expect(systemPrompt).toContain('Knows Python')
    expect(systemPrompt).toContain('### Relationships')
    expect(systemPrompt).toContain('Has a sister named Maya')
    expect(systemPrompt).toContain('### Other')
    expect(systemPrompt).toContain('Born in 1990')
  })

  it('excludes rejected claims', async () => {
    mockListClaims.mockResolvedValue({
      data: {
        items: [
          { id: '1', text: 'Valid claim', category: 'other', status: 'confirmed', confidence: 0.9, evidence: [], conversationId: 'c1' },
          { id: '2', text: 'Rejected claim', category: 'other', status: 'rejected', confidence: 0.3, evidence: [], conversationId: 'c1' },
        ],
      },
    })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('Valid claim')
    expect(systemPrompt).not.toContain('Rejected claim')
  })

  it('caps claims at 50', async () => {
    const claims = Array.from({ length: 60 }, (_, i) => ({
      id: `claim-${i}`,
      text: `Claim ${i}`,
      category: 'other',
      status: 'confirmed' as const,
      confidence: 0.8,
      evidence: [],
      conversationId: 'c1',
    }))
    mockListClaims.mockResolvedValue({ data: { items: claims } })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('Claim 49')
    expect(systemPrompt).not.toContain('Claim 50')
  })

  it('includes recent conversations', async () => {
    mockListConversations.mockResolvedValue({
      data: {
        items: [
          { id: 'c1', summary: 'Discussed hiking plans', startedAt: '2025-01-01T10:00:00Z', endedAt: '2025-01-01T10:30:00Z', durationMs: 1800000, status: 'ended', claimIds: [], confirmedActionIds: [] },
          { id: 'c2', summary: 'Talked about work project', startedAt: '2025-01-02T10:00:00Z', endedAt: '2025-01-02T10:30:00Z', durationMs: 1800000, status: 'ended', claimIds: [], confirmedActionIds: [] },
        ],
      },
    })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('## Recent conversations')
    expect(systemPrompt).toContain('Discussed hiking plans')
    expect(systemPrompt).toContain('Talked about work project')
  })

  it('caps conversations at 3', async () => {
    const conversations = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      summary: `Conversation ${i}`,
      startedAt: `2025-01-0${i + 1}T10:00:00Z`,
      endedAt: `2025-01-0${i + 1}T10:30:00Z`,
      durationMs: 1800000,
      status: 'ended',
      claimIds: [],
      confirmedActionIds: [],
    }))
    mockListConversations.mockResolvedValue({ data: { items: conversations } })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('Conversation 0')
    expect(systemPrompt).toContain('Conversation 1')
    expect(systemPrompt).toContain('Conversation 2')
    expect(systemPrompt).not.toContain('Conversation 3')
    expect(systemPrompt).not.toContain('Conversation 4')
  })

  it('includes date and time for each conversation', async () => {
    mockListConversations.mockResolvedValue({
      data: {
        items: [
          { id: 'c1', summary: 'Test conversation', startedAt: '2025-06-15T14:30:00Z', endedAt: '2025-06-15T15:00:00Z', durationMs: 1800000, status: 'ended', claimIds: [], confirmedActionIds: [] },
        ],
      },
    })

    const { systemPrompt } = await buildMemoryContext('Alex')

    // toLocaleString() includes both date and time components
    const formatted = new Date('2025-06-15T15:00:00Z').toLocaleString()
    expect(systemPrompt).toContain(formatted)
  })

  it('only includes ended conversations with summaries', async () => {
    mockListConversations.mockResolvedValue({
      data: {
        items: [
          { id: 'c1', summary: 'Good conversation', startedAt: '2025-01-01T10:00:00Z', endedAt: '2025-01-01T10:30:00Z', durationMs: 1800000, status: 'ended', claimIds: [], confirmedActionIds: [] },
          { id: 'c2', summary: '', startedAt: '2025-01-02T10:00:00Z', endedAt: '', durationMs: 0, status: 'active', claimIds: [], confirmedActionIds: [] },
        ],
      },
    })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('Good conversation')
    expect(systemPrompt).not.toContain('c2')
  })

  it('includes actions grouped by due window', async () => {
    mockListActions.mockResolvedValue({
      data: {
        items: [
          { id: 'a1', title: 'Call dentist', dueWindow: 'Today', status: 'confirmed', source: 'chat', reminder: false, conversationId: 'c1' },
          { id: 'a2', title: 'Buy groceries', dueWindow: 'This Week', status: 'approved', source: 'chat', reminder: false, conversationId: 'c1' },
        ],
      },
    })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('### Due Today')
    expect(systemPrompt).toContain('Call dentist')
    expect(systemPrompt).toContain('### Other')
    expect(systemPrompt).toContain('Buy groceries (This Week)')
  })

  it('caps actions at 30', async () => {
    const actions = Array.from({ length: 35 }, (_, i) => ({
      id: `action-${i}`,
      title: `Action ${i}`,
      dueWindow: 'This Week' as const,
      status: 'confirmed' as const,
      source: 'chat',
      reminder: false,
      conversationId: 'c1',
    }))
    mockListActions.mockResolvedValue({ data: { items: actions } })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('Action 29')
    expect(systemPrompt).not.toContain('Action 30')
  })

  it('includes active goals with progress', async () => {
    mockListGoals.mockResolvedValue({
      data: {
        items: [
          { id: 'g1', title: 'Run a marathon', progress: 45, status: 'active', description: '', category: 'health', milestones: [], checkIns: [], linkedActionIds: [], linkedClaimIds: [], createdAt: '', updatedAt: '' },
        ],
      },
    })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('## Active goals')
    expect(systemPrompt).toContain('Run a marathon (45% complete)')
  })

  it('caps goals at 10', async () => {
    const goals = Array.from({ length: 15 }, (_, i) => ({
      id: `goal-${i}`,
      title: `Goal ${i}`,
      progress: i * 5,
      status: 'active' as const,
      description: '',
      category: 'personal' as const,
      milestones: [],
      checkIns: [],
      linkedActionIds: [],
      linkedClaimIds: [],
      createdAt: '',
      updatedAt: '',
    }))
    mockListGoals.mockResolvedValue({ data: { items: goals } })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('Goal 9')
    expect(systemPrompt).not.toContain('Goal 10')
  })

  it('handles backend errors gracefully', async () => {
    mockListConversations.mockRejectedValue(new Error('network error'))
    mockListClaims.mockRejectedValue(new Error('network error'))
    mockListActions.mockRejectedValue(new Error('network error'))
    mockListGoals.mockRejectedValue(new Error('network error'))
    mockGetProfile.mockRejectedValue(new Error('network error'))

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('Alex')
    expect(systemPrompt).toContain('Second Self')
    expect(systemPrompt).toContain('Greeting behavior')
  })

  it('handles partial backend failures', async () => {
    mockListConversations.mockRejectedValue(new Error('fail'))
    mockListClaims.mockResolvedValue({
      data: {
        items: [
          { id: '1', text: 'Likes coffee', category: 'preferences', status: 'confirmed', confidence: 0.9, evidence: [], conversationId: 'c1' },
        ],
      },
    })

    const { systemPrompt } = await buildMemoryContext('Alex')

    expect(systemPrompt).toContain('Likes coffee')
    expect(systemPrompt).not.toContain('## Recent conversations')
  })
})
