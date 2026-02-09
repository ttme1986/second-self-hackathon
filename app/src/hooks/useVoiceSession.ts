import { useCallback, useEffect, useRef, useState } from 'react'
import {
  hasBackend,
  getGeminiSessionKey,
} from '../api/backend'
import { liveAudioService } from '../services/liveAudioService'
import { trackEvent } from '../lib/analytics'
import { buildMemoryContext } from '../services/memoryContext'

type VoiceSessionDeps = {
  handleTranscriptUpdate: (text: string, isUser: boolean, isFinal: boolean) => void
  assistantFinalRef: React.RefObject<boolean>
  ensureConversationStarted: () => Promise<void>
  onStopAgents: () => void
  displayName?: string
}

export function useVoiceSession(deps: VoiceSessionDeps) {
  const { handleTranscriptUpdate, assistantFinalRef, ensureConversationStarted, onStopAgents, displayName } = deps

  const [isRecording, setIsRecording] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [hasUserGesture, setHasUserGesture] = useState(false)
  const [liveStatus, setLiveStatus] = useState('')
  const [micDenied, setMicDenied] = useState(false)
  const sessionStartRef = useRef<number | null>(null)
  const autoStartRef = useRef(false)
  const autoStartInFlightRef = useRef(false)
  const autoRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const memoryPromptRef = useRef<string | null>(null)
  const greetingSentRef = useRef(false)

  const disableLiveAudio = import.meta.env.VITE_DISABLE_LIVE_AUDIO === 'true'
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY?.toString() ?? ''

  useEffect(() => {
    memoryPromptRef.current = null;
  }, [displayName]);

  const resolveSystemPrompt = useCallback(async (): Promise<string> => {
    if (memoryPromptRef.current) return memoryPromptRef.current
    try {
      const { systemPrompt } = await buildMemoryContext(displayName ?? '')
      memoryPromptRef.current = systemPrompt
      return systemPrompt
    } catch (err) {
      console.error('Failed to build memory context, using fallback:', err)
      return `You are Second Self, a personal AI life assistant for ${displayName}.`;
    }
  }, [displayName])

  const ensureApiKey = useCallback(async () => {
    if (!liveAudioService.hasApiKey()) {
      if (geminiApiKey) {
        liveAudioService.setApiKey(geminiApiKey)
      } else if (hasBackend) {
        const result = await getGeminiSessionKey()
        if (result.data?.jwe) liveAudioService.setApiKey(result.data.jwe)
      }
    }
  }, [geminiApiKey])

  const sendTextToLive = useCallback(async (text: string) => {
    liveAudioService.onTranscriptUpdate = (t, isUser, isFinal) => {
      handleTranscriptUpdate(t, isUser, isFinal)
    }

    if (!liveAudioService.connected) {
      await ensureApiKey()
      const prompt = await resolveSystemPrompt()
      await liveAudioService.connectTextOnly(prompt)
      if (!greetingSentRef.current) {
        liveAudioService.sendText('[Session started. Please greet the user.]')
        greetingSentRef.current = true
      }
    }

    liveAudioService.sendText(text)
  }, [handleTranscriptUpdate, ensureApiKey, resolveSystemPrompt])

  const startVoiceSession = useCallback(async () => {
    if (disableLiveAudio) {
      setIsConnecting(false)
      return
    }
    if (!liveAudioService.hasApiKey()) {
      if (geminiApiKey) {
        liveAudioService.setApiKey(geminiApiKey)
      } else if (!hasBackend) {
        throw new Error('Gemini API key missing')
      } else {
        const result = await getGeminiSessionKey()
        const apiKey = result.data?.jwe
        if (apiKey) {
          liveAudioService.setApiKey(apiKey)
        } else {
          throw new Error('Gemini API key missing')
        }
      }
    }
    setIsConnecting(true)
    try {
      const prompt = await resolveSystemPrompt()
      await liveAudioService.connect(prompt)

      // Send greeting trigger after voice connection
      if (!greetingSentRef.current) {
        liveAudioService.sendText('[Session started. Please greet the user.]')
        greetingSentRef.current = true
      }

      await ensureConversationStarted()
    } catch (error) {
      setIsConnecting(false)
      throw error
    }
    setIsConnecting(false)
  }, [disableLiveAudio, resolveSystemPrompt, ensureConversationStarted, geminiApiKey])

  const stopVoiceSession = useCallback(async () => {
    await liveAudioService.disconnect()
    setIsConnecting(false)
  }, [])

  const initTextSession = useCallback(async () => {
    await ensureApiKey()
    const prompt = await resolveSystemPrompt()
    await liveAudioService.connectTextOnly(prompt)
    if (!greetingSentRef.current) {
      liveAudioService.sendText('[Session started. Please greet the user.]')
      greetingSentRef.current = true
    }
  }, [ensureApiKey, resolveSystemPrompt])

  // Wire up liveAudioService callbacks (safe to re-run on dep changes)
  useEffect(() => {
    liveAudioService.onTranscriptUpdate = (text, isUser, isFinal) => {
      handleTranscriptUpdate(text, isUser, isFinal)
    }
    liveAudioService.onStatus = (status) => {
      setLiveStatus(status)
      if (status === 'connected') {
        setIsConnecting(false)
      }
    }
    liveAudioService.onBargeIn = () => {
      assistantFinalRef.current = true
    }
  }, [handleTranscriptUpdate, assistantFinalRef])

  // Disconnect and cleanup on unmount only (not on dep changes)
  useEffect(() => {
    return () => {
      liveAudioService.onTranscriptUpdate = null
      liveAudioService.onStatus = null
      liveAudioService.onBargeIn = null
      void liveAudioService.disconnect()
      onStopAgents()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Detect first user gesture
  useEffect(() => {
    const handleFirstGesture = () => {
      setHasUserGesture(true)
    }
    window.addEventListener('pointerdown', handleFirstGesture, { once: true })
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture)
    }
  }, [])

  // Resume audio on gesture when recording
  useEffect(() => {
    if (!isRecording) return
    const handleGesture = () => {
      if (!liveAudioService.isAudioLocked?.()) return
      void liveAudioService.resumeAudio?.()
    }
    window.addEventListener('pointerdown', handleGesture)
    return () => {
      window.removeEventListener('pointerdown', handleGesture)
    }
  }, [isRecording])

  // Auto-start on first gesture
  useEffect(() => {
    if (!hasUserGesture) return
    if (autoStartRef.current || autoStartInFlightRef.current) return
    if (disableLiveAudio) return
    if (!liveAudioService.hasApiKey() && !geminiApiKey) {
      console.error('Gemini API key missing')
      return
    }

    const startFromGesture = async () => {
      setIsConnecting(true)
      autoStartInFlightRef.current = true
      sessionStartRef.current = Date.now()
      void trackEvent('voice_session_start', { source: 'auto-gesture' })
      try {
        await startVoiceSession()
        setIsRecording(true)
      } catch (error) {
        setIsRecording(false)
        const isMicDenied = error instanceof DOMException && error.name === 'NotAllowedError'
        if (isMicDenied) {
          console.warn('Microphone access denied — falling back to text-only mode')
          setMicDenied(true)
          try {
            await ensureConversationStarted()
            await initTextSession()
          } catch (fallbackErr) {
            console.error('Text-only fallback failed:', fallbackErr)
          }
        } else {
          console.error('Failed to start voice session', error)
        }
      } finally {
        autoStartRef.current = true
        autoStartInFlightRef.current = false
        setIsConnecting(false)
      }
    }

    void startFromGesture()
  }, [disableLiveAudio, hasUserGesture, startVoiceSession, geminiApiKey, ensureConversationStarted, initTextSession])

  // Cleanup auto-retry timeout on unmount
  useEffect(() => {
    return () => {
      if (autoRetryRef.current) {
        clearTimeout(autoRetryRef.current)
        autoRetryRef.current = null
      }
    }
  }, [])

  return {
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
  }
}
