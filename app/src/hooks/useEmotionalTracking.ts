import { useCallback, useRef, useState } from 'react'
import {
  detectEmotion,
  calculateEmotionalSummary,
  type EmotionalState,
  type EmotionalSummary,
} from '../api/backend'

export function useEmotionalTracking() {
  const [emotionalStates, setEmotionalStates] = useState<EmotionalState[]>([])
  const [currentEmotion, setCurrentEmotion] = useState<EmotionalState | null>(null)
  const [emotionalSummary, setEmotionalSummary] = useState<EmotionalSummary | null>(null)
  const emotionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const detectEmotionFromText = useCallback((text: string) => {
    if (emotionDebounceRef.current) {
      clearTimeout(emotionDebounceRef.current)
    }
    emotionDebounceRef.current = setTimeout(() => {
      void detectEmotion(text).then((emotion) => {
        setCurrentEmotion(emotion)
        setEmotionalStates((prev) => [...prev, emotion])
      })
    }, 500)
  }, [])

  const computeSummary = useCallback(() => {
    if (emotionalStates.length > 0) {
      const summary = calculateEmotionalSummary(emotionalStates)
      setEmotionalSummary(summary)
    }
  }, [emotionalStates])

  return {
    emotionalStates,
    currentEmotion,
    emotionalSummary,
    detectEmotionFromText,
    computeSummary,
  }
}
