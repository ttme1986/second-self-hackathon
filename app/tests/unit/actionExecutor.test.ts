import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/api/backend', () => ({
  updateAction: vi.fn(),
  getAction: vi.fn(),
}))

const mockGenerateContent = vi.fn().mockResolvedValue({ text: 'Generated draft content' })

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGenerateContent,
      }
    },
  }
})

import {
  generateActionDraft,
  executeAction,
  approveDraft,
  dismissAction,
  updateDraftContent,
} from '../../src/services/actionExecutor'
import { updateAction, getAction } from '../../src/api/backend'

const mockUpdateAction = vi.mocked(updateAction)
const mockGetAction = vi.mocked(getAction)

describe('actionExecutor', () => {
  let originalEnv: ImportMetaEnv

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateAction.mockResolvedValue({ data: { updated: true } })
    mockGenerateContent.mockResolvedValue({ text: 'Generated draft content' })

    // Set env vars so getAiClient() returns a client
    originalEnv = { ...import.meta.env }
    import.meta.env.VITE_GEMINI_API_KEY = 'fake-test-key'
    import.meta.env.VITE_DISABLE_AI = 'false'
  })

  afterEach(() => {
    // Restore env
    Object.assign(import.meta.env, originalEnv)
  })

  describe('generateActionDraft', () => {
    it('generates draft for email action type', async () => {
      const draft = await generateActionDraft({
        title: 'Email the team about meeting',
        context: 'Weekly sync meeting moved to Friday',
        actionType: 'email',
        userProfile: { displayName: 'Alice' },
      })

      expect(draft).toBe('Generated draft content')
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    })

    it('generates draft for calendar action type', async () => {
      const draft = await generateActionDraft({
        title: 'Schedule dentist appointment',
        actionType: 'calendar',
      })

      expect(draft).toBe('Generated draft content')
    })

    it('generates draft for reminder action type', async () => {
      const draft = await generateActionDraft({
        title: 'Remember to call mom',
        actionType: 'reminder',
      })

      expect(draft).toBe('Generated draft content')
    })

    it('generates draft for goal action type', async () => {
      const draft = await generateActionDraft({
        title: 'Update marathon training log',
        actionType: 'goal',
        evidence: ['Ran 5k this morning'],
      })

      expect(draft).toBe('Generated draft content')
    })

    it('generates draft for reading action type', async () => {
      const draft = await generateActionDraft({
        title: 'Read Clean Code by Robert Martin',
        actionType: 'reading',
      })

      expect(draft).toBe('Generated draft content')
    })

    it('returns fallback draft on AI failure', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API error'))

      const draft = await generateActionDraft({
        title: 'Send report',
        actionType: 'email',
      })

      expect(draft).toContain('Send report')
      expect(draft).toContain('Please review and complete this action')
    })

    it('returns fallback draft when API key is missing', async () => {
      import.meta.env.VITE_GEMINI_API_KEY = ''

      const draft = await generateActionDraft({
        title: 'Book flight',
        actionType: 'general',
      })

      expect(draft).toContain('Book flight')
      expect(draft).toContain('Please review and complete this action')
    })
  })

  describe('executeAction', () => {
    it('handles "suggest" permission - saves as manual follow-up', async () => {
      mockGetAction.mockResolvedValue({
        data: {
          action: {
            id: 'a1',
            title: 'Call dentist',
            dueWindow: 'Today',
            status: 'confirmed',
            source: 'chat',
            reminder: false,
            conversationId: 'c1',
            actionType: 'reminder',
          },
        },
      })

      const result = await executeAction('a1', 'suggest')

      expect(result.success).toBe(true)
      expect(result.message).toContain('Follow ups')
      expect(mockUpdateAction).toHaveBeenCalledWith('a1', {
        status: 'confirmed',
        executionType: 'manual',
        permission: 'suggest',
      })
    })

    it('handles "draft" permission - generates draft and marks approved', async () => {
      mockGetAction.mockResolvedValue({
        data: {
          action: {
            id: 'a1',
            title: 'Email team',
            dueWindow: 'Today',
            status: 'confirmed',
            source: 'chat',
            reminder: false,
            conversationId: 'c1',
            actionType: 'email',
          },
        },
      })

      const result = await executeAction('a1', 'draft')

      expect(result.success).toBe(true)
      expect(result.message).toContain('Draft created')
      expect(result.draftContent).toBe('Generated draft content')
      // First call sets status to 'executing'
      expect(mockUpdateAction).toHaveBeenCalledWith('a1', {
        status: 'executing',
        executionType: 'draft',
        permission: 'draft',
      })
      // Second call sets status to 'approved' with draft content
      expect(mockUpdateAction).toHaveBeenCalledWith('a1', {
        status: 'approved',
        draftContent: 'Generated draft content',
      })
    })

    it('handles "execute" permission - generates draft and simulates execution', async () => {
      mockGetAction.mockResolvedValue({
        data: {
          action: {
            id: 'a1',
            title: 'Set reminder',
            dueWindow: 'Today',
            status: 'confirmed',
            source: 'chat',
            reminder: true,
            conversationId: 'c1',
            actionType: 'reminder',
          },
        },
      })

      const result = await executeAction('a1', 'execute')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Action completed')
      expect(result.draftContent).toBeDefined()
      expect(result.executionResult).toBeDefined()
      expect(result.executionResult).toContain('Reminder set')
    })

    it('returns error when action is not found', async () => {
      mockGetAction.mockResolvedValue({ data: { action: null } })

      const result = await executeAction('nonexistent', 'suggest')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Action not found')
    })

    it('returns error for unknown permission level', async () => {
      mockGetAction.mockResolvedValue({
        data: {
          action: {
            id: 'a1',
            title: 'Task',
            dueWindow: 'Today',
            status: 'confirmed',
            source: 'chat',
            reminder: false,
            conversationId: 'c1',
          },
        },
      })

      const result = await executeAction('a1', 'unknown' as any)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Unknown permission level')
    })

    it('handles draft generation failure in "draft" mode gracefully', async () => {
      mockGetAction.mockResolvedValue({
        data: {
          action: {
            id: 'a1',
            title: 'Write report',
            dueWindow: 'Today',
            status: 'confirmed',
            source: 'chat',
            reminder: false,
            conversationId: 'c1',
            actionType: 'general',
          },
        },
      })

      // First updateAction (set to executing) succeeds, then AI fails, then updateAction (set to failed) succeeds
      // The catch in the draft case will fire because generateActionDraft does NOT throw (it catches internally),
      // so it returns the fallback. The "draft" flow will succeed with the fallback as draftContent.
      // Actually the "draft" case calls generateActionDraft, which catches internally. Let's test the case
      // where the AI is disabled.
      import.meta.env.VITE_DISABLE_AI = 'true'

      const result = await executeAction('a1', 'draft')

      // When AI is disabled, generateText throws 'AI disabled', caught by generateActionDraft's catch -> fallback
      // The "draft" case gets the fallback string as draft content. But wait - executeAction calls
      // generateActionDraft which catches internally and returns fallback. So the draft case should still succeed.
      expect(result.success).toBe(true)
      expect(result.draftContent).toContain('Write report')
    })
  })

  describe('approveDraft', () => {
    it('approves a draft and executes it', async () => {
      mockGetAction.mockResolvedValue({
        data: {
          action: {
            id: 'a1',
            title: 'Email report',
            dueWindow: 'Today',
            status: 'approved',
            source: 'chat',
            reminder: false,
            conversationId: 'c1',
            actionType: 'email',
            draftContent: 'Draft email content here',
          },
        },
      })

      const result = await approveDraft('a1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Draft approved and executed')
      expect(result.executionResult).toContain('Email draft prepared')
      expect(mockUpdateAction).toHaveBeenCalledWith('a1', expect.objectContaining({
        status: 'completed',
      }))
    })

    it('returns error when action not found', async () => {
      mockGetAction.mockResolvedValue({ data: { action: null } })

      const result = await approveDraft('nonexistent')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Action not found')
    })

    it('returns error when action is not in draft review state', async () => {
      mockGetAction.mockResolvedValue({
        data: {
          action: {
            id: 'a1',
            title: 'Task',
            dueWindow: 'Today',
            status: 'confirmed',
            source: 'chat',
            reminder: false,
            conversationId: 'c1',
          },
        },
      })

      const result = await approveDraft('a1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Action is not in draft review state')
    })
  })

  describe('dismissAction', () => {
    it('dismisses an action successfully', async () => {
      const result = await dismissAction('a1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Action dismissed')
      expect(mockUpdateAction).toHaveBeenCalledWith('a1', { status: 'dismissed' })
    })

    it('handles updateAction failure gracefully', async () => {
      mockUpdateAction.mockRejectedValue(new Error('DB error'))

      const result = await dismissAction('a1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('DB error')
    })
  })

  describe('updateDraftContent', () => {
    it('updates draft content successfully', async () => {
      const result = await updateDraftContent('a1', 'New draft text')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Draft updated')
      expect(mockUpdateAction).toHaveBeenCalledWith('a1', { draftContent: 'New draft text' })
    })

    it('handles updateAction failure gracefully', async () => {
      mockUpdateAction.mockRejectedValue(new Error('Storage full'))

      const result = await updateDraftContent('a1', 'text')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Storage full')
    })
  })
})
