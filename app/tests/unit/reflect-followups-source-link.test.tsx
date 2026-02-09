import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import Reflect from '../../src/pages/Reflect'
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'

vi.mock('../../src/profile/ProfileProvider', () => ({
  useOptionalProfile: () => ({
    profile: {
      uid: 'user-1',
      displayName: 'Alex',
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
          },
        ],
      },
    }),
  ),
  listClaims: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  listActions: vi.fn(() =>
    Promise.resolve({
      data: {
        items: [
          {
            id: 'a1',
            title: 'Buy tea',
            dueWindow: 'Today',
            source: 'conversation',
            reminder: false,
            status: 'confirmed',
            conversationId: 'conv-1',
          },
        ],
      },
    }),
  ),
  listReviewQueue: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  embedQuery: vi.fn(() => Promise.resolve({ data: { embedding: [] } })),
  searchConversations: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  getConversationTranscript: vi.fn(() =>
    Promise.resolve({
      data: {
        turns: [{ speaker: 'user', text: 'I need to buy tea.', t_ms: 100 }],
      },
    }),
  ),
  updateClaim: vi.fn(() => Promise.resolve({ data: { updated: true } })),
  listGoals: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  createGoal: vi.fn(() => Promise.resolve({ data: { id: 'goal-1', goal: {} } })),
  updateGoal: vi.fn(() => Promise.resolve({ data: { updated: true } })),
  updateMilestone: vi.fn(() => Promise.resolve({ data: { updated: true } })),
  addMilestoneToGoal: vi.fn(() => Promise.resolve({ data: { milestone: {} } })),
  deleteMilestone: vi.fn(() => Promise.resolve({ data: { deleted: true } })),
  addCheckIn: vi.fn(() => Promise.resolve({ data: { checkIn: {} } })),
}))

function renderReflect(path = '/reflect?tab=follow-ups') {
  return render(
    <OpenLoopsProvider>
      <MemoryRouter initialEntries={[path]}>
        <Reflect />
      </MemoryRouter>
    </OpenLoopsProvider>,
  )
}

describe('Reflect follow-ups source link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a clickable source link when conversationId is present', async () => {
    const user = userEvent.setup()
    renderReflect()

    // Wait for the action to appear
    await screen.findByText('Buy tea')

    // Find the source link (the text is "conversation")
    const link = screen.getByRole('button', { name: 'conversation' })
    expect(link).toHaveStyle({ textDecoration: 'underline' })

    // Click it
    await user.click(link)

    // Expect moment detail to open
    await screen.findByText('Moment detail')
    expect(screen.getByText('Tea chat')).toBeInTheDocument()
    // Verify transcript is loaded (excerpt logic)
    await screen.findByText((content) => content.includes('user: I need to buy tea.'))
  })
})
