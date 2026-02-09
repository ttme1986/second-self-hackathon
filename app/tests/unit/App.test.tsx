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
}))

describe('App', () => {
  it('renders the Hub screen by default', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    // The Hub now shows a dynamic greeting with the user's name
    expect(screen.getByText(/Good (morning|afternoon|evening), Alex/)).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Reflect')).toBeInTheDocument()
  })
})


