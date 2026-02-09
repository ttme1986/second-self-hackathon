import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Reflect from '../../src/pages/Reflect'
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'
import { clearStore } from '../../src/api/localStore'

vi.mock('@google/genai', () => {
  class GoogleGenAI {
    models = {
      generateContent: vi.fn(async () => ({
        text: JSON.stringify({
          milestones: [
            { title: 'Step 1', completed: false },
            { title: 'Step 2', completed: false },
          ],
        }),
      })),
      embedContent: vi.fn(async () => ({
        embeddings: [{ values: [0.1, 0.2, 0.3] }],
      })),
    }
  }
  const Type = { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN' }
  const ThinkingLevel = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' }
  return { GoogleGenAI, Type, ThinkingLevel }
})

const setSessionUser = (uid: string) => {
  window.localStorage.setItem('sessionUser', JSON.stringify({ uid }))
}

function renderReflect(path = '/reflect?tab=follow-ups&subtab=goals') {
  return render(
    <OpenLoopsProvider>
      <MemoryRouter initialEntries={[path]}>
        <Reflect />
      </MemoryRouter>
    </OpenLoopsProvider>,
  )
}

describe('Reflect Goals tab', () => {
  beforeEach(() => {
    clearStore()
    window.localStorage.clear()
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key')
    vi.stubEnv('VITE_DISABLE_AI', 'false')
    setSessionUser('goal-test-user')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('shows empty state when no goals exist', async () => {
    renderReflect()

    expect(screen.getByText('No goals yet')).toBeInTheDocument()
    expect(screen.getByText(/Set your first goal/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create Your First Goal/i })).toBeInTheDocument()
  })

  it('shows Goals as sub-tab under Commitments', async () => {
    renderReflect('/reflect?tab=follow-ups')

    // Goals is now a sub-tab chip under Commitments
    expect(screen.getByRole('button', { name: 'Goals' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument()
  })

  it('navigates to Goals sub-tab when clicked', async () => {
    const user = userEvent.setup()
    renderReflect('/reflect?tab=follow-ups')

    await user.click(screen.getByRole('button', { name: 'Goals' }))

    expect(screen.getByText('No goals yet')).toBeInTheDocument()
  })

  it('shows New Goal button', async () => {
    renderReflect()

    expect(screen.getByRole('button', { name: /New Goal/i })).toBeInTheDocument()
  })

  it('opens create goal modal when New Goal clicked', async () => {
    const user = userEvent.setup()
    renderReflect()

    await user.click(screen.getByRole('button', { name: /New Goal/i }))

    expect(screen.getByText('Create New Goal')).toBeInTheDocument()
    expect(screen.getByLabelText(/Goal Title/i)).toBeInTheDocument()
  })

  it('shows filter chips for goal status', async () => {
    renderReflect()

    expect(screen.getByRole('button', { name: /Active/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Completed/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument()
  })
})

describe('Create Goal Modal', () => {
  beforeEach(() => {
    clearStore()
    window.localStorage.clear()
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key')
    vi.stubEnv('VITE_DISABLE_AI', 'false')
    setSessionUser('goal-modal-user')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('validates goal title is required', async () => {
    const user = userEvent.setup()
    renderReflect()

    await user.click(screen.getByRole('button', { name: /New Goal/i }))

    const nextButton = screen.getByRole('button', { name: /Next: Add Milestones/i })
    expect(nextButton).toBeDisabled()
  })

  it('enables next button when title entered', async () => {
    const user = userEvent.setup()
    renderReflect()

    await user.click(screen.getByRole('button', { name: /New Goal/i }))
    await user.type(screen.getByLabelText(/Goal Title/i), 'Learn to code')

    const nextButton = screen.getByRole('button', { name: /Next: Add Milestones/i })
    expect(nextButton).not.toBeDisabled()
  })

  it('shows category selection', async () => {
    const user = userEvent.setup()
    renderReflect()

    await user.click(screen.getByRole('button', { name: /New Goal/i }))

    expect(screen.getByText('Health & Fitness')).toBeInTheDocument()
    expect(screen.getByText('Career')).toBeInTheDocument()
    expect(screen.getByText('Learning')).toBeInTheDocument()
    expect(screen.getByText('Relationships')).toBeInTheDocument()
    expect(screen.getByText('Finance')).toBeInTheDocument()
    expect(screen.getByText('Personal')).toBeInTheDocument()
  })

  it('proceeds to milestones step', async () => {
    const user = userEvent.setup()
    renderReflect()

    await user.click(screen.getByRole('button', { name: /New Goal/i }))
    await user.type(screen.getByLabelText(/Goal Title/i), 'My Goal')
    await user.click(screen.getByRole('button', { name: /Next: Add Milestones/i }))

    // There are multiple "Milestones" elements - check for the subtitle one
    const milestonesElements = screen.getAllByText('Milestones')
    expect(milestonesElements.length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText(/Add a milestone/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Suggest with AI/i })).toBeInTheDocument()
  })

  it('closes modal on cancel', async () => {
    const user = userEvent.setup()
    renderReflect()

    await user.click(screen.getByRole('button', { name: /New Goal/i }))
    expect(screen.getByText('Create New Goal')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(screen.queryByText('Create New Goal')).not.toBeInTheDocument()
  })
})
