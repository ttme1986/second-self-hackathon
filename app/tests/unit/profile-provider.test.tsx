import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ProfileProvider, useProfile } from '../../src/profile/ProfileProvider'

const { getProfile, updateProfile, deleteProfileData } = vi.hoisted(() => ({
  getProfile: vi.fn(() =>
    Promise.resolve({
      data: {
        profile: {
          uid: 'user-1',
          displayName: 'Alex',
          photoURL: null,
          email: 'alex@example.com',
          geoCapture: true,
          onboardingComplete: false,
        },
      },
    }),
  ),
  updateProfile: vi.fn(() =>
    Promise.resolve({
      data: {
        profile: {
          uid: 'user-1',
          displayName: 'Tim',
          photoURL: null,
          email: 'alex@example.com',
          geoCapture: true,
          onboardingComplete: false,
        },
      },
    }),
  ),
  deleteProfileData: vi.fn(() => Promise.resolve({ data: { deleted: true } })),
}))

vi.mock('../../src/api/backend', () => ({
  getProfile,
  updateProfile,
  deleteProfileData,
  hasBackend: true,
}))

const mockUser = vi.hoisted(() => ({ uid: 'user-1' }))

vi.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}))

function ProfileHarness() {
  const { profile, updateProfile: updateProfileHandler } = useProfile()
  return (
    <div>
      <div data-testid="name">{profile?.displayName ?? 'none'}</div>
      <button type="button" onClick={() => updateProfileHandler({ displayName: 'Tim' })}>
        Update
      </button>
    </div>
  )
}

describe('ProfileProvider', () => {
  it('loads profile from backend and updates state', async () => {
    const user = userEvent.setup()
    render(
      <ProfileProvider>
        <ProfileHarness />
      </ProfileProvider>,
    )

    await screen.findByText('Alex')
    await user.click(screen.getByRole('button', { name: 'Update' }))
    await screen.findByText('Tim')
    expect(updateProfile).toHaveBeenCalledWith({ displayName: 'Tim' })
  })
})
