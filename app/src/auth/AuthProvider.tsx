import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth, googleProvider, signInWithEmailAndPassword } from '../lib/firebase'
import { createSession, hasBackend } from '../api/backend'
import { trackEvent } from '../lib/analytics'
import { syncDemoDataFromFirestore } from '../services/firestoreSync'

type AuthUser = {
  uid: string
  displayName?: string
  photoURL?: string | null
  email?: string | null
}

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithDemo: () => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const TOKEN_KEY = 'sessionToken'
const USER_KEY = 'sessionUser'
const DEV_UID_KEY = 'devUserId'

const isSkipAuth = () => import.meta.env.VITE_SKIP_AUTH === 'true'
const isAuthDisabled = () => import.meta.env.VITE_DISABLE_AUTH === 'true'

function firebaseUserToAuthUser(firebaseUser: User): AuthUser {
  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName ?? undefined,
    photoURL: firebaseUser.photoURL,
    email: firebaseUser.email,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const persistSession = (nextUser: AuthUser, nextToken: string) => {
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    window.localStorage.setItem(TOKEN_KEY, nextToken)
    setUser(nextUser)
    setToken(nextToken)
  }

  const syncBackendSession = async (authUser: AuthUser) => {
    if (!hasBackend) {
      persistSession(authUser, 'local')
      return
    }

    const result = await createSession({
      uid: authUser.uid,
      displayName: authUser.displayName,
      email: authUser.email,
      photoURL: authUser.photoURL,
    })
    if (result.error || !result.data?.token) {
      console.error('Failed to create backend session:', result.error)
      persistSession(authUser, 'local')
      return
    }
    persistSession(authUser, result.data.token)
  }

  useEffect(() => {
    // Dev mode: skip Firebase auth entirely
    if (isSkipAuth()) {
      const storedUser = window.localStorage.getItem(USER_KEY)
      const storedToken = window.localStorage.getItem(TOKEN_KEY)
      if (storedUser && storedToken) {
        try {
          setUser(JSON.parse(storedUser) as AuthUser)
          setToken(storedToken)
        } catch {
          window.localStorage.removeItem(USER_KEY)
        }
      }
      setLoading(false)
      return
    }

    // Production: listen to Firebase auth state
    // Note: during e2e we may disable Firebase auth entirely.
    if (isAuthDisabled() || !auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const authUser = firebaseUserToAuthUser(firebaseUser)

        // For demo users, sync Firestore data BEFORE setting user state
        // This ensures ProfileProvider loads the correct profile
        const isDemoUser = firebaseUser.email === 'demo@example.com'
        if (isDemoUser) {
          await syncDemoDataFromFirestore(authUser.uid)
        }

        await syncBackendSession(authUser)
      } else {
        // Clear session when signed out
        window.localStorage.removeItem(USER_KEY)
        window.localStorage.removeItem(TOKEN_KEY)
        setUser(null)
        setToken(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogleHandler = async () => {
    try {
      if (isSkipAuth()) {
        // Dev mode fallback
        const envUid = import.meta.env.VITE_DEV_USER_ID?.toString()
        const storedDevUid = window.localStorage.getItem(DEV_UID_KEY)
        const fallbackUid =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`
        const uid = envUid || storedDevUid || `dev-${fallbackUid}`
        if (!storedDevUid && !envUid) {
          window.localStorage.setItem(DEV_UID_KEY, uid)
        }

        const devUser: AuthUser = { uid, displayName: uid }
        await syncBackendSession(devUser)
        void trackEvent('auth_sign_in', { method: 'dev' })
        return
      }

      // Production: Firebase Google Auth
      if (!auth || !googleProvider) {
        throw new Error('Firebase auth is not configured')
      }
      const result = await signInWithPopup(auth, googleProvider)
      void trackEvent('auth_sign_in', { method: 'google' })

      // Auth state listener will handle session sync
      console.log('Signed in as:', result.user.email)
    } catch (error) {
      void trackEvent('auth_sign_in_failed', { method: 'google' })
      console.error('Google sign-in failed:', error)
      throw error
    }
  }

  const signOutUserHandler = async () => {
    try {
      if (!isSkipAuth() && auth) {
        await signOut(auth)
      }
      window.localStorage.removeItem(USER_KEY)
      window.localStorage.removeItem(TOKEN_KEY)
      setUser(null)
      setToken(null)
      void trackEvent('auth_sign_out')
    } catch (error) {
      console.error('Sign out failed:', error)
      throw error
    }
  }

  const signInWithDemoHandler = async () => {
    const DEMO_EMAIL = 'demo@example.com'
    const DEMO_PASSWORD = 'example1234'

    try {
      if (!auth) {
        throw new Error('Firebase auth is not configured')
      }

      const result = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD)
      void trackEvent('auth_sign_in', { method: 'demo' })

      // Demo data sync is handled in onAuthStateChanged
      console.log('Signed in as demo user:', result.user.email)
    } catch (error) {
      void trackEvent('auth_sign_in_failed', { method: 'demo' })
      console.error('Demo sign-in failed:', error)
      throw error
    }
  }

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      signInWithGoogle: signInWithGoogleHandler,
      signInWithDemo: signInWithDemoHandler,
      signOutUser: signOutUserHandler,
    }),
    [user, token, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

