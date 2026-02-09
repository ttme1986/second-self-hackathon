import {
  updateAction,
  getAction,
  type ActionRecord,
  type ActionPermission,
  type ActionType,
} from '../api/backend'
import { GoogleGenAI } from '@google/genai'
import type { GenerateContentConfig } from '@google/genai'

type ExecutionResult = {
  success: boolean
  message: string
  draftContent?: string
  executionResult?: string
}

type DraftGenerationContext = {
  title: string
  context?: string
  evidence?: string[]
  actionType?: ActionType
  userProfile?: {
    displayName?: string
    email?: string
  }
}

const getAiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.toString() ?? ''
  if (!apiKey) return null
  return new GoogleGenAI({ apiKey })
}

const isAiDisabled = () =>
  (import.meta.env.VITE_DISABLE_AI?.toString() ?? 'false').toLowerCase() === 'true'

const generateText = async (prompt: string, model: string, extraConfig?: Partial<GenerateContentConfig>) => {
  if (isAiDisabled()) throw new Error('AI disabled')
  const client = getAiClient()
  if (!client) throw new Error('Gemini API key missing')
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: { temperature: 1.0, ...extraConfig },
  })
  const meta = response.usageMetadata
  if (meta?.cachedContentTokenCount) {
    const pct = ((meta.cachedContentTokenCount / (meta.promptTokenCount ?? 1)) * 100).toFixed(1)
    console.debug(`[cache] actionExecutor: ${meta.cachedContentTokenCount}/${meta.promptTokenCount} tokens cached (${pct}%)`)
  }
  return response.text ?? ''
}

/**
 * Generate draft content for an action based on its type
 */
export async function generateActionDraft(context: DraftGenerationContext): Promise<string> {
  const { title, context: actionContext, evidence, actionType, userProfile } = context

  const basePrompt = [
    'You are helping a user prepare an action. Generate appropriate draft content.',
    'Be concise, professional, and natural.',
    '',
    `Action: ${title}`,
    actionContext ? `Context: ${actionContext}` : '',
    evidence?.[0] ? `Evidence/Background: ${evidence[0]}` : '',
    userProfile?.displayName ? `User name: ${userProfile.displayName}` : '',
  ].filter(Boolean).join('\n')

  let typeSpecificPrompt = ''

  switch (actionType) {
    case 'email':
      typeSpecificPrompt = [
        '',
        'Generate a brief, professional email draft.',
        'Format: Subject line on first line, then blank line, then email body.',
        'Keep it under 150 words. Sign off appropriately.',
      ].join('\n')
      break

    case 'calendar':
      typeSpecificPrompt = [
        '',
        'Generate a calendar event description.',
        'Format: Event title on first line, then suggested duration, then description.',
        'Keep the description under 50 words.',
      ].join('\n')
      break

    case 'reminder':
      typeSpecificPrompt = [
        '',
        'Generate a helpful reminder note.',
        'Format: Brief reminder text with any relevant details.',
        'Keep it under 30 words.',
      ].join('\n')
      break

    case 'goal':
      typeSpecificPrompt = [
        '',
        'Generate a goal-related action plan.',
        'Format: Brief next steps or progress update.',
        'Keep it under 50 words.',
      ].join('\n')
      break

    case 'reading':
      typeSpecificPrompt = [
        '',
        'Generate a reading list entry or summary note.',
        'Format: Title, source (if known), and why to read it.',
        'Keep it under 40 words.',
      ].join('\n')
      break

    default:
      typeSpecificPrompt = [
        '',
        'Generate a helpful action item note.',
        'Format: Clear, actionable description.',
        'Keep it under 50 words.',
      ].join('\n')
  }

  const fullPrompt = basePrompt + typeSpecificPrompt

  try {
    return await generateText(fullPrompt, 'gemini-3-flash-preview', {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
    })
  } catch (error) {
    console.error('Failed to generate draft:', error)
    return `[Draft for: ${title}]\n\nPlease review and complete this action.`
  }
}

/**
 * Execute an action based on its permission level
 */
