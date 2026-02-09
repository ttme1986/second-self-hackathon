import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from '../../src/App'

vi.mock('../../src/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: { uid: 'test-user' },
    loading: false,
    signInWithGoogle: vi.fn(),
    signOutUser: vi.fn(),
  }),
}))

vi.mock('../../src/profile/ProfileProvider', () => ({
  ProfileProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useProfile: () => ({
    profile: {
      uid: 'test-user',
      displayName: 'Alex',
      photoURL: null,
      email: 'alex@example.com',
      geoCapture: true,
      onboardingComplete: true,
    },
    loading: false,
    updateProfile: vi.fn(),
    completeOnboarding: vi.fn(),
    toggleGeoCapture: vi.fn(),
    requestDeleteAllData: vi.fn(),
  }),
  useOptionalProfile: () => ({
    profile: {
      uid: 'test-user',
      displayName: 'Alex',
      photoURL: null,
      email: 'alex@example.com',
      geoCapture: true,
      onboardingComplete: true,
    },
    loading: false,
    updateProfile: vi.fn(),
    completeOnboarding: vi.fn(),
    toggleGeoCapture: vi.fn(),
    requestDeleteAllData: vi.fn(),
  }),
}))

describe('Navigation actions', () => {
  it('closes session recap and returns to Hub', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <App />
      </MemoryRouter>,
    )

    await user.click(screen.getByLabelText('End session'))
    await user.click(screen.getByLabelText('Close recap'))

    await waitFor(() => {
      // The Hub now shows a dynamic greeting with the user's name - check for the hub-greeting section
      const greetings = screen.getAllByText(/Good (morning|afternoon|evening), Alex/)
      expect(greetings.length).toBeGreaterThan(0)
    })
  })

  it('Reflect button navigates to Reflect commitments tab', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <App />
      </MemoryRouter>,
    )

    await user.click(screen.getByLabelText('End session'))
    await user.click(screen.getByRole('button', { name: /Reflect/i }))

    // Verify Commitments tab is active by checking for sub-tab buttons
    expect(await screen.findByRole('button', { name: 'Actions' })).toBeInTheDocument()
  })

  it('reflect mic button navigates to Chat', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/reflect']}>
        <App />
      </MemoryRouter>,
    )

    await user.click(screen.getByLabelText('Record'))

    expect(await screen.findByPlaceholderText('Type a note...')).toBeInTheDocument()
  })

  it('Review Queue card navigates to Review tab', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('link', { name: /Review Queue/i }))

    // Verify Review tab is active by checking for pending count chip
    expect(await screen.findByText(/pending/)).toBeInTheDocument()
  })

  it('Due Today card navigates to Commitments tab', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('link', { name: /Due Today/i }))

    // Verify Commitments tab is active by checking for sub-tab buttons
    expect(await screen.findByRole('button', { name: 'Actions' })).toBeInTheDocument()
  })
})
