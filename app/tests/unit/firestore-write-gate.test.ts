import { afterEach, describe, expect, it } from 'vitest'
import {
  startDeferring,
  stopDeferring,
  isDeferring,
  hasUncommittedSession,
} from '../../src/services/firestoreWriteGate'

describe('firestoreWriteGate', () => {
  afterEach(() => {
    stopDeferring()
  })

  it('isDeferring returns false by default', () => {
    expect(isDeferring()).toBe(false)
  })

  it('startDeferring causes isDeferring to return true', () => {
    startDeferring()
    expect(isDeferring()).toBe(true)
  })

  it('stopDeferring causes isDeferring to return false', () => {
    startDeferring()
    expect(isDeferring()).toBe(true)
    stopDeferring()
    expect(isDeferring()).toBe(false)
  })

  it('hasUncommittedSession returns true after startDeferring', () => {
    startDeferring()
    expect(hasUncommittedSession()).toBe(true)
  })

  it('hasUncommittedSession returns false after stopDeferring', () => {
    startDeferring()
    stopDeferring()
    expect(hasUncommittedSession()).toBe(false)
  })

  it('hasUncommittedSession returns false when no session started', () => {
    expect(hasUncommittedSession()).toBe(false)
  })
})
