import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import Reflect from '../../src/pages/Reflect'
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'
import { resolveReviewQueue, updateClaim } from '../../src/api/backend'

vi.mock('../../src/profile/ProfileProvider', () => ({
  useOptionalProfile: () => ({
    profile: {
      uid: 'user-1',
      displayName: 'Alex',
      photoURL: null,
      email: 'alex@example.com',
      geoCapture: true,
      onboardingComplete: true,
    },
  }),
}))

vi.mock('../../src/api/backend', () => ({
  hasBackend: true,
  listConversations: vi.fn(() =>
    Promise.resolve({
      data: {
        items: [
          {
            id: 'conv-1',
            summary: 'Tea chat',
            startedAt: '2025-01-01T10:00:00Z',
            claimIds: ['c1', 'c2'],
          },
        ],
      },
    }),
  ),
  listClaims: vi.fn(() =>
    Promise.resolve({
      data: {
        items: [
          {
            id: 'c1',
            text: 'Prefers tea',
            status: 'inferred',
            category: 'preferences',
            confidence: 0.4,
            evidence: ['Prefers tea'],
            pinned: false,
          },
          {
            id: 'c2',
            text: 'Avoids coffee',
            status: 'confirmed',
            category: 'preferences',
            confidence: 0.9,
            evidence: ['Avoids coffee'],
            pinned: false,
          },
        ],
      },
    }),
  ),
  listActions: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  listReviewQueue: vi.fn(() =>
    Promise.resolve({
      data: {
        items: [
          {
            id: 'r1',
            title: 'Potential conflict detected',
            summary: 'Check tea vs coffee',
            claimIds: ['c1', 'c2'],
            claims: ['Prefers tea', 'Avoids coffee'],
            status: 'pending',
            severity: 'high',
            conversationId: 'conv-1',
          },
        ],
      },
    }),
  ),
  embedQuery: vi.fn(() => Promise.resolve({ data: { embedding: [0.1] } })),
  searchConversations: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  getConversationTranscript: vi.fn(() =>
    Promise.resolve({
      data: {
        turns: [
          { speaker: 'user', text: 'Hello', t_ms: 1 },
          { speaker: 'assistant', text: 'Hi there', t_ms: 2 },
        ],
      },
    }),
  ),
  resolveReviewQueue: vi.fn(() => Promise.resolve({ data: { updated: true } })),
  updateClaim: vi.fn(() => Promise.resolve({ data: { updated: true } })),
  listGoals: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  createGoal: vi.fn(() => Promise.resolve({ data: { id: 'goal-1', goal: {} } })),
  updateGoal: vi.fn(() => Promise.resolve({ data: { updated: true } })),
  updateMilestone: vi.fn(() => Promise.resolve({ data: { updated: true } })),
  addMilestoneToGoal: vi.fn(() => Promise.resolve({ data: { milestone: {} } })),
  deleteMilestone: vi.fn(() => Promise.resolve({ data: { deleted: true } })),
  addCheckIn: vi.fn(() => Promise.resolve({ data: { checkIn: {} } })),
}))

function renderReflect(path = '/reflect') {
  return render(
    <OpenLoopsProvider>
      <MemoryRouter initialEntries={[path]}>
        <Reflect />
      </MemoryRouter>
    </OpenLoopsProvider>,
  )
}

