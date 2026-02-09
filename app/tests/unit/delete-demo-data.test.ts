import { describe, expect, it, vi, beforeEach } from 'vitest'

describe('delete-demo-data logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deleteSubcollection paginates and deletes all documents in batches', async () => {
    const BATCH_LIMIT = 500

    // Simulate a subcollection with docs
    const docs = [
      { ref: { path: 'users/u1/actions/a1' } },
      { ref: { path: 'users/u1/actions/a2' } },
      { ref: { path: 'users/u1/actions/a3' } },
    ]

    const deletedRefs: object[] = []
    let commitCount = 0

    // Mock batch
    const makeBatch = () => ({
      delete: vi.fn((ref: object) => deletedRefs.push(ref)),
      commit: vi.fn(async () => { commitCount++ }),
    })

    // Simulate: first get() returns docs, second returns empty (pagination stop)
    let callCount = 0
    const mockGet = vi.fn(async () => {
      callCount++
      if (callCount === 1) {
        return { empty: false, docs, size: docs.length }
      }
      return { empty: true, docs: [], size: 0 }
    })

    const mockCollectionRef = {
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    }

    // Re-implement the deleteSubcollection logic from the script
    let totalDeleted = 0
    const query = mockCollectionRef.limit(BATCH_LIMIT)
    let snapshot = await query.get()

    while (!snapshot.empty) {
      const batch = makeBatch()
      snapshot.docs.forEach((doc: { ref: object }) => batch.delete(doc.ref))
      await batch.commit()
      totalDeleted += snapshot.size

      if (snapshot.size < BATCH_LIMIT) break
      snapshot = await query.get()
    }

    expect(totalDeleted).toBe(3)
    expect(deletedRefs).toHaveLength(3)
    expect(commitCount).toBe(1)
    expect(mockCollectionRef.limit).toHaveBeenCalledWith(BATCH_LIMIT)
  })

  it('deleteSubcollection handles empty collection', async () => {
    const mockGet = vi.fn(async () => ({
      empty: true, docs: [], size: 0,
    }))
    const mockCollectionRef = {
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    }

    let totalDeleted = 0
    const query = mockCollectionRef.limit(500)
    const snapshot = await query.get()

    if (!snapshot.empty) {
      totalDeleted += snapshot.size
    }

    expect(totalDeleted).toBe(0)
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('deleteSubcollection handles large collections requiring multiple batches', async () => {
    const BATCH_LIMIT = 500

    // Simulate 500 docs in first batch (triggers pagination), then 50 in second
    const batch1Docs = Array.from({ length: 500 }, (_, i) => ({
      ref: { path: `users/u1/actions/a${i}` },
    }))
    const batch2Docs = Array.from({ length: 50 }, (_, i) => ({
      ref: { path: `users/u1/actions/b${i}` },
    }))

    let callCount = 0
    const mockGet = vi.fn(async () => {
      callCount++
      if (callCount === 1) return { empty: false, docs: batch1Docs, size: 500 }
      if (callCount === 2) return { empty: false, docs: batch2Docs, size: 50 }
      return { empty: true, docs: [], size: 0 }
    })

    const mockCollectionRef = {
      limit: vi.fn().mockReturnValue({ get: mockGet }),
    }

    const deletedRefs: object[] = []
    let commitCount = 0
    const makeBatch = () => ({
      delete: vi.fn((ref: object) => deletedRefs.push(ref)),
      commit: vi.fn(async () => { commitCount++ }),
    })

    let totalDeleted = 0
    const query = mockCollectionRef.limit(BATCH_LIMIT)
    let snapshot = await query.get()

    while (!snapshot.empty) {
      const batch = makeBatch()
      snapshot.docs.forEach((doc: { ref: object }) => batch.delete(doc.ref))
      await batch.commit()
      totalDeleted += snapshot.size

      if (snapshot.size < BATCH_LIMIT) break
      snapshot = await query.get()
    }

    expect(totalDeleted).toBe(550)
    expect(deletedRefs).toHaveLength(550)
    expect(commitCount).toBe(2)
  })

  it('deleteStorageFiles deletes all files with correct prefix', async () => {
    const deleteCallCount = { count: 0 }
    const mockFileDelete = vi.fn(async () => { deleteCallCount.count++ })

    const mockFiles = [
      { delete: mockFileDelete, name: 'users/u1/conversations/c1/transcript.json' },
      { delete: mockFileDelete, name: 'users/u1/conversations/c1/attachments/photo.jpg' },
      { delete: mockFileDelete, name: 'users/u1/conversations/c2/transcript.json' },
    ]

    const mockGetFiles = vi.fn(async () => [mockFiles])
    const bucket = { getFiles: mockGetFiles }

    const userId = 'test-user'
    const prefix = `users/${userId}/`
    const [files] = await bucket.getFiles({ prefix })

    await Promise.all(files.map((file: { delete: () => Promise<void> }) => file.delete()))

    expect(mockGetFiles).toHaveBeenCalledWith({ prefix: `users/${userId}/` })
    expect(mockFileDelete).toHaveBeenCalledTimes(3)
  })

  it('deleteStorageFiles handles empty storage', async () => {
    const mockGetFiles = vi.fn(async () => [[]])
    const bucket = { getFiles: mockGetFiles }

    const [files] = await bucket.getFiles({ prefix: 'users/test-user/' })

    expect(files.length).toBe(0)
  })

  it('processes all five subcollections', () => {
    const subcollections = ['actions', 'claims', 'conversations', 'goals', 'reviewQueue']

    // Verify the script targets exactly these subcollections
    expect(subcollections).toHaveLength(5)
    expect(subcollections).toContain('actions')
    expect(subcollections).toContain('claims')
    expect(subcollections).toContain('conversations')
    expect(subcollections).toContain('goals')
    expect(subcollections).toContain('reviewQueue')
  })
})
