import { getFirestore, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'
import type { FirebaseApp } from 'firebase/app'
import { app } from '../lib/firebase'
import { isDeferring } from './firestoreWriteGate'

export type StoredClaim = {
  id: string
  text: string
  category: string
  confidence: number
  evidence: string[]
  status: 'inferred' | 'confirmed' | 'rejected'
  conversationId: string
  embedding: number[]
  pinned?: boolean
  createdAt?: any
  updatedAt?: any
}

export type StoredAction = {
  id: string
  title: string
  dueWindow: string
  source: string
  reminder: boolean
  status: 'suggested' | 'accepted' | 'dismissed'
  conversationId: string
  createdAt?: any
  updatedAt?: any
}

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

const db = () => getFirestore(app as FirebaseApp)

export async function upsertClaim(uid: string, claim: Omit<StoredClaim, 'id'> & { id?: string }) {
  const id = claim.id || createId('claim')
  await setDoc(doc(db(), `users/${uid}/claims/${id}`), { ...claim, id, updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true })
  return id
}

export async function appendConversationClaim(uid: string, conversationId: string, claimId: string) {
  await setDoc(doc(db(), `users/${uid}/conversations/${conversationId}`), { id: conversationId }, { merge: true })
  await updateDoc(doc(db(), `users/${uid}/conversations/${conversationId}`), { claimIds: arrayUnion(claimId), updatedAt: serverTimestamp() })
}

export async function upsertAction(uid: string, action: Omit<StoredAction, 'id'> & { id?: string }) {
  const id = action.id || createId('action')
  await setDoc(doc(db(), `users/${uid}/actions/${id}`), { ...action, id, updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true })
  return id
}

export async function appendConversationAction(uid: string, conversationId: string, actionId: string) {
  await setDoc(doc(db(), `users/${uid}/conversations/${conversationId}`), { id: conversationId }, { merge: true })
  await updateDoc(doc(db(), `users/${uid}/conversations/${conversationId}`), { actionIds: arrayUnion(actionId), updatedAt: serverTimestamp() })
}

export function syncDoc(path: string, data: Record<string, unknown>) {
  if (isDeferring()) return
  try {
    void setDoc(doc(db(), path), { ...data, updatedAt: serverTimestamp() }, { merge: true })
  } catch (e) {
    console.warn('[syncDoc] failed:', path, e)
  }
}

export function deleteDocument(path: string) {
  if (isDeferring()) return
  try {
    void deleteDoc(doc(db(), path))
  } catch (e) {
    console.warn('[deleteDocument] failed:', path, e)
  }
}
