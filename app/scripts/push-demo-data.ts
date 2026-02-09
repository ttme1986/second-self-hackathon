/**
 * Push demo data to Firestore using subcollection structure
 *
 * Usage: npx tsx scripts/push-demo-data.ts
 *
 * Data Structure:
 * users/{userId} - Profile fields (displayName, email, geoCapture, etc.)
 *   /actions/{actionId} - User actions/follow-ups (source of truth for openLoops in UI)
 *   /claims/{claimId} - Knowledge claims
 *   /conversations/{conversationId} - Conversation history (displayed as "Memories" in UI)
 *   /goals/{goalId} - User goals
 *   /reviewQueue/{reviewId} - Items to review
 *
 * Note: openLoops in the UI is derived from actions (not stored separately)
 * Note: insights are computed dynamically from claims, goals, and conversations (not stored)
 *
 * Prerequisites:
 * 1. Create demo user in Firebase Console: demo@example.com / example1234
 * 2. Set DEMO_USER_ID environment variable to the demo user's UID
 * 3. Set up Firebase Admin SDK credentials
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.resolve(__dirname, '../.env') })

// Get the demo user ID from environment or use placeholder
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

type DemoData = {
  profile?: Record<string, unknown>
  actions?: Record<string, Record<string, unknown>>
  claims?: Record<string, Record<string, unknown>>
  conversations?: Record<string, Record<string, unknown>>
  goals?: Record<string, Record<string, unknown>>
  reviewQueue?: Record<string, Record<string, unknown>>
  insights?: Record<string, Record<string, unknown>>
  attachments?: Record<string, Record<string, unknown>>
}

async function pushSubcollection(
  userRef: FirebaseFirestore.DocumentReference,
  collectionName: string,
  data: Record<string, Record<string, unknown>> | undefined
): Promise<number> {
  if (!data || Object.keys(data).length === 0) {
    return 0
  }

  const batch = db.batch()
  let count = 0

  for (const [docId, docData] of Object.entries(data)) {
    const docRef = userRef.collection(collectionName).doc(docId)
    batch.set(docRef, {
      ...docData,
      updatedAt: new Date().toISOString(),
    })
    count++
  }

  await batch.commit()
  return count
}

async function clearSubcollections(userRef: FirebaseFirestore.DocumentReference) {
  const subcollections = [
    'actions',
    'claims',
    'conversations',
    'goals',
    'reviewQueue',
  ]

  for (const collectionName of subcollections) {
    const snapshot = await userRef.collection(collectionName).get()
    if (snapshot.empty) continue

    const batch = db.batch()
    snapshot.docs.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
    console.log(`  Cleared ${snapshot.size} documents from ${collectionName}`)
  }
}

async function uploadTranscripts(userId: string, conversations: Record<string, Record<string, unknown>> | undefined): Promise<number> {
  if (!conversations || Object.keys(conversations).length === 0) {
    return 0
  }

  const dataDir = path.resolve(__dirname, '../../demo/data')
  let count = 0

  for (const [convId, convData] of Object.entries(conversations)) {
    const transcriptPath = convData.transcriptPath as string
    if (!transcriptPath) continue

    const localTranscriptPath = path.join(dataDir, convId, 'transcript.json')

    if (!fs.existsSync(localTranscriptPath)) {
      console.warn(`  Warning: Transcript file not found: ${localTranscriptPath}`)
      continue
    }

    const transcriptContent = fs.readFileSync(localTranscriptPath)
    const storagePath = `users/${userId}/conversations/${convId}/transcript.json`

    await storage.file(storagePath).save(transcriptContent, {
      contentType: 'application/json',
      metadata: {
        conversationId: convId,
        uploadedAt: new Date().toISOString(),
      },
    })

    count++
  }

  return count
}

async function uploadAttachments(userId: string, attachments: Record<string, Record<string, unknown>> | undefined): Promise<number> {
  if (!attachments || Object.keys(attachments).length === 0) {
    return 0
  }

  const attachmentsDir = path.resolve(__dirname, '../../demo/data/attachments')

  // Create attachments directory if it doesn't exist
  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true })
    console.warn('  Warning: Attachments directory created but empty. Please add attachment files.')
    return 0
  }

  let count = 0

  for (const [attachmentId, attachmentData] of Object.entries(attachments)) {
    const filename = attachmentData.filename as string
    const conversationId = attachmentData.conversationId as string
    const type = attachmentData.type as string

    if (!filename || !conversationId) continue

    const localAttachmentPath = path.join(attachmentsDir, filename)

    if (!fs.existsSync(localAttachmentPath)) {
      console.warn(`  Warning: Attachment file not found: ${localAttachmentPath}`)
      continue
    }

    const attachmentContent = fs.readFileSync(localAttachmentPath)
    const storagePath = `users/${userId}/conversations/${conversationId}/attachments/${filename}`

    // Determine content type based on file extension
    let contentType = 'application/octet-stream'
    if (filename.endsWith('.pdf')) {
      contentType = 'application/pdf'
    } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      contentType = 'image/jpeg'
    } else if (filename.endsWith('.png')) {
      contentType = 'image/png'
    }

    await storage.file(storagePath).save(attachmentContent, {
      contentType,
      metadata: {
        conversationId,
        attachmentId,
        type,
        uploadedAt: new Date().toISOString(),
      },
    })

    count++
  }

  return count
}

async function pushDemoData() {
  // Run delete-demo-data first to clean Firestore + Storage
  console.log('Deleting existing demo data...')
  try {
    const deleteScript = path.resolve(__dirname, 'delete-demo-data.ts')
    if (process.platform === 'win32') {
      execFileSync(process.env.ComSpec || 'cmd.exe', [
        '/c', 'npx', 'tsx', deleteScript,
      ], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit', timeout: 60000 })
    } else {
      execFileSync('npx', [
        'tsx', deleteScript,
      ], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit', timeout: 60000 })
    }
    console.log('Demo data deleted\n')
  } catch (err) {
    console.warn(`  Warning: delete-demo-data failed (${(err as Error).message}). Falling back to clearSubcollections.\n`)
  }

  console.log('Loading demo data...')

  const dataPath = path.resolve(__dirname, '../../demo/data.json')
  const demoData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as DemoData

  console.log(`Pushing demo data for user: ${DEMO_USER_ID}`)

  const userRef = db.collection('users').doc(DEMO_USER_ID!)

  // Clear existing subcollections (belt-and-suspenders with delete-demo-data above)
  console.log('\nClearing existing data...')
  await clearSubcollections(userRef)

  // Push user profile document (top-level fields only)
  console.log('\nPushing profile...')
  const profileData = demoData.profile || {}
  await userRef.set({
    uid: DEMO_USER_ID,
    displayName: profileData.displayName || 'Demo User',
    email: profileData.email || 'demo@example.com',
    geoCapture: profileData.geoCapture ?? true,
    onboardingComplete: profileData.onboardingComplete ?? true,
    photoURL: profileData.photoURL || null,
    updatedAt: new Date().toISOString(),
  })

  // Push subcollections
  console.log('\nPushing subcollections...')

  const results = {
    actions: await pushSubcollection(userRef, 'actions', demoData.actions),
    claims: await pushSubcollection(userRef, 'claims', demoData.claims),
    conversations: await pushSubcollection(userRef, 'conversations', demoData.conversations),
    goals: await pushSubcollection(userRef, 'goals', demoData.goals),
    reviewQueue: await pushSubcollection(userRef, 'reviewQueue', demoData.reviewQueue),
    insights: await pushSubcollection(userRef, 'insights', demoData.insights),
  }

  // Upload transcripts to Firebase Storage
  console.log('\nUploading transcripts to Storage...')
  const transcriptCount = await uploadTranscripts(DEMO_USER_ID, demoData.conversations)

  // Upload attachments to Firebase Storage
  console.log('\nUploading attachments to Storage...')
  const attachmentCount = await uploadAttachments(DEMO_USER_ID, demoData.attachments)

  console.log('\nDemo data pushed successfully!')
  console.log('\nData structure:')
  console.log(`- profile: ${Object.keys(profileData).length} fields`)
  console.log(`- actions: ${results.actions} documents (source of truth for Follow-ups/openLoops in UI)`)
  console.log(`- claims: ${results.claims} documents`)
  console.log(`- conversations: ${results.conversations} documents (displayed as "Memories" in UI)`)
  console.log(`- goals: ${results.goals} documents`)
  console.log(`- reviewQueue: ${results.reviewQueue} documents`)
  console.log(`- insights: ${results.insights} documents`)
  console.log(`- transcripts: ${transcriptCount} files uploaded to Storage`)
  console.log(`- attachments: ${attachmentCount} files uploaded to Storage`)
}

pushDemoData().catch((error) => {
  console.error('Failed to push demo data:', error)
  process.exit(1)
})
