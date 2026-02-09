import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, afterEach, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '../../src/auth/AuthProvider'

const createSession = vi.fn(() => Promise.resolve({ data: { token: 'jwt-token' } }))

vi.mock('../../src/api/backend', () => ({
  hasBackend: true,
  createSession: (...args: any[]) => createSession(...args),
}))

vi.mock('../../src/lib/firebase', () => ({
  auth: {},
  googleProvider: {},
}))

// Mock firebase/auth with the required functions
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    // Immediately call with null (not signed in) to mimic initial state
    setTimeout(() => callback(null), 0)
    return () => { } // Return unsubscribe function
  }),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(() => Promise.resolve()),
}))

function AuthHarness() {
  const { user, token, loading, signInWithGoogle, signOutUser } = useAuth()
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{user?.uid ?? 'none'}</div>
      <div data-testid="token">{token ?? 'none'}</div>
      <button type="button" onClick={signInWithGoogle}>
        Sign in
      </button>
      <button type="button" onClick={signOutUser}>
        Sign out
      </button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SKIP_AUTH', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    createSession.mockClear()
  })

  it('creates a backend session and stores token', async () => {
    vi.stubEnv('VITE_DEV_USER_ID', 'dev-user')
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(createSession).toHaveBeenCalledWith({
      uid: 'dev-user',
      displayName: 'dev-user',
      email: undefined,
      photoURL: undefined,
    })
    await screen.findByText('dev-user')
    expect(screen.getByTestId('token').textContent).toBe('jwt-token')
  })

  it('clears session on sign out', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(screen.getByTestId('token').textContent).toBe('none')
  })

  it('does not crash when firebase auth is disabled (VITE_DISABLE_AUTH=true)', async () => {
    vi.stubEnv('VITE_SKIP_AUTH', 'false')
    vi.stubEnv('VITE_DISABLE_AUTH', 'true')

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>,
    )

    // AuthProvider should quickly settle to ready state.
    expect(await screen.findByTestId('loading')).toHaveTextContent('ready')
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })
})

