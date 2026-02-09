import { useRef } from 'react'
import { Blackboard } from '../blackboard/Blackboard'
import { AnalyzerAgent, ValidatorAgent, ActionPublishAgent } from '../agents'
import type { InferredClaim } from '../services/conversationRealtime'

type PipelineCallbacks = {
  onStoredClaim: (claim: InferredClaim) => void
  onActionSuggested: (action: { title: string; dueWindow: string; evidence: string[] }) => void
}

export function useBlackboardPipeline() {
  const blackboardRef = useRef<Blackboard | null>(null)
  const analyzerRef = useRef<AnalyzerAgent | null>(null)
  const validatorRef = useRef<ValidatorAgent | null>(null)
  const actionAgentRef = useRef<ActionPublishAgent | null>(null)

  const initPipeline = (callbacks: PipelineCallbacks) => {
    if (blackboardRef.current) return

    const blackboard = new Blackboard()
    blackboardRef.current = blackboard

    const analyzer = new AnalyzerAgent()
    analyzer.start(blackboard)
    analyzerRef.current = analyzer

    const validator = new ValidatorAgent(callbacks.onStoredClaim)
    validator.start(blackboard)
    validatorRef.current = validator

    const actionAgent = new ActionPublishAgent(callbacks.onActionSuggested)
    actionAgent.start(blackboard)
    actionAgentRef.current = actionAgent
  }

  const stopPipeline = () => {
    analyzerRef.current?.stop()
    validatorRef.current?.stop()
    actionAgentRef.current?.stop()
    blackboardRef.current = null
  }

  return {
    blackboardRef,
    initPipeline,
    stopPipeline,
  }
}
