import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadStore, withStore, clearStore, ensureUserStore } from '../../src/api/localStore'

describe('Local store offline resilience', () => {
  beforeEach(() => {
    vi.resetModules()
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
    clearStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('gracefully handles localStorage write errors', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded')
    })

    try {
        withStore((store) => {
            // Need to ensure user exists to pass the heuristic for preferring memory store
            store.users['u1'] = { conversations: {} }
            store.moments['m1'] = { id: 'm1' }
        })
    } finally {
        setItemSpy.mockRestore()
    }

    const current = loadStore()
    expect(current.moments['m1']).toBeDefined()
    expect(consoleSpy).toHaveBeenCalledWith('Failed to save to localStorage', expect.any(Error))
  })

  it('reads from disk if available', () => {
    const data = {
        version: 1,
        users: { 'u1': {} },
        moments: { 'disk-moment': { id: 'disk-moment' } },
        openLoops: {},
        uploads: {}
    }
    
    // Write directly using the standard API (JSDOM supports this)
    // beforeEach has already cleared store, so memoryStore is default (empty).
    window.localStorage.setItem('secondSelfStore', JSON.stringify(data))
    
    const loaded = loadStore()
    expect(loaded.moments['disk-moment']).toBeDefined()
  })
})
