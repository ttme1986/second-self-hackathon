import { describe, expect, it } from 'vitest'
import admin from 'firebase-admin'

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON')
  }
}

function getAdminApp() {
  const existing = admin.apps[0]
  if (existing) return existing

  const serviceAccount = getServiceAccount()
  if (!serviceAccount) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON')
  }

  const storageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET
  if (!storageBucket) {
    throw new Error('Missing VITE_FIREBASE_STORAGE_BUCKET')
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket,
  })
}

const hasServiceAccount = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)

describe('Firestore service layer (integration)', () => {
  const uid = 'integration-test-user'
  const testPrefix = `it-${Date.now()}`

  ;(hasServiceAccount ? it : it.skip)('can upsert and retrieve a claim document', async () => {
    getAdminApp()
    const db = admin.firestore()

    const claimId = `${testPrefix}-claim`
    const claimRef = db.doc(`users/${uid}/claims/${claimId}`)

    try {
      // Create claim
      await claimRef.set({
        id: claimId,
        text: 'User prefers morning workouts',
        category: 'preferences',
        confidence: 0.8,
        evidence: ['Mentioned going to gym at 6am'],
        status: 'inferred',
        conversationId: `${testPrefix}-conv`,
        embedding: [0.1, 0.2, 0.3],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      const snap = await claimRef.get()
      expect(snap.exists).toBe(true)

      const data = snap.data()
      expect(data?.text).toBe('User prefers morning workouts')
      expect(data?.category).toBe('preferences')
      expect(data?.confidence).toBe(0.8)
      expect(data?.status).toBe('inferred')
      expect(Array.isArray(data?.embedding)).toBe(true)

      // Update claim (upsert)
      await claimRef.set(
        {
          confidence: 0.9,
          status: 'confirmed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )

      const updatedSnap = await claimRef.get()
      const updatedData = updatedSnap.data()
      expect(updatedData?.confidence).toBe(0.9)
      expect(updatedData?.status).toBe('confirmed')
      // Original fields should be preserved
      expect(updatedData?.text).toBe('User prefers morning workouts')
    } finally {
      await claimRef.delete().catch(() => {})
    }
  })

  ;(hasServiceAccount ? it : it.skip)('can upsert and retrieve an action document', async () => {
    getAdminApp()
    const db = admin.firestore()

    const actionId = `${testPrefix}-action`
    const actionRef = db.doc(`users/${uid}/actions/${actionId}`)

    try {
      await actionRef.set({
        id: actionId,
        title: 'Schedule gym session',
        dueWindow: 'Today',
        source: 'conversation',
        reminder: true,
        status: 'suggested',
        conversationId: `${testPrefix}-conv`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      const snap = await actionRef.get()
      expect(snap.exists).toBe(true)

      const data = snap.data()
      expect(data?.title).toBe('Schedule gym session')
      expect(data?.dueWindow).toBe('Today')
      expect(data?.status).toBe('suggested')
      expect(data?.reminder).toBe(true)

      // Update status to accepted
      await actionRef.set(
        {
          status: 'accepted',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )

      const updatedSnap = await actionRef.get()
      expect(updatedSnap.data()?.status).toBe('accepted')
    } finally {
      await actionRef.delete().catch(() => {})
    }
  })

  ;(hasServiceAccount ? it : it.skip)('can append claims to a conversation', async () => {
    getAdminApp()
    const db = admin.firestore()

    const conversationId = `${testPrefix}-conv`
    const convRef = db.doc(`users/${uid}/conversations/${conversationId}`)

    try {
      // Create conversation
      await convRef.set({
        id: conversationId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Append first claim
      await convRef.update({
        claimIds: admin.firestore.FieldValue.arrayUnion('claim-1'),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Append second claim
      await convRef.update({
        claimIds: admin.firestore.FieldValue.arrayUnion('claim-2'),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      const snap = await convRef.get()
      const data = snap.data()
      expect(data?.claimIds).toContain('claim-1')
      expect(data?.claimIds).toContain('claim-2')
      expect(data?.claimIds.length).toBe(2)
    } finally {
      await convRef.delete().catch(() => {})
    }
  })

  ;(hasServiceAccount ? it : it.skip)('can create and retrieve a review queue item', async () => {
    getAdminApp()
    const db = admin.firestore()

    const reviewId = `${testPrefix}-review`
    const reviewRef = db.doc(`users/${uid}/reviewQueue/${reviewId}`)

    try {
      await reviewRef.set({
        id: reviewId,
        title: 'Potential conflict detected',
        summary: 'User said they prefer morning workouts but also mentioned hating early alarms',
        claimIds: ['claim-1', 'claim-2'],
        conversationId: `${testPrefix}-conv`,
        status: 'pending',
        severity: 'medium',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      const snap = await reviewRef.get()
      expect(snap.exists).toBe(true)

      const data = snap.data()
      expect(data?.title).toBe('Potential conflict detected')
      expect(data?.status).toBe('pending')
      expect(data?.severity).toBe('medium')
      expect(data?.claimIds).toHaveLength(2)

      // Resolve the review
      await reviewRef.update({
        status: 'resolved',
        resolution: 'confirm-left',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      const resolvedSnap = await reviewRef.get()
      expect(resolvedSnap.data()?.status).toBe('resolved')
      expect(resolvedSnap.data()?.resolution).toBe('confirm-left')
    } finally {
      await reviewRef.delete().catch(() => {})
    }
  })

  ;(hasServiceAccount ? it : it.skip)('can query recent claims with limit', async () => {
    getAdminApp()
    const db = admin.firestore()

    const claimIds = [`${testPrefix}-claim-1`, `${testPrefix}-claim-2`, `${testPrefix}-claim-3`]
    const claimRefs = claimIds.map((id) => db.doc(`users/${uid}/claims/${id}`))

    try {
      // Create multiple claims
      await Promise.all(
        claimIds.map((id, idx) =>
          claimRefs[idx].set({
            id,
            text: `Test claim ${idx + 1}`,
            category: 'other',
            confidence: 0.5 + idx * 0.1,
            evidence: [],
            status: 'inferred',
            conversationId: `${testPrefix}-conv`,
            embedding: [idx * 0.1, idx * 0.2],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        )
      )

      // Query with limit
      const { query, collection, limit, getDocs } = await import('firebase-admin/firestore')
      const q = db.collection(`users/${uid}/claims`).limit(2)
      const snap = await q.get()

      expect(snap.docs.length).toBeLessThanOrEqual(2)
      snap.docs.forEach((doc) => {
        expect(doc.exists).toBe(true)
        expect(doc.data().text).toBeDefined()
      })
    } finally {
      await Promise.all(claimRefs.map((ref) => ref.delete().catch(() => {})))
    }
  })
})
