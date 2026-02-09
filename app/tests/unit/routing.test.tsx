import { render, screen } from '@testing-library/react'
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

describe('Routing', () => {
  it('renders Chat screen', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Listening|Paused|Tap to start/)).toBeInTheDocument()
  })

  it('renders Reflect screen', () => {
    render(
      <MemoryRouter initialEntries={['/reflect']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Reflect' })).toBeInTheDocument()
  })

  it('redirects unknown routes to Hub', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>,
    )

    // The Hub now shows a dynamic greeting with the user's name
    expect(screen.getByText(/Good (morning|afternoon|evening), Alex/)).toBeInTheDocument()
  })
})



