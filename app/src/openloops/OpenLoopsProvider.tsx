import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { trackEvent } from '../lib/analytics'

type DueWindow = 'Today' | 'This Week' | 'This Month' | 'Everything else'

type OpenLoop = {
  id: string
  title: string
  due: DueWindow
  source: 'suggested' | 'user' | 'conversation'
  sourceId?: string
  reminder: boolean
  done: boolean
}

type OpenLoopsContextValue = {
  loops: OpenLoop[]
  addLoop: (loop: Omit<OpenLoop, 'id' | 'done'>) => void
  toggleDone: (id: string) => void
  toggleReminder: (id: string) => void
  updateDue: (id: string, due: DueWindow) => void
  replaceLoops: (loops: OpenLoop[]) => void
}

const OpenLoopsContext = createContext<OpenLoopsContextValue | undefined>(undefined)

const STORAGE_KEY = 'openLoops'

const createLoopId = (seed: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  const suffix = Math.random().toString(16).slice(2, 10)
  return `${seed}-${Date.now()}-${suffix}`
}

const normalizeLoops = (items: OpenLoop[]) => {
  const seen = new Set<string>()
  return items.map((loop, index) => {
    let id = loop.id || createLoopId(loop.title)
    while (seen.has(id)) {
      id = createLoopId(`${loop.title}-${index}`)
    }
    seen.add(id)
    return { ...loop, id }
  })
}

const loadInitialLoops = () => {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OpenLoop[]
    if (!Array.isArray(parsed)) return []
    return normalizeLoops(parsed)
  } catch {
    return []
  }
}

export function OpenLoopsProvider({ children }: { children: ReactNode }) {
  const [loops, setLoops] = useState<OpenLoop[]>(loadInitialLoops)

  const addLoop = useCallback((loop: Omit<OpenLoop, 'id' | 'done'>) => {
    setLoops((prev) => [
      ...prev,
      {
        ...loop,
        id: createLoopId(loop.title),
        done: false,
      },
    ])
    void trackEvent('open_loop_created', { source: loop.source, due: loop.due })
  }, [])

  const toggleDone = useCallback((id: string) => {
    setLoops((prev) =>
      prev.map((loop) => {
        if (loop.id !== id) return loop
        const next = { ...loop, done: !loop.done }
        void trackEvent('open_loop_toggled', { done: next.done })
        return next
      }),
    )
  }, [])

  const toggleReminder = useCallback((id: string) => {
    setLoops((prev) =>
      prev.map((loop) => {
        if (loop.id !== id) return loop
        const next = { ...loop, reminder: !loop.reminder }
        void trackEvent('open_loop_reminder_toggled', { reminder: next.reminder })
        return next
      }),
    )
  }, [])

  const updateDue = useCallback((id: string, due: DueWindow) => {
    setLoops((prev) => prev.map((loop) => (loop.id === id ? { ...loop, due } : loop)))
    void trackEvent('open_loop_due_updated', { due })
  }, [])

  const replaceLoops = useCallback((nextLoops: OpenLoop[]) => {
    setLoops(normalizeLoops(nextLoops))
  }, [])

  const value = useMemo(
    () => ({ loops, addLoop, toggleDone, toggleReminder, updateDue, replaceLoops }),
    [loops, addLoop, toggleDone, toggleReminder, updateDue, replaceLoops],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loops))
  }, [loops])

  return <OpenLoopsContext.Provider value={value}>{children}</OpenLoopsContext.Provider>
}

export function useOpenLoops() {
  const context = useContext(OpenLoopsContext)
  if (!context) {
    throw new Error('useOpenLoops must be used within OpenLoopsProvider')
  }
  return context
}

export type { OpenLoop, DueWindow }
