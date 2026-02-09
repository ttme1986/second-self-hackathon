import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

function Child() {
  return <div>APP_CONTENT</div>
}

describe('AuthGate', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('renders children when VITE_SKIP_AUTH is true', async () => {
    vi.stubEnv('VITE_SKIP_AUTH', 'true')

    vi.doMock('../../src/auth/AuthProvider', () => ({
      useAuth: () => ({ user: null, loading: false }),
    }))

    const { default: Gate } = await import('../../src/auth/AuthGate')

    render(
      <MemoryRouter>
        <Gate>
          <Child />
        </Gate>
      </MemoryRouter>,
    )

    expect(screen.getByText('APP_CONTENT')).toBeInTheDocument()
  })

  it('shows loading screen when auth is loading and skipAuth is false', async () => {
    vi.stubEnv('VITE_SKIP_AUTH', 'false')

    vi.doMock('../../src/auth/AuthProvider', () => ({
      useAuth: () => ({ user: null, loading: true }),
    }))

    const { default: Gate } = await import('../../src/auth/AuthGate')

    render(
      <MemoryRouter>
        <Gate>
          <Child />
        </Gate>
      </MemoryRouter>,
    )

    expect(screen.getByText('Second-Self')).toBeInTheDocument()
    expect(screen.getByText('Preparing your memory...')).toBeInTheDocument()
  })

  it('renders Login when signed out and skipAuth is false', async () => {
    vi.stubEnv('VITE_SKIP_AUTH', 'false')

    vi.doMock('../../src/auth/AuthProvider', () => ({
      useAuth: () => ({ user: null, loading: false }),
    }))

    const { default: Gate } = await import('../../src/auth/AuthGate')

    render(
      <MemoryRouter>
        <Gate>
          <Child />
        </Gate>
      </MemoryRouter>,
    )

    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('renders children when signed in and skipAuth is false', async () => {
    vi.stubEnv('VITE_SKIP_AUTH', 'false')

    vi.doMock('../../src/auth/AuthProvider', () => ({
      useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
    }))

    const { default: Gate } = await import('../../src/auth/AuthGate')

    render(
      <MemoryRouter>
        <Gate>
          <Child />
        </Gate>
      </MemoryRouter>,
    )

    expect(screen.getByText('APP_CONTENT')).toBeInTheDocument()
  })
})
