import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Hub from './pages/Hub'
import Chat from './pages/Chat'
import Reflect from './pages/Reflect'
import Settings from './pages/Settings'
import { AuthProvider } from './auth/AuthProvider'
import AuthGate from './auth/AuthGate'
import { ProfileProvider, useProfile } from './profile/ProfileProvider'
import { OpenLoopsProvider } from './openloops/OpenLoopsProvider'
import OnboardingModal from './components/OnboardingModal'
import LoadingScreen from './components/LoadingScreen'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { hasUncommittedSession } from './services/firestoreWriteGate'

function AppRoutes() {
  const { profile, loading } = useProfile()
  const recoveryAttemptedRef = useRef(false)

  useEffect(() => {
    if (loading || recoveryAttemptedRef.current) return
    recoveryAttemptedRef.current = true
    if (!hasUncommittedSession()) return

    // Find the active conversation from localStorage and flush to Firestore
    void (async () => {
      try {
        const { getActiveConversation, commitSessionToFirestore } = await import('./api/backend')
        const { data } = await getActiveConversation()
        if (data?.conversation?.id) {
          await commitSessionToFirestore(data.conversation.id)
        } else {
          // No active conversation found — clear the stale flag
          const { stopDeferring } = await import('./services/firestoreWriteGate')
          stopDeferring()
        }
      } catch (err) {
        console.warn('[crash-recovery] Failed to commit session:', err)
        const { stopDeferring } = await import('./services/firestoreWriteGate')
        stopDeferring()
      }
    })()
  }, [loading])

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <>
      {profile && !profile.onboardingComplete ? <OnboardingModal /> : null}
      <Routes>
        <Route path="/" element={<Hub />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/reflect" element={<Reflect />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <ProfileProvider>
          <OpenLoopsProvider>
            <ToastProvider>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </ToastProvider>
          </OpenLoopsProvider>
        </ProfileProvider>
      </AuthGate>
    </AuthProvider>
  )
}