describe('Reflect backend mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps claims into UI', async () => {
    const user = userEvent.setup()
    renderReflect()

    await user.click(screen.getByRole('link', { name: 'About Me' }))
    const claimCards = await screen.findAllByText('Prefers tea')

    await user.click(claimCards[0])
    await screen.findByText('Claim detail')
    expect(screen.getByText('Receipts')).toBeInTheDocument()
    expect(screen.getAllByText('Prefers tea').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(screen.queryByText('Claim detail')).not.toBeInTheDocument()
    })
  })

  it('maps review queue records into UI', async () => {
    renderReflect('/reflect?tab=review')

    await screen.findByText('Potential conflict detected')
    expect(screen.getByText('Contradiction')).toBeInTheDocument()
    expect(screen.getByText('Check tea vs coffee')).toBeInTheDocument()
    expect(screen.getAllByText('Prefers tea').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Avoids coffee').length).toBeGreaterThan(0)
  })

  it('loads transcript excerpts for moments', async () => {
    const user = userEvent.setup()
    renderReflect()

    const moments = await screen.findAllByText('Tea chat')
    await user.click(moments[0])
    await screen.findByText((content) => content.includes('user: Hello'))
    await screen.findByText((content) => content.includes('assistant: Hi there'))
  })

  it('renders confidence labels and allows pinning claims', async () => {
    const user = userEvent.setup()
    renderReflect('/reflect?tab=profile')

    await screen.findByText('Prefers tea')
    expect(screen.getByText('Confidence: Low')).toBeInTheDocument()
    expect(screen.getByText('Confidence: High')).toBeInTheDocument()

    const pinButton = screen.getByRole('button', { name: 'Pin claim Prefers tea' })
    await user.click(pinButton)

    await waitFor(() => {
      expect(updateClaim).toHaveBeenCalledWith('c1', { pinned: true })
    })
  })

  it('resolves review queue with confirm-left', async () => {
    const user = userEvent.setup()
    renderReflect('/reflect?tab=review')

    await screen.findByText('Potential conflict detected')
    // Click the left claim card to select it
    const leftClaimButton = await screen.findByRole('button', { name: /Prefers tea/i })
    await user.click(leftClaimButton)
    // Click Confirm Selected button
    const confirmButton = await screen.findByRole('button', { name: /Confirm Selected/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(resolveReviewQueue).toHaveBeenCalledWith('r1', 'confirm-left')
      expect(updateClaim).toHaveBeenCalledWith('c1', { status: 'confirmed' })
      expect(updateClaim).toHaveBeenCalledWith('c2', { status: 'rejected' })
    })
  })

  it('resolves review queue with confirm-right', async () => {
    const user = userEvent.setup()
    renderReflect('/reflect?tab=review')

    await screen.findByText('Potential conflict detected')
    // Right claim is selected by default, just click Confirm Selected
    const confirmButton = await screen.findByRole('button', { name: /Confirm Selected/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(resolveReviewQueue).toHaveBeenCalledWith('r1', 'confirm-right')
      expect(updateClaim).toHaveBeenCalledWith('c2', { status: 'confirmed' })
      expect(updateClaim).toHaveBeenCalledWith('c1', { status: 'rejected' })
    })
  })

  it.skip('resolves review queue with reject-both', async () => {
    // Note: Reject Both functionality is not currently exposed in the UI
    // The UI now uses a selection-based approach where users choose one claim to confirm
    const user = userEvent.setup()
    renderReflect('/reflect?tab=review')

    await screen.findByText('Potential conflict detected')
    // No "Reject Both" button in current UI design

    await waitFor(() => {
      expect(resolveReviewQueue).toHaveBeenCalledWith('r1', 'reject-both')
      expect(updateClaim).toHaveBeenCalledWith('c1', { status: 'rejected' })
      expect(updateClaim).toHaveBeenCalledWith('c2', { status: 'rejected' })
    })
  })

  it('resolves review queue with merge edit', async () => {
    const user = userEvent.setup()
    renderReflect('/reflect?tab=review')

    await screen.findByText('Potential conflict detected')
    // Find and click the edit icon button
    const editButtons = screen.getAllByRole('button')
    const editButton = editButtons.find(btn => btn.querySelector('.material-symbols-outlined')?.textContent === 'edit')
    expect(editButton).toBeDefined()
    await user.click(editButton!)

    const input = await screen.findByRole('textbox', { name: 'Merged claim' })
    await user.clear(input)
    await user.type(input, 'Merged preference text')
    await user.click(screen.getByRole('button', { name: 'Apply merge' }))

    await waitFor(() => {
      expect(resolveReviewQueue).toHaveBeenCalledWith('r1', 'merge')
      expect(updateClaim).toHaveBeenCalledWith('c1', { text: 'Merged preference text', status: 'confirmed' })
      expect(updateClaim).toHaveBeenCalledWith('c2', { status: 'rejected' })
    })
  })
})
