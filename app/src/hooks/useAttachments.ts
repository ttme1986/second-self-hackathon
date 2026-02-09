import { useCallback, useEffect, useRef, useState } from 'react'
import { trackEvent } from '../lib/analytics'

export type Attachment = {
  id: string
  file: File
  previewUrl: string
  type: 'image' | 'document' | 'other'
}

export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentsRef = useRef<Attachment[]>([])

  // Keep attachments ref in sync with state
  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      })
    }
  }, [])

  const handleFileButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const newAttachments: Attachment[] = Array.from(files).map((file) => {
      const isImage = file.type.startsWith('image/')
      const isDocument = file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text')
      return {
        id: `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : '',
        type: isImage ? 'image' : isDocument ? 'document' : 'other',
      }
    })

    setAttachments((prev) => [...prev, ...newAttachments])
    void trackEvent('file_attached', { count: files.length, types: newAttachments.map((a) => a.type).join(',') })

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === attachmentId)
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl)
      }
      return prev.filter((a) => a.id !== attachmentId)
    })
  }, [])

  const handleCameraCapture = useCallback((file: File) => {
    const newPhoto: Attachment = {
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      type: 'image' as const,
    }

    setAttachments((prev) => [...prev, newPhoto])
    void trackEvent('photo_captured', { count: 1 })
  }, [])

  return {
    attachments,
    setAttachments,
    attachmentsRef,
    cameraOpen,
    setCameraOpen,
    fileInputRef,
    handleFileButtonClick,
    handleFileSelect,
    handleRemoveAttachment,
    handleCameraCapture,
  }
}