export async function executeAction(
  actionId: string,
  permission: ActionPermission,
  userProfile?: { displayName?: string; email?: string }
): Promise<ExecutionResult> {
  const actionResult = await getAction(actionId)
  if (!actionResult.data?.action) {
    return { success: false, message: 'Action not found' }
  }

  const action = actionResult.data.action

  switch (permission) {
    case 'suggest': {
      // Just save as a manual follow-up
      await updateAction(actionId, {
        status: 'confirmed',
        executionType: 'manual',
        permission: 'suggest',
      })
      return {
        success: true,
        message: 'Saved to Follow ups for manual completion',
      }
    }

    case 'draft': {
      // Generate draft content and save for review
      await updateAction(actionId, {
        status: 'executing',
        executionType: 'draft',
        permission: 'draft',
      })

      try {
        const draftContent = await generateActionDraft({
          title: action.title,
          context: action.context,
          evidence: action.evidence,
          actionType: action.actionType,
          userProfile,
        })

        await updateAction(actionId, {
          status: 'approved',
          draftContent,
        })

        return {
          success: true,
          message: 'Draft created - ready for review',
          draftContent,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate draft'
        await updateAction(actionId, {
          status: 'failed',
          executionResult: message,
        })
        return { success: false, message }
      }
    }

    case 'execute': {
      // Execute immediately (simulated for hackathon)
      await updateAction(actionId, {
        status: 'executing',
        executionType: 'auto',
        permission: 'execute',
      })

      try {
        // Generate draft content first
        const draftContent = await generateActionDraft({
          title: action.title,
          context: action.context,
          evidence: action.evidence,
          actionType: action.actionType,
          userProfile,
        })

        // Simulate execution (in real app, this would integrate with external services)
        const executionResult = await simulateExecution(action, draftContent)

        await updateAction(actionId, {
          status: 'completed',
          draftContent,
          executionResult,
        })

        return {
          success: true,
          message: 'Action completed',
          draftContent,
          executionResult,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Execution failed'
        await updateAction(actionId, {
          status: 'failed',
          executionResult: message,
        })
        return { success: false, message }
      }
    }

    default:
      return { success: false, message: 'Unknown permission level' }
  }
}

/**
 * Simulate action execution (for hackathon demo purposes)
 * In a real app, this would integrate with external services
 */
async function simulateExecution(action: ActionRecord, draftContent: string): Promise<string> {
  // Add a small delay to simulate real execution
  await new Promise((resolve) => setTimeout(resolve, 500))

  switch (action.actionType) {
    case 'email':
      return `Email draft prepared. In production, this would be sent via email service.\n\nContent:\n${draftContent}`

    case 'calendar':
      return `Calendar event created (simulated). In production, this would be added to your calendar.\n\nDetails:\n${draftContent}`

    case 'reminder':
      return `Reminder set. You will be notified at the appropriate time.\n\nReminder:\n${draftContent}`

    case 'goal':
      return `Goal action logged. Progress has been recorded.\n\nAction:\n${draftContent}`

    case 'reading':
      return `Added to reading list.\n\nEntry:\n${draftContent}`

    default:
      return `Action completed.\n\nResult:\n${draftContent}`
  }
}

/**
 * Approve a draft action (move from approved to completed)
 */
export async function approveDraft(actionId: string): Promise<ExecutionResult> {
  const actionResult = await getAction(actionId)
  if (!actionResult.data?.action) {
    return { success: false, message: 'Action not found' }
  }

  const action = actionResult.data.action

  if (action.status !== 'approved' || !action.draftContent) {
    return { success: false, message: 'Action is not in draft review state' }
  }

  try {
    const executionResult = await simulateExecution(action, action.draftContent)

    await updateAction(actionId, {
      status: 'completed',
      executionResult,
    })

    return {
      success: true,
      message: 'Draft approved and executed',
      executionResult,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Execution failed'
    await updateAction(actionId, {
      status: 'failed',
      executionResult: message,
    })
    return { success: false, message }
  }
}

/**
 * Dismiss an action
 */
export async function dismissAction(actionId: string): Promise<ExecutionResult> {
  try {
    await updateAction(actionId, {
      status: 'dismissed',
    })
    return { success: true, message: 'Action dismissed' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to dismiss action'
    return { success: false, message }
  }
}

/**
 * Update draft content for an action in review
 */
export async function updateDraftContent(
  actionId: string,
  newContent: string
): Promise<ExecutionResult> {
  try {
    await updateAction(actionId, {
      draftContent: newContent,
    })
    return { success: true, message: 'Draft updated' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update draft'
    return { success: false, message }
  }
}

export type { ExecutionResult, DraftGenerationContext }
