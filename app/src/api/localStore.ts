const STORAGE_KEY = 'secondSelfStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- storage layer; shapes are dynamic from JSON.parse
type StoreRecord = Record<string, any>

type UserStore = {
  profile: StoreRecord | null
  claims: Record<string, StoreRecord>
  reviewQueue: Record<string, StoreRecord>
  actions: Record<string, StoreRecord>
  conversations: Record<string, StoreRecord>
  goals: Record<string, StoreRecord>
  [key: string]: unknown
}

type LocalStore = {
  version: number
  users: Record<string, UserStore>
  moments: Record<string, StoreRecord>
  openLoops: Record<string, StoreRecord>
  uploads: Record<string, StoreRecord>
}

const defaultStore = (): LocalStore => ({
  version: 1,
  users: {},
  moments: {},
  openLoops: {},
  uploads: {},
})

let memoryStore: LocalStore = defaultStore()

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const loadStore = (): LocalStore => {
  if (!canUseStorage()) return memoryStore
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    
    // Heuristic: If we have in-memory data (e.g. active user session), prefer it
    // to survive offline/failed writes or empty disk reads.
    if (memoryStore && Object.keys(memoryStore.users).length > 0) {
        return memoryStore
    }

    if (!raw) return defaultStore()
    const parsed = JSON.parse(raw) as LocalStore
    if (!parsed || typeof parsed !== 'object') return defaultStore()
    
    // Adopt disk state if memory was empty
    if (parsed.users) {
        memoryStore = parsed
    }

    return {
      version: parsed.version ?? 1,
      users: parsed.users ?? {},
      moments: parsed.moments ?? {},
      openLoops: parsed.openLoops ?? {},
      uploads: parsed.uploads ?? {},
    }
  } catch {
    return memoryStore // Fallback to memory on error
  }
}

const saveStore = (store: LocalStore) => {
  memoryStore = store
  if (!canUseStorage()) return
  // Debounce writes or queue them?
  // For basic offline safety, we just write to localStorage immediately.
  // The browser handles the async flush to disk.
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (e) {
    console.warn('Failed to save to localStorage', e)
  }
}

const withStore = <T>(mutator: (store: LocalStore) => T): T => {
  const store = loadStore()
  const result = mutator(store)
  saveStore(store)
  return result
}

const clearStore = () => {
  memoryStore = defaultStore()
  if (canUseStorage()) {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

const ensureUserStore = (store: LocalStore, uid: string) => {
  if (!store.users[uid]) {
    store.users[uid] = {
      profile: null,
      claims: {},
      reviewQueue: {},
      actions: {},
      conversations: {},
      goals: {},
    }
  } else {
    const user = store.users[uid]
    user.claims = user.claims ?? {}
    user.reviewQueue = user.reviewQueue ?? {}
    user.actions = user.actions ?? {}
    user.conversations = user.conversations ?? {}
    user.goals = user.goals ?? {}
    // Note: insights are computed dynamically, not stored
  }
  return store.users[uid]
}

export type { LocalStore, UserStore, StoreRecord }
export { loadStore, saveStore, withStore, clearStore, ensureUserStore }
