import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Settings from '../../src/pages/Settings'
import OnboardingModal from '../../src/components/OnboardingModal'

const updateProfile = vi.fn()
const toggleGeoCapture = vi.fn()
const requestDeleteAllData = vi.fn().mockResolvedValue(undefined)
const signOutUser = vi.fn()
const completeOnboarding = vi.fn()
const profile = {
  uid: 'user-1',
  displayName: 'Alex',
  photoURL: null,
  email: 'alex@example.com',
  geoCapture: true,
  onboardingComplete: false,
}

vi.mock('../../src/profile/ProfileProvider', () => ({
  useProfile: () => ({
    profile,
    updateProfile,
    toggleGeoCapture,
    requestDeleteAllData,
    completeOnboarding,
  }),
}))

vi.mock('../../src/api/backend', () => ({
  hasBackend: true,
}))

vi.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    signOutUser,
  }),
}))

describe('Settings', () => {
  it('displays profile information', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    )
    screen.getByText('Alex')
    screen.getByText('Profile')
  })

  it('toggles geo capture', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'On' }))
    expect(toggleGeoCapture).toHaveBeenCalledWith(false)
  })

  it('requests delete all data when confirmed', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(requestDeleteAllData).toHaveBeenCalled()

    confirmSpy.mockRestore()
  })
})

describe('OnboardingModal', () => {
  it('completes onboarding and requests geo', async () => {
    const user = userEvent.setup()
    const geoSpy = vi.fn()
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: geoSpy },
      configurable: true,
    })
    render(<OnboardingModal />)

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(toggleGeoCapture).toHaveBeenCalledWith(true)
    expect(completeOnboarding).toHaveBeenCalled()
    expect(geoSpy).toHaveBeenCalled()
  })
})




