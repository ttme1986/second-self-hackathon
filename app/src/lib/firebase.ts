import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithEmailAndPassword, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const isAuthDisabled = () => import.meta.env.VITE_DISABLE_AUTH === 'true'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

// In e2e/unit test contexts we don't want Firebase bootstrapping (and it
// can crash the app if env vars aren't set).
let auth: Auth | null = null
let googleProvider: GoogleAuthProvider | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null

if (!isAuthDisabled()) {
  try {
    auth = getAuth(app)
    googleProvider = new GoogleAuthProvider()
    db = getFirestore(app)
    storage = getStorage(app)
  } catch (error) {
    console.error('Failed to initialize Firebase services:', error)
  }
}

export { app, auth, googleProvider, db, storage, signInWithEmailAndPassword }
export type { FirebaseApp, Auth, Firestore, FirebaseStorage }
