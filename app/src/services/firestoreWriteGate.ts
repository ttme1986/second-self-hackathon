const ACTIVE_SESSION_KEY = 'second-self:active-session'

let _deferring = false

export function startDeferring() {
  _deferring = true
  try { localStorage.setItem(ACTIVE_SESSION_KEY, Date.now().toString()) } catch {}
}

export function stopDeferring() {
  _deferring = false
  try { localStorage.removeItem(ACTIVE_SESSION_KEY) } catch {}
}

export function isDeferring(): boolean {
  return _deferring
}

export function hasUncommittedSession(): boolean {
  try { return !!localStorage.getItem(ACTIVE_SESSION_KEY) } catch { return false }
}
