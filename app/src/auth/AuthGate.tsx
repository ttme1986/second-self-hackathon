import { type ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import LoadingScreen from '../components/LoadingScreen'
import Login from '../pages/Login'

export default function AuthGate({ children }: { children: ReactNode }) {
  // Detect Playwright/automation (works in production builds for e2e tests)
  const isPlaywright = navigator.webdriver || window.navigator.userAgent.includes('Playwright')

  // Allow forcing login page for screenshots via URL param
  const forceLogin = new URLSearchParams(window.location.search).has('forceLogin')

  const skipAuth =
    !forceLogin && (
      import.meta.env.VITE_SKIP_AUTH === 'true' ||
      isPlaywright ||
      (import.meta.env.DEV && new URLSearchParams(window.location.search).has('skipAuth')) ||
      (import.meta.env.DEV && window.localStorage.getItem('skipAuth') === 'true')
    )
  const { user, loading } = useAuth()

  if (skipAuth) {
    return <>{children}</>
  }

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Login />
  }

  return <>{children}</>
}
