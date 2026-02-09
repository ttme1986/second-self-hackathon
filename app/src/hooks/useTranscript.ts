import { useCallback, useRef, useState } from 'react'
import {
  hasBackend,
  appendConversationTurn,
  type TranscriptTurn,
} from '../api/backend'
import type { Blackboard } from '../blackboard/Blackboard'

type TranscriptDeps = {
  blackboardRef: React.RefObject<Blackboard | null>
  conversationIdRef: React.RefObject<string | null>
  onUserFinalText?: (text: string) => void
}

export function useTranscript(deps: TranscriptDeps) {
  const { blackboardRef, conversationIdRef, onUserFinalText } = deps

  const [userTranscript, setUserTranscript] = useState('')
  const [assistantTranscript, setAssistantTranscript] = useState('')
  const userFinalRef = useRef(false)
  const assistantFinalRef = useRef(false)
  const assistantRespondedRef = useRef(false)
  const transcriptTurnsRef = useRef<TranscriptTurn[]>([])
  const userCaptionRef = useRef<HTMLDivElement>(null)
  const assistantCaptionRef = useRef<HTMLDivElement>(null)

  const handleTranscriptUpdate = useCallback(
    (text: string, isUser: boolean, isFinal: boolean) => {
      const mergeTranscript = (prev: string, next: string) => {
        if (!prev) return next
        if (!next) return prev
        if (next.startsWith(prev)) return next
        if (prev.startsWith(next)) return prev
        return `${prev} ${next}`
      }

      if (isUser) {
        if (text.trim().toLowerCase() === '<noise>') {
          return
        }

        // Only update display for non-final updates (final re-emission is
        // for recording/blackboard only — display was already updated by
        // prior non-final emissions from liveAudioService).
        if (!isFinal) {
          assistantFinalRef.current = true

          if (assistantRespondedRef.current) {
            setUserTranscript(text.trimStart())
            assistantRespondedRef.current = false
          } else {
            setUserTranscript((prev) => {
              if (!prev) return text
              if (!text) return prev
              return `${prev} ${text}`
            })
          }
          setTimeout(() => {
            if (typeof userCaptionRef.current?.scrollTo === 'function') {
              userCaptionRef.current.scrollTo({ top: userCaptionRef.current.scrollHeight })
            }
          }, 0)
        }

        if (isFinal && text) {
          const turn: TranscriptTurn = { speaker: 'user', text, t_ms: Date.now() }
          transcriptTurnsRef.current = [...transcriptTurnsRef.current, turn]
          if (hasBackend && conversationIdRef.current) {
            void appendConversationTurn(conversationIdRef.current, turn)
          }
          if (hasBackend && conversationIdRef.current && blackboardRef.current) {
            blackboardRef.current.enqueue({
              type: 'turn.ingest',
              conversationId: conversationIdRef.current,
              turn,
            })
          }
          onUserFinalText?.(text)
        }
      } else {
        assistantRespondedRef.current = true
        if (assistantFinalRef.current) {
          setAssistantTranscript('')
          assistantFinalRef.current = false
        }
        if (text) {
          setAssistantTranscript((prev) => mergeTranscript(prev, text))
        }
        if (isFinal) {
          assistantFinalRef.current = true
        }
        setTimeout(() => {
          if (typeof assistantCaptionRef.current?.scrollTo === 'function') {
            assistantCaptionRef.current.scrollTo({ top: assistantCaptionRef.current.scrollHeight })
          }
        }, 0)
        if (isFinal && text) {
          const turn: TranscriptTurn = { speaker: 'assistant', text, t_ms: Date.now() }
          transcriptTurnsRef.current = [...transcriptTurnsRef.current, turn]
          if (hasBackend && conversationIdRef.current) {
            void appendConversationTurn(conversationIdRef.current, turn)
          }
          if (hasBackend && conversationIdRef.current && blackboardRef.current) {
            blackboardRef.current.enqueue({
              type: 'turn.ingest',
              conversationId: conversationIdRef.current,
              turn,
            })
          }
        }
      }
    },
    [blackboardRef, conversationIdRef, onUserFinalText],
  )

  const resetTranscripts = useCallback(() => {
    setUserTranscript('')
    setAssistantTranscript('')
    userFinalRef.current = false
    assistantFinalRef.current = false
    assistantRespondedRef.current = false
    transcriptTurnsRef.current = []
  }, [])

  return {
    userTranscript,
    setUserTranscript,
    assistantTranscript,
    setAssistantTranscript,
    assistantFinalRef,
    transcriptTurnsRef,
    userCaptionRef,
    assistantCaptionRef,
    handleTranscriptUpdate,
    resetTranscripts,
  }
}
