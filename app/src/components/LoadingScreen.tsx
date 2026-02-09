import { type ReactNode } from 'react'

export default function LoadingScreen({ children }: { children?: ReactNode }) {
  return (
    <div className="loading-screen">
      <div className="loading-card">
        <div className="loading-title">Second-Self</div>
        <div className="loading-subtitle">Preparing your memory...</div>
      </div>
      {children}
    </div>
  )
}