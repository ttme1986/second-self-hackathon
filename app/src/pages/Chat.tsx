import { useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import { useOpenLoops } from '../openloops/OpenLoopsProvider'
import {
  confirmActions,
  commitSessionToFirestore,
  endConversation,
  hasBackend,
  analyzeImage,
  startConversation,
  getActiveConversation,
  getConversationTranscript,
  type TranscriptTurn,
  type GeoLocation,
} from '../api/backend'
import PermissionSelector from '../components/PermissionSelector'
import { useOptionalProfile } from '../profile/ProfileProvider'
import { trackEvent } from '../lib/analytics'
import { uploadSessionData, isStorageAvailable } from '../services/storageUpload'
import CameraViewfinder from '../components/CameraViewfinder'
import type { InferredClaim } from '../services/conversationRealtime'

import { useAttachments } from '../hooks/useAttachments'
import { useEmotionalTracking } from '../hooks/useEmotionalTracking'
import { useBlackboardPipeline } from '../hooks/useBlackboardPipeline'
import { useSuggestedActions } from '../hooks/useSuggestedActions'
import { useTranscript } from '../hooks/useTranscript'
import { useVoiceSession } from '../hooks/useVoiceSession'

import ChatHeader from '../components/chat/ChatHeader'
import ChatActionBar from '../components/chat/ChatActionBar'
import ChatRecapModal from '../components/chat/ChatRecapModal'
import ChatToolsDrawer from '../components/chat/ChatToolsDrawer'
import type { ToolConfig } from '../components/chat/ChatToolsDrawer'

const tools: ToolConfig[] = []

export default function Chat() {
  const navigate = useNavigate()
  const { addLoop } = useOpenLoops()
  const profileContext = useOptionalProfile()
  const profile = profileContext?.profile ?? null

  const [inferredClaims, setInferredClaims] = useState<InferredClaim[]>([])
  const [recapOpen, setRecapOpen] = useState(false)
  const [recapSessionStart, setRecapSessionStart] = useState<number | null>(null)
  const [recapSessionDuration, setRecapSessionDuration] = useState<number | null>(null)
  const [toolDrawerOpen, setToolDrawerOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<ToolConfig | null>(null)
  const [toolStep, setToolStep] = useState(0)
  const [toolAnswers, setToolAnswers] = useState<string[]>([])
  const [toolOutput, setToolOutput] = useState<ToolConfig['output'] | null>(null)
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [summary, setSummary] = useState('')
  const [noteText, setNoteText] = useState('')
  const [reviewItems, setReviewItems] = useState<Array<{ id: string; title: string; summary: string; severity?: string }>>([])
  const [visibleBannerClaim, setVisibleBannerClaim] = useState<InferredClaim | null>(null)
  const bannerTimerRef = useRef<number | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const sessionRestoredRef = useRef(false)

  // Hooks
  const { blackboardRef, initPipeline, stopPipeline } = useBlackboardPipeline()

  const {
    attachments,
    setAttachments,
    attachmentsRef,
    cameraOpen,
    setCameraOpen,
    fileInputRef,
    handleFileButtonClick,
    handleFileSelect,
    handleCameraCapture,
  } = useAttachments()

  const {
    emotionalStates,
    currentEmotion,
    emotionalSummary,
    detectEmotionFromText,
    computeSummary,
  } = useEmotionalTracking()

  const {
    userTranscript,
    setUserTranscript,
    assistantTranscript,
    setAssistantTranscript,
    assistantFinalRef,
    transcriptTurnsRef,
    userCaptionRef,
    assistantCaptionRef,
    handleTranscriptUpdate,
  } = useTranscript({
    blackboardRef,
    conversationIdRef,
    onUserFinalText: detectEmotionFromText,
  })

  const {
    pendingActionForPermission,
    setPendingActionForPermission,
    shownActions,
    remainingPendingCount,
    triggeredActions,
    untappedActions,
    dismissedActions,
    resolveEvidence,
    pushSuggestion,
    handleTapAction,
    handleDismissAction,
    handlePermissionSelected,
  } = useSuggestedActions({
    blackboardRef,
    conversationIdRef,
    transcriptTurnsRef,
    addLoop,
    profile: profile ? { displayName: profile.displayName, email: profile.email } : null,
  })

  // Helper to capture current location
  const captureLocation = useCallback((): Promise<GeoLocation | undefined> => {
    if (!profile?.geoCapture) return Promise.resolve(undefined)
    if (!navigator.geolocation) return Promise.resolve(undefined)

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: position.timestamp,
          })
        },
        () => {
          resolve(undefined)
        },
        { timeout: 5000, enableHighAccuracy: false }
      )
    })
  }, [profile?.geoCapture])

  const ensureConversationStarted = useCallback(async () => {
    let conversationId = conversationIdRef.current
    if (!conversationId) {
      conversationId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`
      conversationIdRef.current = conversationId

      const location = await captureLocation()

      if (hasBackend) await startConversation(conversationId, location)
    }

    initPipeline({
      onStoredClaim: (claim) => {
        const resolved = { ...claim, evidence: resolveEvidence(claim.evidence) }
        setInferredClaims((prev) => {
          const seen = new Set(prev.map((item) => item.text))
          if (seen.has(claim.text)) return prev
          return [...prev, resolved]
        })
        setVisibleBannerClaim(resolved)
        if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current)
        bannerTimerRef.current = window.setTimeout(() => {
          setVisibleBannerClaim(null)
          bannerTimerRef.current = null
        }, 10000)
      },
      onActionSuggested: ({ title, dueWindow, evidence }) => {
        pushSuggestion({ title, due: dueWindow, context: 'conversation', evidence })
      },
    })
  }, [captureLocation, initPipeline, resolveEvidence, pushSuggestion])

  const {
    isRecording,
    setIsRecording,
    isConnecting,
    hasUserGesture,
    setHasUserGesture,
    liveStatus,
    micDenied,
    setMicDenied,
    sessionStartRef,
    startVoiceSession,
    stopVoiceSession,
    sendTextToLive,
    initTextSession,
  } = useVoiceSession({
    handleTranscriptUpdate,
    assistantFinalRef,
    ensureConversationStarted,
    onStopAgents: stopPipeline,
    displayName: profile?.displayName,
  })

  // Restore active conversation on mount (once only)
  useEffect(() => {
    if (!hasBackend) return
    if (sessionRestoredRef.current) return
    sessionRestoredRef.current = true
    const restoreSession = async () => {
      const { data } = await getActiveConversation()
      if (data?.conversation) {
        const { id } = data.conversation
        conversationIdRef.current = id

        const transcriptRes = await getConversationTranscript(id)
        const turns = transcriptRes.data?.turns ?? []
        transcriptTurnsRef.current = turns

        const userText = turns
          .filter((t: TranscriptTurn) => t.speaker === 'user')
          .map((t: TranscriptTurn) => t.text)
          .join(' ')
        const assistantText = turns
          .filter((t: TranscriptTurn) => t.speaker === 'assistant')
          .map((t: TranscriptTurn) => t.text)
          .join(' ')

        setUserTranscript(userText)
        setAssistantTranscript(assistantText)

        void ensureConversationStarted()
      }
    }
    void restoreSession()
  }, [ensureConversationStarted, setUserTranscript, setAssistantTranscript, transcriptTurnsRef])

  // Auto-connect text session when voice is disabled (text-only mode)
  const disableLiveAudio = import.meta.env.VITE_DISABLE_LIVE_AUDIO === 'true'
  const textAutoStartRef = useRef(false)
  useEffect(() => {
    if (!profile?.displayName) return
    if (!disableLiveAudio) return
    if (textAutoStartRef.current) return
    textAutoStartRef.current = true
    const init = async () => {
      await ensureConversationStarted()
      try {
        await initTextSession()
      } catch (err) {
        console.error('Failed to auto-connect text session:', err)
      }
    }
    void init()
  }, [profile?.displayName, disableLiveAudio, ensureConversationStarted, initTextSession])

  // Time ticker
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => {
      window.clearInterval(interval)
    }
  }, [])

  // Cleanup banner timer on unmount
  useEffect(() => () => {
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current)
  }, [])

  // Immediately send attachments to Gemini Live API when added
  const lastAttachmentCountRef = useRef(0)

  useEffect(() => {
    const prevCount = lastAttachmentCountRef.current
    lastAttachmentCountRef.current = attachments.length
    if (attachments.length <= prevCount) return
    if (attachments.length === 0) return

    const sendAttachments = async () => {
      // Snapshot attachments BEFORE any await — the auto-dismiss effect can
      // clear attachmentsRef.current while we wait for ensureConversationStarted
      // or analyzeImage, causing us to silently lose the attachment data.
      const currentAttachments = [...attachmentsRef.current]
      const imageAttachments = currentAttachments.filter(a => a.type === 'image')
      if (imageAttachments.length === 0) return

      await ensureConversationStarted()

      console.log('[Attachment] Analyzing', imageAttachments.length, 'image(s)...')
      const imageDescriptions = await Promise.all(
        imageAttachments.map(async (attachment) => {
          try {
            const arrayBuffer = await attachment.file.arrayBuffer()
            const bytes = new Uint8Array(arrayBuffer)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
            const base64Data = btoa(binary)
            const mimeType = attachment.file.type || 'image/jpeg'
            console.log('[Attachment] Calling analyzeImage...')
            const result = await analyzeImage(base64Data, mimeType)
            console.log('[Attachment] analyzeImage result:', result.error ? `ERROR: ${result.error}` : `${(result.data?.description ?? '').length} chars`)
            return result.data?.description ?? ''
          } catch (err) {
            console.error('[Attachment] analyzeImage threw:', err)
            return ''
          }
        })
      )

      const validDescriptions = imageDescriptions.filter(d => d.length > 0)
      if (validDescriptions.length === 0) {
        console.warn('[Attachment] No valid descriptions — skipping send')
        return
      }

      const enrichedText = `[Attached image analysis:\n${validDescriptions.join('\n---\n')}]`
      console.log('[Attachment] Sending to Live API:', enrichedText.slice(0, 100) + '...')

      assistantFinalRef.current = true
      const turn: TranscriptTurn = { speaker: 'user', text: enrichedText, t_ms: Date.now() }
      transcriptTurnsRef.current = [...transcriptTurnsRef.current, turn]

      if (hasBackend && conversationIdRef.current) {
        void import('../api/backend').then(({ appendConversationTurn }) =>
          appendConversationTurn(conversationIdRef.current!, turn))
      }

      if (conversationIdRef.current && blackboardRef.current) {
        blackboardRef.current.enqueue({ type: 'turn.ingest', conversationId: conversationIdRef.current, turn })
      }

      try {
        await sendTextToLive(enrichedText)
        console.log('[Attachment] Successfully sent to Live API')
        // Signal for demo/test automation that the analysis was sent
        ;(window as unknown as Record<string, unknown>).__imageAnalysisSent = true
      } catch (err) {
        console.error('[Attachment] Failed to send to live session:', err)
      }
    }

    void sendAttachments()
  }, [attachments, ensureConversationStarted, attachmentsRef, assistantFinalRef, transcriptTurnsRef, blackboardRef, sendTextToLive])

  // Auto-dismiss attachments after AI responds
  const attachmentTurnCountRef = useRef<number | null>(null)

  useEffect(() => {
    if (attachments.length > 0 && attachmentTurnCountRef.current === null) {
      attachmentTurnCountRef.current = transcriptTurnsRef.current
        .filter(t => t.speaker === 'assistant').length
    }
    if (attachments.length === 0) {
      attachmentTurnCountRef.current = null
    }
  }, [attachments, transcriptTurnsRef])

  useEffect(() => {
    if (attachmentTurnCountRef.current === null) return
    const assistantTurns = transcriptTurnsRef.current
      .filter(t => t.speaker === 'assistant').length
    if (assistantTurns > attachmentTurnCountRef.current) {
      setAttachments([])
      attachmentTurnCountRef.current = null
    }
  }, [assistantTranscript, setAttachments, transcriptTurnsRef])

  const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  const formattedDate = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  const formattedTime = now.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  const elapsedSeconds =
    isRecording && sessionStartRef.current
      ? Math.max(0, Math.floor((now.getTime() - sessionStartRef.current) / 1000))
      : 0
  const formattedElapsed = formatDuration(elapsedSeconds)

  const toggleEvidence = useCallback((id: string) => {
    setExpandedEvidenceId((prev) => (prev === id ? null : id))
  }, [])

  const handleMic = async () => {
    if (!hasUserGesture) {
      setHasUserGesture(true)
    }
    if (!isRecording) {
      // Reset mic denied state when retrying
      if (micDenied) setMicDenied(false)
      sessionStartRef.current = Date.now()
      void trackEvent('voice_session_start')
      setIsRecording(true)
      try {
        await startVoiceSession()
      } catch (error) {
        const isMicDenied = error instanceof DOMException && error.name === 'NotAllowedError'
        if (isMicDenied) {
          console.warn('Microphone access denied')
          setMicDenied(true)
        } else {
          console.error('Failed to start voice session', error)
        }
        setIsRecording(false)
      }
      return
    }

    if (sessionStartRef.current) {
      void trackEvent('voice_session_stop', {
        duration_ms: Date.now() - sessionStartRef.current,
      })
      sessionStartRef.current = null
    }
    setIsRecording(false)
    await stopVoiceSession()
  }

  const handleSendNote = useCallback(async () => {
    const text = noteText.trim()
    if (!text) return

    await ensureConversationStarted()

    assistantFinalRef.current = true
    setUserTranscript(text)
    setNoteText('')

    const turn: TranscriptTurn = { speaker: 'user', text, t_ms: Date.now() }
    transcriptTurnsRef.current = [...transcriptTurnsRef.current, turn]

    if (hasBackend && conversationIdRef.current) {
      void import('../api/backend').then(({ appendConversationTurn }) =>
        appendConversationTurn(conversationIdRef.current!, turn),
      )
    }

    if (conversationIdRef.current && blackboardRef.current) {
      blackboardRef.current.enqueue({
        type: 'turn.ingest',
        conversationId: conversationIdRef.current,
        turn,
      })
    }

    try {
      await sendTextToLive(text)
    } catch (err) {
      console.error('Failed to send text to live session:', err)
    }
  }, [ensureConversationStarted, noteText, setUserTranscript, transcriptTurnsRef, blackboardRef, sendTextToLive])

  const handleHangup = async () => {
    const startTs = sessionStartRef.current
    const durationMs = startTs ? Date.now() - startTs : null
    if (isRecording && startTs) {
      void trackEvent('voice_session_stop', { duration_ms: durationMs! })
      sessionStartRef.current = null
    }
    setRecapSessionStart(startTs)
    setRecapSessionDuration(durationMs)
    setIsRecording(false)
    await stopVoiceSession()

    computeSummary()

    setRecapOpen(true)

    if (hasBackend && conversationIdRef.current && blackboardRef.current) {
      const bb = blackboardRef.current
      if (bb.pendingCount > 0 || bb.inFlightCount > 0) {
        bb.enqueue({
          type: 'conversation.finalize',
          conversationId: conversationIdRef.current,
        })
        await bb.drain(2000)
      }

      try {
        const { listReviewQueue } = await import('../api/backend')
        const reviewResult = await listReviewQueue('pending')
        setReviewItems(
          (reviewResult.data?.items ?? []).map((r: { id: string; title?: string; summary?: string; severity?: string }) => ({
            id: r.id,
            title: r.title ?? 'Conflict',
            summary: r.summary ?? '',
            severity: r.severity,
          }))
        )
      } catch (err) {
        console.error('Failed to fetch review queue:', err)
      }
    }

    if (hasBackend && conversationIdRef.current) {
      const result = await endConversation(
        conversationIdRef.current,
        transcriptTurnsRef.current,
        emotionalStates,
      )
      if (result.data?.summary) {
        setSummary(result.data.summary)
      }
    }

    if (isStorageAvailable() && profile?.uid && conversationIdRef.current) {
      const photos = attachmentsRef.current.filter((a) => a.type === 'image').map((a) => a.file)
      const otherFiles = attachmentsRef.current.filter((a) => a.type !== 'image').map((a) => a.file)

      void uploadSessionData({
        userId: profile.uid,
        conversationId: conversationIdRef.current,
        transcript: transcriptTurnsRef.current,
        attachments: otherFiles.length > 0 ? otherFiles : undefined,
        photos: photos.length > 0 ? photos : undefined,
      }).then((result) => {
        if (result.success) {
          void trackEvent('session_data_uploaded', {
            hasAttachments: (otherFiles.length > 0).toString(),
            hasPhotos: (photos.length > 0).toString(),
          })
        } else {
          console.error('Failed to upload session data:', result.error)
        }
      })

      setAttachments([])
    }
  }

  const handleRecapClose = async () => {
    setRecapOpen(false)
    if (hasBackend && conversationIdRef.current) {
      if (triggeredActions.length > 0) {
        await confirmActions(
          conversationIdRef.current,
          triggeredActions.map((item) => ({
            title: item.title,
            dueWindow: item.due,
            source: item.context,
            reminder: false,
          })),
        )
      }
      try {
        await commitSessionToFirestore(conversationIdRef.current)
      } catch (err) {
        console.warn('[recap] Failed to commit session to Firestore:', err)
      }
    }
    conversationIdRef.current = null
    navigate('/')
  }

  const handleGoToReflect = async () => {
    setRecapOpen(false)
    if (hasBackend && conversationIdRef.current) {
      if (triggeredActions.length > 0) {
        await confirmActions(
          conversationIdRef.current,
          triggeredActions.map((item) => ({
            title: item.title,
            dueWindow: item.due,
            source: item.context,
            reminder: false,
          })),
        )
      }
      try {
        await commitSessionToFirestore(conversationIdRef.current)
      } catch (err) {
        console.warn('[recap] Failed to commit session to Firestore:', err)
      }
    }
    conversationIdRef.current = null
    navigate('/reflect?tab=follow-ups')
  }

  const openToolDrawer = () => {
    setToolDrawerOpen(true)
    setActiveTool(null)
    setToolStep(0)
    setToolAnswers([])
    void trackEvent('tool_drawer_opened')
  }

  const handleSelectTool = (tool: ToolConfig) => {
    setActiveTool(tool)
    setToolStep(0)
    setToolAnswers([])
    void trackEvent('tool_selected', { tool: tool.id })
  }

  const handleToolNext = () => {
    if (!activeTool) return

    if (toolStep < activeTool.questions.length - 1) {
      setToolStep((prev) => prev + 1)
      return
    }

    setToolOutput(activeTool.output)
    void trackEvent('tool_completed', { tool: activeTool.id })
    activeTool.output.suggested.forEach((item) => pushSuggestion(item))
    setToolDrawerOpen(false)
  }

  const handleToolAnswer = (value: string) => {
    setToolAnswers((prev) => {
      const next = [...prev]
      next[toolStep] = value
      return next
    })
  }

  return (
    <AppShell variant="chat">
      <div className="chat-shell">
        <ChatHeader
          formattedDate={formattedDate}
          formattedTime={formattedTime}
          formattedElapsed={formattedElapsed}
          isRecording={isRecording}
          currentEmotion={currentEmotion}
        />

        {visibleBannerClaim && (
          <div className="chat-knowledge-banner">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
            <span className="chat-knowledge-banner-text">{visibleBannerClaim.text}</span>
            <button
              type="button"
              className="chat-knowledge-banner-close"
              aria-label="Dismiss"
              onClick={() => setVisibleBannerClaim(null)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          </div>
        )}

        <main className="chat-main no-scrollbar">
          <ChatActionBar
            shownActions={shownActions}
            remainingCount={remainingPendingCount}
            onTapAction={handleTapAction}
            onDismissAction={handleDismissAction}
          />

          {liveStatus ? (
            <div className="chat-live-status" aria-live="polite">
              Live: {liveStatus}
            </div>
          ) : null}

          {toolOutput ? (
            <div className="chat-message">
              <div className="chat-message-card">
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{toolOutput.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.75)' }}>{toolOutput.summary}</div>
                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                  {toolOutput.receipts.map((receipt) => (
                    <div key={receipt.highlight} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.85rem' }}>
                      <span>{receipt.highlight}</span>
                      <span style={{ textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.1em', color: receipt.confidence === 'Confirmed' ? 'var(--chat-accent)' : '#ffb69f' }}>
                        {receipt.confidence}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="chat-center">
            <div className="chat-ring ring-one" />
            <div className="chat-ring ring-two" />
            <div className="chat-ring ring-three" />
            <div className="chat-pulse" />
            {assistantTranscript ? (
              <div className="chat-center-assistant" ref={assistantCaptionRef}>
                {assistantTranscript}
              </div>
            ) : null}
            <button className="chat-mic-button" aria-label="Microphone" onClick={handleMic}>
              <span className="material-symbols-outlined" style={{ fontSize: 36 }}>
                {micDenied ? 'mic_off' : 'mic'}
              </span>
            </button>
            {userTranscript ? (
              <div className="chat-center-user" ref={userCaptionRef}>
                {userTranscript}
              </div>
            ) : null}
            <div className="chat-center-title">
              <h2>
                {isConnecting
                  ? 'Connecting...'
                  : isRecording
                    ? 'Listening...'
                    : micDenied
                      ? 'Mic unavailable'
                      : hasUserGesture
                        ? 'Paused'
                        : 'Tap to start'}
              </h2>
              <p>
                {isConnecting
                  ? 'Starting session...'
                  : isRecording
                    ? 'Tap to pause'
                    : micDenied
                      ? 'Tap mic to retry'
                      : hasUserGesture
                        ? 'Tap to resume'
                        : 'Tap anywhere to begin'}
              </p>
            </div>
          </div>

        </main>

        <div className="chat-attachment-rail">
          <button className="chat-attachment-button" aria-label="Add photo" onClick={() => setCameraOpen(true)}>
            <span className="material-symbols-outlined">photo_camera</span>
          </button>
          <button className="chat-attachment-button" aria-label="Attach file" onClick={handleFileButtonClick}>
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.md"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        </div>

        <footer className="chat-footer">
          <button className="chat-tools-button" aria-label="Open tools" onClick={openToolDrawer}>
            <span className="material-symbols-outlined">widgets</span>
          </button>
          <div className="chat-input">
            <input
              placeholder="Type a note..."
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleSendNote()
                }
              }}
            />
            <button type="button" aria-label="Send note" onClick={() => void handleSendNote()}>
              <span className="material-symbols-outlined">arrow_upward</span>
            </button>
          </div>
          <button className="chat-hangup" aria-label="End session" onClick={handleHangup}>
            <span className="material-symbols-outlined">call_end</span>
          </button>
        </footer>

        <div className="home-indicator" />

        {attachments.length > 0 && (
          <div className="chat-attachment-popup">
            <div className="chat-attachment-popup-header">
              <span style={{ fontSize: '0.75rem', color: 'var(--dark-text-tertiary)' }}>
                {attachments.length} file{attachments.length > 1 ? 's' : ''} attached
              </span>
              <button type="button" className="chat-attachment-popup-close"
                aria-label="Close attachments"
                onClick={() => setAttachments([])}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>
            <div className="chat-attachment-popup-grid">
              {attachments.map((att) => (
                <div key={att.id} className="chat-attachment-popup-item">
                  {att.type === 'image' && att.previewUrl ? (
                    <img src={att.previewUrl} alt={att.file.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--dark-text-tertiary)' }}>
                      {att.type === 'document' ? 'description' : 'attach_file'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {toolDrawerOpen ? (
        <ChatToolsDrawer
          tools={tools}
          activeTool={activeTool}
          toolStep={toolStep}
          toolAnswers={toolAnswers}
          onSelectTool={handleSelectTool}
          onNext={handleToolNext}
          onAnswer={handleToolAnswer}
          onClose={() => setToolDrawerOpen(false)}
          onBack={() => setActiveTool(null)}
        />
      ) : null}

      {pendingActionForPermission && (
        <PermissionSelector
          actionTitle={pendingActionForPermission.title}
          onSelect={handlePermissionSelected}
          onCancel={() => setPendingActionForPermission(null)}
          defaultPermission={profile?.defaultActionPermission ?? 'suggest'}
        />
      )}

      {recapOpen ? (
        <ChatRecapModal
          summary={summary}
          emotionalSummary={emotionalSummary}
          emotionalStates={emotionalStates}
          inferredClaims={inferredClaims}
          triggeredActions={triggeredActions}
          untappedActions={untappedActions}
          dismissedActions={dismissedActions}
          reviewItems={reviewItems}
          expandedEvidenceId={expandedEvidenceId}
          sessionStartedAt={recapSessionStart}
          sessionDurationMs={recapSessionDuration}
          onToggleEvidence={toggleEvidence}
          onSaveAction={handleTapAction}
          onClose={handleRecapClose}
          onGoToReflect={handleGoToReflect}
        />
      ) : null}

      {cameraOpen && (
        <CameraViewfinder
          onCapture={handleCameraCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </AppShell>
  )
}
