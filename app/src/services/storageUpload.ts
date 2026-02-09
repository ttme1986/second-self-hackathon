import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../lib/firebase'
import type { TranscriptTurn } from '../api/backend'

type UploadResult = {
  success: boolean
  transcriptUrl?: string
  attachmentUrls?: string[]
  photoUrls?: string[]
  error?: string
}

type SessionUploadData = {
  userId: string
  conversationId: string
  transcript: TranscriptTurn[]
  attachments?: File[]
  photos?: File[]
  location?: {
    latitude: number
    longitude: number
    timestamp: number
  }
}

/**
 * Uploads session data to Firebase Cloud Storage
 * Structure:
 *   users/{userId}/conversations/{conversationId}/
 *     - transcript.json
 *     - attachments/{filename}
 *     - photos/{filename}
 */
export async function uploadSessionData(data: SessionUploadData): Promise<UploadResult> {
  if (!storage) {
    return { success: false, error: 'Firebase Storage not initialized' }
  }

  const basePath = `users/${data.userId}/conversations/${data.conversationId}`
  const attachmentUrls: string[] = []
  const photoUrls: string[] = []

  try {
    // Upload transcript.json
    const transcriptRef = ref(storage, `${basePath}/transcript.json`)
    const transcriptBlob = new Blob([JSON.stringify(data.transcript, null, 2)], {
      type: 'application/json',
    })
    await uploadBytes(transcriptRef, transcriptBlob)
    const transcriptUrl = await getDownloadURL(transcriptRef)

    // Upload attachments
    if (data.attachments && data.attachments.length > 0) {
      for (const file of data.attachments) {
        const filename = `${Date.now()}-${file.name}`
        const attachmentRef = ref(storage, `${basePath}/attachments/${filename}`)
        await uploadBytes(attachmentRef, file)
        const url = await getDownloadURL(attachmentRef)
        attachmentUrls.push(url)
      }
    }

    // Upload photos
    if (data.photos && data.photos.length > 0) {
      for (const file of data.photos) {
        const filename = `${Date.now()}-${file.name}`
        const photoRef = ref(storage, `${basePath}/photos/${filename}`)
        await uploadBytes(photoRef, file)
        const url = await getDownloadURL(photoRef)
        photoUrls.push(url)
      }
    }

    return {
      success: true,
      transcriptUrl,
      attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
      photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    }
  } catch (error) {
    console.error('Failed to upload session data:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    }
  }
}

/**
 * Checks if Firebase Storage is available
 */
export function isStorageAvailable(): boolean {
  return storage !== null
}
