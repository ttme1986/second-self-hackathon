import { useCallback, useState } from 'react'
import {
  hasBackend,
  createAction,
  type ActionPermission,
  type TranscriptTurn,
} from '../api/backend'
import { executeAction } from '../services/actionExecutor'
import { trackEvent } from '../lib/analytics'
import type { Blackboard } from '../blackboard/Blackboard'

export type SuggestedAction = {
  id: string
  title: string
  due: string
  context: string
  evidence: string[]
  inBar: boolean
  tapped: boolean
  dismissed: boolean
}

type SuggestedActionsDeps = {
  blackboardRef: React.RefObject<Blackboard | null>
  conversationIdRef: React.RefObject<string | null>
  transcriptTurnsRef: React.RefObject<TranscriptTurn[]>
  addLoop: (loop: { title: string; due: 'Today' | 'This Week' | 'This Month' | 'Everything else'; source: 'suggested' | 'user' | 'conversation'; reminder: boolean }) => void
  profile: { displayName?: string; email?: string | null } | null
}

export function useSuggestedActions(deps: SuggestedActionsDeps) {
  const { blackboardRef, conversationIdRef, transcriptTurnsRef, addLoop, profile } = deps
  const [suggestions, setSuggestions] = useState<SuggestedAction[]>(() => [])
  const [pendingActionForPermission, setPendingActionForPermission] = useState<SuggestedAction | null>(null)

  const resolveEvidence = useCallback(
    (candidateEvidence: string[] | undefined) => {
      if (candidateEvidence && candidateEvidence.length > 0) return candidateEvidence
      const lastTurn = transcriptTurnsRef.current[transcriptTurnsRef.current.length - 1]
      return lastTurn?.text ? [lastTurn.text] : []
    },
    [transcriptTurnsRef],
  )

  const pushSuggestion = useCallback(
    (candidate: { title: string; due: string; context: string; evidence?: string[] }) => {
      const evidence = resolveEvidence(candidate.evidence)
      setSuggestions((prev) => {
        const duplicate = prev.find(
          (item) => item.title === candidate.title && item.context === candidate.context,
        )
        if (duplicate) return prev

        return [
          ...prev.map((item) => ({ ...item })),
          {
            id: `${candidate.title}-${candidate.context}-${Date.now()}`,
            title: candidate.title,
            due: candidate.due,
            context: candidate.context,
            evidence,
            inBar: true,
            tapped: false,
            dismissed: false,
          },
        ]
      })
      void trackEvent('action_suggested', { title: candidate.title, context: candidate.context })
    },
    [resolveEvidence],
  )

  const handleTapAction = useCallback((actionId: string) => {
    const action = suggestions.find((item) => item.id === actionId)
    if (action) {
      setPendingActionForPermission(action)
    }
  }, [suggestions])

  const handlePermissionSelected = useCallback(async (permission: ActionPermission) => {
    const action = pendingActionForPermission
    if (!action) return

    setPendingActionForPermission(null)

    setSuggestions((prev) =>
      prev.map((item) =>
        item.id === action.id
          ? { ...item, tapped: true, dismissed: false, inBar: false }
          : item,
      ),
    )

    const normalizeDue = (value: string): 'Today' | 'This Week' | 'This Month' | 'Everything else' => {
      if (value === 'Today' || value === 'This Week' || value === 'This Month') return value
      return 'Everything else'
    }

    let createdActionId: string | null = null
    if (hasBackend && conversationIdRef.current) {
      const result = await createAction({
        title: action.title,
        context: action.context,
        evidence: action.evidence,
        dueWindow: normalizeDue(action.due),
        source: 'conversation',
        reminder: false,
        status: permission === 'execute' ? 'executing' : permission === 'draft' ? 'approved' : 'confirmed',
        conversationId: conversationIdRef.current,
        permission,
        executionType: permission === 'suggest' ? 'manual' : permission === 'draft' ? 'draft' : 'auto',
      })
      createdActionId = result.data?.id ?? null

      if (createdActionId && permission !== 'suggest') {
        void executeAction(createdActionId, permission, {
          displayName: profile?.displayName,
          email: profile?.email ?? undefined,
        })
      }
    }

    addLoop({
      title: action.title,
      due: normalizeDue(action.due),
      source: 'suggested',
      reminder: false,
    })

    void trackEvent('action_approved', {
      title: action.title,
      due: action.due,
      permission,
    })

    if (conversationIdRef.current && blackboardRef.current) {
      blackboardRef.current.enqueue({
        type: 'action.user_decision',
        conversationId: conversationIdRef.current,
        decision: { title: action.title, dueWindow: action.due, accepted: true, permission },
      })
    }
  }, [pendingActionForPermission, conversationIdRef, blackboardRef, addLoop, profile])

  const handleDismissAction = useCallback((actionId: string) => {
    setSuggestions((prev) =>
      prev.map((item) =>
        item.id === actionId ? { ...item, dismissed: true, inBar: false } : item,
      ),
    )
    const dismissed = suggestions.find((item) => item.id === actionId)
    if (dismissed) {
      void trackEvent('action_dismissed', { title: dismissed.title, due: dismissed.due })

      if (conversationIdRef.current && blackboardRef.current) {
        blackboardRef.current.enqueue({
          type: 'action.user_decision',
          conversationId: conversationIdRef.current,
          decision: { title: dismissed.title, dueWindow: dismissed.due, accepted: false },
        })
      }
    }
  }, [suggestions, conversationIdRef, blackboardRef])

  const pendingActions = suggestions.filter(
    (item) => item.inBar && !item.tapped && !item.dismissed,
  )
  const maxVisibleActions = 1
  const shownActions = pendingActions.slice(0, maxVisibleActions)
  const remainingPendingCount = Math.max(pendingActions.length - shownActions.length, 0)
  const triggeredActions = suggestions.filter((item) => item.tapped)
  const untappedActions = suggestions.filter((item) => !item.tapped && !item.dismissed)
  const dismissedActions = suggestions.filter((item) => item.dismissed && !item.tapped)

  return {
    suggestions,
    pendingActionForPermission,
    setPendingActionForPermission,
    pendingActions,
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
  }
}
