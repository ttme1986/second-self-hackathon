import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { withStore, ensureUserStore } from '../api/localStore'

type StoreRecord = Record<string, unknown>

type OpenLoop = {
  id: string
  title: string
  due: 'Today' | 'This Week' | 'This Month' | 'Everything else'
  source: 'suggested' | 'user' | 'conversation'
  sourceId?: string
  reminder: boolean
  done: boolean
}

type ProfileData = {
  displayName?: string
  email?: string | null
  photoURL?: string | null
  geoCapture?: boolean
  onboardingComplete?: boolean
}

/**
 * Fetch all documents from a subcollection and return as a Record
 */
async function fetchSubcollection(
  userId: string,
  collectionName: string
): Promise<Record<string, StoreRecord>> {
  if (!db) return {}

  try {
    const collectionRef = collection(db, 'users', userId, collectionName)
    const snapshot = await getDocs(collectionRef)

    const result: Record<string, StoreRecord> = {}
    snapshot.forEach((doc) => {
      result[doc.id] = { id: doc.id, ...doc.data() }
    })

    return result
  } catch (error) {
    console.warn(`Failed to fetch ${collectionName}:`, error)
    return {}
  }
}

/**
 * Derive openLoops from actions (actions are the source of truth)
 */
function deriveOpenLoopsFromActions(actions: Record<string, StoreRecord>): OpenLoop[] {
  const normalizeDue = (value: string): OpenLoop['due'] => {
    if (value === 'Today' || value === 'This Week' || value === 'This Month') return value
    return 'Everything else'
  }

  const normalizeSource = (value: string): OpenLoop['source'] => {
    if (value === 'suggested' || value === 'user' || value === 'conversation') return value
    return 'suggested'
  }

  return Object.values(actions).map((action) => ({
    id: action.id as string,
    title: (action.title as string) || '',
    due: normalizeDue((action.dueWindow as string) || ''),
    source: normalizeSource((action.source as string) || ''),
    sourceId: (action.conversationId as string) || undefined,
    reminder: (action.reminder as boolean) ?? false,
    done: action.status === 'done' || action.status === 'completed',
  }))
}

/**
 * Sync demo data from Firestore to localStorage for the demo user.
 * This loads pre-populated demo data when signing in with the demo account.
 *
 * Data is read from subcollections:
 * - users/{userId} - Profile fields
 * - users/{userId}/actions - Actions/follow-ups (source of truth for openLoops)
 * - users/{userId}/claims - Knowledge claims
 * - users/{userId}/conversations - Conversation history (displayed as "Memories" in UI)
 * - users/{userId}/goals - User goals
 * - users/{userId}/reviewQueue - Items to review
 *
 * Note: openLoops in localStorage is derived from actions (not stored separately in Firestore)
 * Note: insights are computed dynamically from claims, goals, and conversations (not stored)
 */
export async function syncDemoDataFromFirestore(userId: string): Promise<boolean> {
  if (!db) {
    console.warn('Firestore not initialized, skipping demo data sync')
    return false
  }

  try {
    // Get user profile document from Firestore
    const userDocRef = doc(db, 'users', userId)
    const userDoc = await getDoc(userDocRef)

    if (!userDoc.exists()) {
      console.log('No demo data found in Firestore for user:', userId)
      return false
    }

    const profileData = userDoc.data() as ProfileData

    // Fetch all subcollections in parallel
    const [
      actions,
      claims,
      conversations,
      goals,
      reviewQueue,
    ] = await Promise.all([
      fetchSubcollection(userId, 'actions'),
      fetchSubcollection(userId, 'claims'),
      fetchSubcollection(userId, 'conversations'),
      fetchSubcollection(userId, 'goals'),
      fetchSubcollection(userId, 'reviewQueue'),
    ])

    // Derive openLoops from actions (actions are the source of truth)
    const openLoops = deriveOpenLoopsFromActions(actions)

    // Sync to localStorage
    withStore((store) => {
      const userStore = ensureUserStore(store, userId)

      // Sync profile with correct structure
      userStore.profile = {
        uid: userId,
        displayName: profileData.displayName || 'Demo User',
        photoURL: profileData.photoURL ?? null,
        email: profileData.email ?? null,
        geoCapture: profileData.geoCapture ?? true,
        onboardingComplete: profileData.onboardingComplete ?? true,
      }
      console.log('Demo profile synced:', userStore.profile)

      // Sync subcollection data
      if (Object.keys(claims).length > 0) {
        userStore.claims = claims
      }
      if (Object.keys(goals).length > 0) {
        userStore.goals = goals
      }
      if (Object.keys(actions).length > 0) {
        userStore.actions = actions
      }
      if (Object.keys(conversations).length > 0) {
        userStore.conversations = conversations
      }
      if (Object.keys(reviewQueue).length > 0) {
        userStore.reviewQueue = reviewQueue
      }
    })

    // Sync openLoops to separate localStorage key (derived from actions)
    if (openLoops.length > 0) {
      window.localStorage.setItem('openLoops', JSON.stringify(openLoops))
    }

    console.log('Demo data synced successfully from Firestore subcollections')
    console.log(`  - actions: ${Object.keys(actions).length}`)
    console.log(`  - claims: ${Object.keys(claims).length}`)
    console.log(`  - conversations: ${Object.keys(conversations).length}`)
    console.log(`  - goals: ${Object.keys(goals).length}`)
    console.log(`  - openLoops: ${openLoops.length} (derived from actions)`)
    console.log(`  - reviewQueue: ${Object.keys(reviewQueue).length}`)
    console.log(`  - insights: computed dynamically (not stored)`)

    return true
  } catch (error) {
    console.error('Failed to sync demo data from Firestore:', error)
    return false
  }
}

