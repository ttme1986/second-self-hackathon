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
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON (see tests/integration/README.md)')
  }

  const storageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET
  if (!storageBucket) {
    throw new Error('Missing VITE_FIREBASE_STORAGE_BUCKET (expected in app/.env.local)')
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket,
  })
}

const hasServiceAccount = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)

describe('Firebase schema used by blackboard agents (integration)', () => {
  ;(hasServiceAccount ? it : it.skip)('can create and cleanup claim/action/reviewQueue docs under users/{uid}', async () => {
    getAdminApp()
    const db = admin.firestore()

    const uid = 'integration-user'
    const conversationId = `conv-${Date.now()}`
    const claimId = `claim-${Date.now()}`
    const actionId = `action-${Date.now()}`
    const reviewId = `review-${Date.now()}`

    const claimRef = db.doc(`users/${uid}/claims/${claimId}`)
    const actionRef = db.doc(`users/${uid}/actions/${actionId}`)
    const reviewRef = db.doc(`users/${uid}/reviewQueue/${reviewId}`)
    const convRef = db.doc(`users/${uid}/conversations/${conversationId}`)

    try {
      await convRef.set({ id: conversationId, createdAt: admin.firestore.FieldValue.serverTimestamp() })

      await claimRef.set({
        id: claimId,
        text: 'Prefers tea',
        category: 'preferences',
        confidence: 0.7,
        evidence: ['Prefers tea'],
        status: 'inferred',
        conversationId,
        embedding: [0.1, 0.2],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      await actionRef.set({
        id: actionId,
        title: 'Buy tea',
        dueWindow: 'Today',
        source: 'conversation',
        reminder: false,
        status: 'suggested',
        conversationId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      await reviewRef.set({
        id: reviewId,
        title: 'Potential conflict detected',
        summary: 'test',
        claimIds: ['c-old', claimId],
        conversationId,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      const [claimSnap, actionSnap, reviewSnap] = await Promise.all([
        claimRef.get(),
        actionRef.get(),
        reviewRef.get(),
      ])

      expect(claimSnap.exists).toBe(true)
      expect(actionSnap.exists).toBe(true)
      expect(reviewSnap.exists).toBe(true)
    } finally {
      await Promise.all([
        claimRef.delete().catch(() => {}),
        actionRef.delete().catch(() => {}),
        reviewRef.delete().catch(() => {}),
        convRef.delete().catch(() => {}),
      ])
    }
  })
})
