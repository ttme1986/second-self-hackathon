import type { BlackboardEvent, BlackboardTask } from './types'

type Listener = (event: BlackboardEvent) => void

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export class Blackboard {
  private listeners = new Set<Listener>()
  private queue: BlackboardTask[] = []
  private inFlight = new Map<string, BlackboardTask>()

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: BlackboardEvent) {
    this.listeners.forEach((listener) => listener(event))
  }

  enqueue<T extends Omit<BlackboardTask, 'id' | 'createdAt'>>(task: T): BlackboardTask {
    const full = {
      ...(task as unknown as object),
      id: createId('task'),
      createdAt: Date.now(),
    } as BlackboardTask
    this.queue.push(full)
    this.emit({ type: 'task.enqueued', task: full })
    return full
  }

  /** Take the next matching task (removes it from queue and marks inFlight). */
  take<T extends BlackboardTask>(predicate: (task: BlackboardTask) => task is T): T | null {
    const index = this.queue.findIndex(predicate)
    if (index < 0) return null
    const [task] = this.queue.splice(index, 1)
    this.inFlight.set(task.id, task)
    this.emit({ type: 'task.started', task })
    return task as T
  }

  complete(task: BlackboardTask) {
    if (this.inFlight.has(task.id)) {
      this.inFlight.delete(task.id)
    }
    this.emit({ type: 'task.completed', task })
  }

  fail(task: BlackboardTask, error: string) {
    if (this.inFlight.has(task.id)) {
      this.inFlight.delete(task.id)
    }
    this.emit({ type: 'task.failed', task, error })
  }

  get pendingCount() {
    return this.queue.length
  }

  get inFlightCount() {
    return this.inFlight.size
  }

  /** Resolve when queue + inFlight are empty, or timeout. */
  async drain(timeoutMs = 8000) {
    const start = Date.now()
    if (this.pendingCount === 0 && this.inFlightCount === 0) return

    await new Promise<void>((resolve) => {
      let resolved = false
      const cleanup = () => {
        if (resolved) return
        resolved = true
        unsub()
        clearInterval(intervalId)
        resolve()
      }

      const check = () => {
        if (this.pendingCount === 0 && this.inFlightCount === 0) {
          cleanup()
        } else if (Date.now() - start > timeoutMs) {
          cleanup()
        }
      }

      const unsub = this.subscribe(check)
      // Also check periodically in case no events are emitted
      const intervalId = setInterval(check, 100)
    })
  }
}
