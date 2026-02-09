import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  callGemini,
  confirmActions,
  createMoment,
  createOpenLoop,
  createSession,
  deleteProfileData,
  embedQuery,
  endConversation,
  getConversationTranscript,
  getGeminiSessionKey,
  getProfile,
  listActions,
  listClaims,
  listConversations,
  listMoments,
  listOpenLoops,
  listReviewQueue,
  resolveReviewQueue,
  searchConversations,
  startConversation,
  transcribe,
  updateClaim,
  updateProfile,
  upload,
  createGoal,
  updateGoal,
  deleteGoal,
  getGoal,
  listGoals,
  addMilestoneToGoal,
  updateMilestone,
  deleteMilestone,
  addCheckIn,
} from '../../src/api/backend'
import { clearStore, loadStore } from '../../src/api/localStore'

vi.mock('@google/genai', () => {
  class GoogleGenAI {
    models = {
      generateContent: vi.fn(async ({ contents }: { contents: string }) => ({
        text: `response:${contents}`,
      })),
      embedContent: vi.fn(async () => ({
        embeddings: [{ values: [0.1, 0.2, 0.3] }],
      })),
    }
  }
  const Type = { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', NUMBER: 'NUMBER', BOOLEAN: 'BOOLEAN' }
  const ThinkingLevel = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' }
  return { GoogleGenAI, Type, ThinkingLevel }
})

const setSessionUser = (uid: string) => {
  window.localStorage.setItem('sessionUser', JSON.stringify({ uid }))
}

describe('local backend API', () => {
  beforeEach(() => {
    clearStore()
    window.localStorage.clear()
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key')
    vi.stubEnv('VITE_DISABLE_AI', 'false')
    setSessionUser('dev-user')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns error when gemini prompt missing', async () => {
    const result = await callGemini('')
    expect(result.error).toBe('prompt required')
  })

  it('generates gemini responses', async () => {
    const result = await callGemini('hello')
    expect(result.data?.text).toBe('response:hello')
  })

  it('transcribes audio text', async () => {
    const result = await transcribe('audio-text')
    expect(result.data?.text).toContain('audio-text')
  })

  it('returns embeddings for query', async () => {
    const result = await embedQuery('hello')
    expect(result.data?.embedding).toEqual([0.1, 0.2, 0.3])
  })

  it('creates session and loads profile', async () => {
    const session = await createSession({ uid: 'u1' })
    expect(session.data?.token).toContain('local-u1')

    setSessionUser('u1')
    const profile = await getProfile()
    expect(profile.data?.profile.uid).toBe('u1')
  })

  it('updates profile fields', async () => {
    setSessionUser('u2')
    await getProfile()
    const updated = await updateProfile({ displayName: 'Tim', geoCapture: false })
    expect(updated.data?.profile.displayName).toBe('Tim')
    expect(updated.data?.profile.geoCapture).toBe(false)
  })

  it('starts and ends conversations and lists them', async () => {
    setSessionUser('u3')
    const conversationId = 'conv-1'
    await startConversation(conversationId)
    const end = await endConversation(conversationId, [
      { speaker: 'user', text: 'hello', t_ms: 1 },
      { speaker: 'assistant', text: 'hi', t_ms: 2 },
    ])
    expect(end.data?.summary).toContain('response:')

    const list = await listConversations()
    expect(list.data?.items[0].id).toBe(conversationId)

    const transcript = await getConversationTranscript(conversationId)
    expect(transcript.data?.turns.length).toBe(2)
  })

  it('searches conversations using embeddings', async () => {
    setSessionUser('u4')
    await startConversation('conv-search')
    await endConversation('conv-search', [
      { speaker: 'user', text: 'budget review', t_ms: 1 },
    ])

    const results = await searchConversations('budget')
    expect(results.data?.items.length).toBeGreaterThan(0)
  })

  it('confirms actions and lists them', async () => {
    setSessionUser('u5')
    await startConversation('conv-actions')
    const confirm = await confirmActions('conv-actions', [
      { title: 'Book dentist', dueWindow: 'Today', source: 'conversation', reminder: false },
    ])
    expect(confirm.data?.ids.length).toBe(1)

    const actions = await listActions()
    expect(actions.data?.items.length).toBe(1)
  })

  it('updates claims and review queue', async () => {
    setSessionUser('u6')
    await startConversation('conv-claims')
    await confirmActions('conv-claims', [])

    const store = loadStore()
    store.users['u6'] = store.users['u6'] ?? { profile: null, claims: {}, reviewQueue: {}, actions: {}, conversations: {} }
    store.users['u6'].claims['c1'] = {
      id: 'c1',
      text: 'Claim one',
      status: 'inferred',
      category: 'preferences',
      confidence: 0.5,
      evidence: [],
      conversationId: 'conv-claims',
    }
    window.localStorage.setItem('secondSelfStore', JSON.stringify(store))

    const update = await updateClaim('c1', { status: 'confirmed' })
    expect(update.data?.updated).toBe(true)

    const claims = await listClaims('confirmed')
    expect(claims.data?.items.length).toBe(1)

    store.users['u6'].reviewQueue['r1'] = {
      id: 'r1',
      title: 'Potential conflict',
      summary: 'Check',
      claims: ['c1', 'c2'],
      status: 'pending',
      conversationId: 'conv-claims',
    }
    window.localStorage.setItem('secondSelfStore', JSON.stringify(store))

    const queue = await listReviewQueue()
    expect(queue.data?.items.length).toBe(1)

    const resolved = await resolveReviewQueue('r1', 'confirm-left')
    expect(resolved.data?.updated).toBe(true)
  })

  it('manages moments, open loops, and uploads', async () => {
    const momentResult = await createMoment({ userId: 'dev-user', summary: 'Moment' })
    expect(momentResult.data?.id).toBeTruthy()

    const moments = await listMoments('dev-user')
    expect(moments.data?.items.length).toBe(1)

    const loopResult = await createOpenLoop({ userId: 'dev-user', title: 'Loop' })
    expect(loopResult.data?.id).toBeTruthy()

    const loops = await listOpenLoops('dev-user')
    expect(loops.data?.items.length).toBe(1)

    const uploadResult = await upload('audio/test.wav', 'aGVsbG8=', 'audio/wav')
    expect(uploadResult.data?.path).toBe('audio/test.wav')
  })

  it('returns session key when available', async () => {
    const result = await getGeminiSessionKey()
    expect(result.data?.jwe).toBe('test-key')
  })

  it('deletes profile data', async () => {
    setSessionUser('u7')
    await getProfile()
    const deleted = await deleteProfileData()
    expect(deleted.data?.deleted).toBe(true)

    const store = loadStore()
    expect(store.users['u7']).toBeUndefined()
  })

  describe('goals', () => {
    beforeEach(() => {
      setSessionUser('goal-user')
    })

    it('creates a goal', async () => {
      const result = await createGoal({
        title: 'Learn TypeScript',
        description: 'Master TypeScript for better code quality',
        category: 'learning',
        status: 'active',
        progress: 0,
        targetDate: '2024-12-31',
      })
      expect(result.data?.id).toBeTruthy()
      expect(result.data?.goal.title).toBe('Learn TypeScript')
      expect(result.data?.goal.category).toBe('learning')
    })

    it('gets a goal by id', async () => {
      const createResult = await createGoal({
        title: 'Exercise daily',
        description: 'Build healthy habits',
        category: 'health',
        status: 'active',
        progress: 0,
        targetDate: null,
      })
      const goalId = createResult.data!.id

      const getResult = await getGoal(goalId)
      expect(getResult.data?.goal?.title).toBe('Exercise daily')
      expect(getResult.data?.goal?.category).toBe('health')
    })

    it('updates a goal', async () => {
      const createResult = await createGoal({
        title: 'Save money',
        description: 'Build emergency fund',
        category: 'finance',
        status: 'active',
        progress: 0,
        targetDate: null,
      })
      const goalId = createResult.data!.id

      const updateResult = await updateGoal(goalId, {
        progress: 50,
        status: 'active',
      })
      expect(updateResult.data?.updated).toBe(true)
      expect(updateResult.data?.goal?.progress).toBe(50)
    })

    it('deletes a goal', async () => {
      const createResult = await createGoal({
        title: 'To delete',
        description: '',
        category: 'other',
        status: 'active',
        progress: 0,
        targetDate: null,
      })
      const goalId = createResult.data!.id

      const deleteResult = await deleteGoal(goalId)
      expect(deleteResult.data?.deleted).toBe(true)

      const getResult = await getGoal(goalId)
      expect(getResult.data?.goal).toBeNull()
    })

    it('lists goals with status filter', async () => {
      await createGoal({
        title: 'Active goal',
        description: '',
        category: 'personal',
        status: 'active',
        progress: 0,
        targetDate: null,
      })
      await createGoal({
        title: 'Completed goal',
        description: '',
        category: 'personal',
        status: 'completed',
        progress: 100,
        targetDate: null,
      })

      const allGoals = await listGoals()
      expect(allGoals.data?.items.length).toBe(2)

      const activeGoals = await listGoals('active')
      expect(activeGoals.data?.items.length).toBe(1)
      expect(activeGoals.data?.items[0].title).toBe('Active goal')

      const completedGoals = await listGoals('completed')
      expect(completedGoals.data?.items.length).toBe(1)
      expect(completedGoals.data?.items[0].title).toBe('Completed goal')
    })

    it('adds milestones to a goal', async () => {
      const createResult = await createGoal({
        title: 'Goal with milestones',
        description: '',
        category: 'career',
        status: 'active',
        progress: 0,
        targetDate: null,
      })
      const goalId = createResult.data!.id

      const milestone1 = await addMilestoneToGoal(goalId, { title: 'Step 1', completed: false })
      expect(milestone1.data?.milestone.title).toBe('Step 1')

      const milestone2 = await addMilestoneToGoal(goalId, { title: 'Step 2', completed: false })
      expect(milestone2.data?.milestone.title).toBe('Step 2')

      const goal = await getGoal(goalId)
      expect(goal.data?.goal?.milestones.length).toBe(2)
    })

    it('updates milestone and recalculates progress', async () => {
      const createResult = await createGoal({
        title: 'Progress test',
        description: '',
        category: 'personal',
        status: 'active',
        progress: 0,
        targetDate: null,
      })
      const goalId = createResult.data!.id

      await addMilestoneToGoal(goalId, { title: 'M1', completed: false })
      const m2Result = await addMilestoneToGoal(goalId, { title: 'M2', completed: false })
      const milestoneId = m2Result.data!.milestone.id

      // Complete one milestone
      await updateMilestone(goalId, milestoneId, { completed: true })

      const goal = await getGoal(goalId)
      expect(goal.data?.goal?.progress).toBe(50) // 1 of 2 milestones complete
    })

    it('deletes a milestone', async () => {
      const createResult = await createGoal({
        title: 'Delete milestone test',
        description: '',
        category: 'personal',
        status: 'active',
        progress: 0,
        targetDate: null,
      })
      const goalId = createResult.data!.id

      const m1 = await addMilestoneToGoal(goalId, { title: 'M1', completed: false })
      await addMilestoneToGoal(goalId, { title: 'M2', completed: false })

      await deleteMilestone(goalId, m1.data!.milestone.id)

      const goal = await getGoal(goalId)
      expect(goal.data?.goal?.milestones.length).toBe(1)
      expect(goal.data?.goal?.milestones[0].title).toBe('M2')
    })

    it('adds check-ins to a goal', async () => {
      const createResult = await createGoal({
        title: 'Check-in test',
        description: '',
        category: 'health',
        status: 'active',
        progress: 25,
        targetDate: null,
      })
      const goalId = createResult.data!.id

      const checkInResult = await addCheckIn(goalId, {
        status: 'on-track',
        notes: 'Making good progress',
        aiResponse: 'Keep it up!',
        progressSnapshot: 25,
      })
      expect(checkInResult.data?.checkIn.status).toBe('on-track')
      expect(checkInResult.data?.checkIn.notes).toBe('Making good progress')

      const goal = await getGoal(goalId)
      expect(goal.data?.goal?.checkIns.length).toBe(1)
    })
  })
})
