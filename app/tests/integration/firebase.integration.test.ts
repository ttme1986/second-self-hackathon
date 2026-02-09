import { describe, expect, it } from 'vitest'
import admin from 'firebase-admin'

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON')
  }
}

function getAdminApp() {
  const existing = admin.apps[0]
  if (existing) return existing

  const serviceAccount = getServiceAccount()
  if (!serviceAccount) {
    throw new Error(
      [
        'Missing FIREBASE_SERVICE_ACCOUNT_JSON.',
        'Provide a service account JSON string via env (not committed) so integration tests can use Admin SDK.',
      ].join(' '),
    )
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

describe('Firebase (integration)', () => {
  ;(hasServiceAccount ? it : it.skip)('can write/read/delete a Firestore document (generic)', async () => {
    getAdminApp()
    const db = admin.firestore()

    const docId = `it-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const ref = db.collection('integration_tests').doc(docId)

    try {
      await ref.set({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        hello: 'world',
      })

      const snap = await ref.get()
      expect(snap.exists).toBe(true)
      expect(snap.data()?.hello).toBe('world')
    } finally {
      await ref.delete().catch(() => {})
    }
  })

  ;(hasServiceAccount ? it : it.skip)('can upload/check/delete a Cloud Storage object', async () => {
    getAdminApp()

    const bucket = admin.storage().bucket()
    const objectPath = `integration_tests/${Date.now()}-${Math.random().toString(16).slice(2)}.txt`
    const file = bucket.file(objectPath)

    try {
      await file.save(Buffer.from('hello integration'), {
        contentType: 'text/plain',
        resumable: false,
      })

      const [exists] = await file.exists()
      expect(exists).toBe(true)
    } finally {
      await file.delete({ ignoreNotFound: true }).catch(() => {})
    }
  })
})
