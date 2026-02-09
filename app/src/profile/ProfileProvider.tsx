import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { deleteProfileData, getProfile, updateProfile, type UserProfile, type ActionPermission, type ActionType } from '../api/backend'
import { useAuth } from '../auth/AuthProvider'

export type { UserProfile, ActionPermission, ActionType }

type ProfileContextValue = {
  profile: UserProfile | null
  loading: boolean
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  completeOnboarding: () => Promise<void>
  toggleGeoCapture: (nextValue: boolean) => Promise<void>
  requestDeleteAllData: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined)

function normalizeProfile(profile: UserProfile | null | undefined, uid: string): UserProfile {
  return {
    uid,
    displayName: profile?.displayName ?? 'New User',
    photoURL: profile?.photoURL ?? null,
    email: profile?.email ?? null,
    geoCapture: profile?.geoCapture ?? true,
    onboardingComplete: profile?.onboardingComplete ?? false,
    defaultActionPermission: profile?.defaultActionPermission ?? 'suggest',
    actionPermissions: profile?.actionPermissions ?? {},
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    const loadProfile = async () => {
      const result = await getProfile()
      if (!active) return
      if (result.data?.profile) {
        setProfile(normalizeProfile(result.data.profile, user.uid))
      } else {
        setProfile(normalizeProfile(null, user.uid))
      }
      setLoading(false)
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [user])

  const updateProfileHandler = async (updates: Partial<UserProfile>) => {
    if (!user) return

    const result = await updateProfile(updates)
    if (result.data?.profile) {
      setProfile(normalizeProfile(result.data.profile, user.uid))
      return
    }

    setProfile((prev) => ({
      ...(prev ?? normalizeProfile(null, user.uid)),
      ...updates,
    }))
  }

  const completeOnboarding = async () => {
    await updateProfileHandler({ onboardingComplete: true })
  }

  const toggleGeoCapture = async (nextValue: boolean) => {
    await updateProfileHandler({ geoCapture: nextValue })
  }

  const requestDeleteAllData = async () => {
    await deleteProfileData()
  }

  const value = useMemo(
    () => ({
      profile,
      loading,
      updateProfile: updateProfileHandler,
      completeOnboarding,
      toggleGeoCapture,
      requestDeleteAllData,
    }),
    [profile, loading],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider')
  }
  return context
}

export function useOptionalProfile() {
  return useContext(ProfileContext)
}
