import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'

type ToastMessage = { id: number; text: string; type: 'error' | 'info' | 'success' }
type ToastContextType = { showToast: (text: string, type?: 'error' | 'info' | 'success') => void }

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })
export const useToast = () => useContext(ToastContext)

let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((text: string, type: 'error' | 'info' | 'success' = 'error') => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, text, type }])
  }, [])

  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1))
    }, 4000)
    return () => clearTimeout(timer)
  }, [toasts])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999,
        pointerEvents: 'none',
      }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              padding: '10px 20px', borderRadius: 12,
              background: toast.type === 'error' ? 'rgba(255,107,107,0.9)' : toast.type === 'success' ? 'rgba(72,187,120,0.9)' : 'rgba(99,137,140,0.9)',
              color: '#fff', fontSize: '0.85rem', fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', maxWidth: 320, textAlign: 'center',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
