/**
 * Delete demo data from Firestore and Firebase Storage
 *
 * Usage: npx tsx scripts/delete-demo-data.ts
 *
 * Deletes all documents from subcollections under users/{userId}:
 *   /actions, /claims, /conversations, /goals, /reviewQueue
 *
 * Deletes all files under users/{userId}/ in Firebase Storage.
 *
 * Does NOT delete the users/{userId} profile document itself.
 *
 * Prerequisites:
 * 1. Set DEMO_USER_ID or VITE_DEMO_USER_ID environment variable
 * 2. Set up Firebase Admin SDK credentials
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.resolve(__dirname, '../.env') })

// Get the demo user ID from environment
const DEMO_USER_ID = process.env.VITE_DEMO_USER_ID || process.env.DEMO_USER_ID

if (!DEMO_USER_ID) {
  console.error('Error: DEMO_USER_ID or VITE_DEMO_USER_ID environment variable is required')
  console.log('\nTo get the demo user ID:')
  console.log('1. Create a user in Firebase Console with email: demo@example.com, password: example1234')
  console.log('2. Copy the UID from the Firebase Console')
  console.log('3. Set VITE_DEMO_USER_ID in your .env file')
  process.exit(1)
}

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(__dirname, '../../firebase/service-account.json')

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Error: Service account file not found at:', serviceAccountPath)
  console.log('\nTo set up Firebase Admin SDK:')
  console.log('1. Go to Firebase Console > Project Settings > Service Accounts')
  console.log('2. Generate a new private key')
  console.log('3. Save it as firebase/service-account.json')
  process.exit(1)
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8')) as ServiceAccount

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || serviceAccount.project_id + '.appspot.com',
})

const db = getFirestore()
const storage = getStorage().bucket()

const BATCH_LIMIT = 500

async function deleteSubcollection(
  userRef: FirebaseFirestore.DocumentReference,
  collectionName: string
): Promise<number> {
  let totalDeleted = 0
  const collectionRef = userRef.collection(collectionName)

  // Paginate through documents in batches of BATCH_LIMIT
  let query = collectionRef.limit(BATCH_LIMIT)
  let snapshot = await query.get()

  while (!snapshot.empty) {
    const batch = db.batch()
    snapshot.docs.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
    totalDeleted += snapshot.size

    // If we got fewer than BATCH_LIMIT, we're done
    if (snapshot.size < BATCH_LIMIT) break

    // Get next batch
    snapshot = await query.get()
  }

  return totalDeleted
}

async function deleteStorageFiles(userId: string): Promise<number> {
  const prefix = `users/${userId}/`
  const [files] = await storage.getFiles({ prefix })

  if (files.length === 0) return 0

  await Promise.all(files.map((file) => file.delete()))
  return files.length
}

async function deleteDemoData() {
  console.log(`Deleting demo data for user: ${DEMO_USER_ID}`)

  const userRef = db.collection('users').doc(DEMO_USER_ID!)

  // Delete Firestore subcollections
  const subcollections = ['actions', 'claims', 'conversations', 'goals', 'reviewQueue'] as const

  console.log('\nFirestore:')
  for (const collectionName of subcollections) {
    const count = await deleteSubcollection(userRef, collectionName)
    console.log(`  Deleted ${count} documents from ${collectionName}`)
  }

  // Delete Storage files
  console.log('\nStorage:')
  const fileCount = await deleteStorageFiles(DEMO_USER_ID!)
  console.log(`  Deleted ${fileCount} files from users/${DEMO_USER_ID}/`)

  console.log('\nProfile preserved.')
  console.log('Done!')
}

deleteDemoData().catch((error) => {
  console.error('Failed to delete demo data:', error)
  process.exit(1)
})
