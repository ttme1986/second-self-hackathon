import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

// Firebase is not needed for unit tests; mock it to avoid real initialization.
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn(() => () => {}),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  arrayUnion: vi.fn((...args: unknown[]) => args),
  collection: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ forEach: () => {}, docs: [] })),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
}))

const createMemoryStorage = () => {
  let store: Record<string, string> = {}

  return {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    setItem(key: string, value: string) {
      store[key] = String(value)
    },
    removeItem(key: string) {
      delete store[key]
    },
    clear() {
      store = {}
    },
  }
}

if (typeof window !== 'undefined') {
  const localStorageValue = window.localStorage
  if (!localStorageValue || typeof localStorageValue.clear !== 'function') {
    Object.defineProperty(window, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true,
    })
  }

  Object.defineProperty(window, 'alert', {
    value: () => {},
    configurable: true,
  })
}

beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear()
  }
})

vi.stubEnv('VITE_DISABLE_LIVE_AUDIO', 'true')
vi.stubEnv('VITE_API_BASE_URL', '')
