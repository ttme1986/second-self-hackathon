import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Hub from '../../src/pages/Hub'

vi.mock('../../src/profile/ProfileProvider', () => ({
  useProfile: () => ({
    profile: {
      uid: 'u1',
      displayName: 'Tim',
      photoURL: null,
      email: 'tim@example.com',
      geoCapture: true,
      onboardingComplete: true,
    },
  }),
}))

vi.mock('../../src/openloops/OpenLoopsProvider', () => ({
  useOpenLoops: () => ({
    loops: [
      { title: 'A', due: 'Today', source: 'suggested', reminder: false, done: false },
      { title: 'B', due: 'Today', source: 'suggested', reminder: false, done: true },
      { title: 'C', due: 'This Week', source: 'suggested', reminder: false, done: false },
    ],
  }),
}))

describe('Hub', () => {
  it('renders greeting, nav links, and computed counters', () => {
    render(
      <MemoryRouter>
        <Hub />
      </MemoryRouter>,
    )

    // The Hub now shows a dynamic greeting with the user's name
    expect(screen.getByText(/Good (morning|afternoon|evening), Tim/)).toBeInTheDocument()

    // Primary navigation cards
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Reflect')).toBeInTheDocument()

    // Settings shortcut
    expect(screen.getByLabelText('Open settings')).toBeInTheDocument()

    // Attention pills
    expect(screen.getByLabelText('Review Queue')).toBeInTheDocument()
    expect(screen.getByLabelText('Due Today')).toBeInTheDocument()

    // Due today badge should count only non-done loops
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })
})
