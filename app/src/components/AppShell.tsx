import type { ReactNode } from 'react'

type AppShellProps = {
  variant: 'hub' | 'chat' | 'reflect' | 'settings'
  children: ReactNode
}

export default function AppShell({ variant, children }: AppShellProps) {
  return (
    <div className={`app-shell app-shell--${variant}`}>
      <div className="app-screen">{children}</div>
    </div>
  )
}