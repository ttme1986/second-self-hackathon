import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { useOpenLoops } from '../openloops/OpenLoopsProvider'
import {
  hasBackend,
  embedQuery,
  listActions,
  listClaims,
  listConversations,
  listReviewQueue,
  listGoals,
  createGoal,
  updateGoal,
  updateMilestone,
  addMilestoneToGoal,
  deleteMilestone,
  addCheckIn,
  getConversationTranscript,
  resolveReviewQueue,
  searchConversations,
  updateClaim,
  type ClaimRecord,
  type ReviewRecord,
  type GoalRecord,
  type Milestone,
  type ActionRecord,
} from '../api/backend'
import { approveDraft, dismissAction, updateDraftContent } from '../services/actionExecutor'
import DraftReviewModal from '../components/DraftReviewModal'
import GoalCard from '../components/GoalCard'
import GoalDetail from '../components/GoalDetail'
import CreateGoalModal from '../components/CreateGoalModal'
import GoalCheckIn from '../components/GoalCheckIn'
import { useOptionalProfile } from '../profile/ProfileProvider'
import { trackEvent } from '../lib/analytics'
import { createEvidenceSnippet } from '../lib/evidence'
import {
  filterClaims,
  groupClaimsByCategory,
  searchRecords,
  type Claim,
  type Moment,
  type ReviewItem,
} from '../reflect/reflectData'

const dueOrder: Array<'Today' | 'This Week' | 'This Month' | 'Everything else'> = [
  'Today',
  'This Week',
  'This Month',
  'Everything else',
]

export default function Reflect() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tab = params.get('tab')
  const { loops, toggleDone, replaceLoops } = useOpenLoops()
  const profileContext = useOptionalProfile()
  const profile = profileContext?.profile ?? null
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [claimFilter, setClaimFilter] = useState<'all' | 'confirmed' | 'inferred'>('all')
  const [claims, setClaims] = useState<Claim[]>([])
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([])
  const [activeClaim, setActiveClaim] = useState<Claim | null>(null)
  const [activeMoment, setActiveMoment] = useState<Moment | null>(null)
  const [editingClaim, setEditingClaim] = useState('')
  const [moments, setMoments] = useState<Moment[]>([])
  const [searchMoments, setSearchMoments] = useState<Moment[]>([])
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [embeddingStatus, setEmbeddingStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [mergeReviewId, setMergeReviewId] = useState<string | null>(null)
  const [mergeReviewText, setMergeReviewText] = useState('')
  const [reviewSelections, setReviewSelections] = useState<Record<string, 'left' | 'right'>>({})
  const [goals, setGoals] = useState<GoalRecord[]>([])
  const [goalFilter, setGoalFilter] = useState<'active' | 'completed' | 'all'>('active')
  const [activeGoal, setActiveGoal] = useState<GoalRecord | null>(null)
  const [showCreateGoal, setShowCreateGoal] = useState(false)
  const [checkingInGoal, setCheckingInGoal] = useState<GoalRecord | null>(null)
  const [draftActions, setDraftActions] = useState<ActionRecord[]>([])
  const [reviewingAction, setReviewingAction] = useState<ActionRecord | null>(null)
  const [followupSubTab, setFollowupSubTab] = useState<'actions' | 'goals'>('actions')

  const grouped = dueOrder.map((due) => ({
    due,
    items: loops.filter((loop) => loop.due === due),
  }))

  const filteredClaims = useMemo(() => filterClaims(claims, claimFilter), [claims, claimFilter])
  const groupedClaims = useMemo(() => groupClaimsByCategory(filteredClaims), [filteredClaims])
  const orderedClaimGroups = useMemo(
    () =>
      groupedClaims.map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))),
      })),
    [groupedClaims],
  )
  const searchResults = useMemo(() => {
    const local = searchRecords(moments, claims, searchQuery)
    return {
      moments: searchQuery.trim() ? searchMoments : local.moments,
      claims: local.claims,
    }
  }, [claims, moments, searchQuery, searchMoments])
  const timelineGroups = useMemo(() => {
    if (moments.length === 0) return []
    const first = moments.slice(0, 2)
    const second = moments.slice(2)
    return [
      { id: 'group-1', title: 'Recent', items: first },
      { id: 'group-2', title: 'Earlier', items: second },
    ]
  }, [moments])

  const filteredGoals = useMemo(() => {
    if (goalFilter === 'all') return goals
    if (goalFilter === 'completed') return goals.filter((g) => g.status === 'completed')
    // 'active' includes active and paused
    return goals.filter((g) => g.status === 'active' || g.status === 'paused')
  }, [goals, goalFilter])

  const buildExcerpt = (turns: Array<{ speaker: string; text: string }>) => {
    if (!turns.length) return ''
    const snippet = turns.slice(0, 6).map((turn) => `${turn.speaker}: ${turn.text}`)
    return snippet.join('\n')
  }

  const mapClaimRecord = (record: ClaimRecord): Claim => {
    const category =
      record.category === 'preferences' ||
      record.category === 'skills' ||
      record.category === 'relationships' ||
      record.category === 'other'
        ? record.category
        : 'other'
    return {
      id: record.id,
      text: record.text,
      status: record.status,
      category,
      confidence: Number(record.confidence ?? 0.5),
      pinned: record.pinned ?? false,
      createdAt: record.createdAt,
      evidence: (record.evidence ?? []).map((snippet, index) => ({
        id: `${record.id}-${index}`,
        momentTitle: 'Conversation',
        snippet,
        timestamp: '',
      })),
    }
  }

  const mapReviewRecord = (record: ReviewRecord): ReviewItem => {
    const claimTexts = record.claims ?? ([] as unknown as [string, string])
    const claimIds = record.claimIds ?? ([] as unknown as [string, string])
    const normalizedClaims: [string, string] = [
      claimTexts[0] ?? '',
      claimTexts[1] ?? claimTexts[0] ?? '',
    ]
    const normalizedClaimIds: [string, string] = [
      claimIds[0] ?? '',
      claimIds[1] ?? claimIds[0] ?? '',
    ]
    const severity =
      record.severity === 'high' || record.severity === 'medium' || record.severity === 'low'
        ? record.severity
        : undefined

    return {
      id: record.id,
      title: record.title ?? 'Potential conflict detected',
      summary: record.summary ?? '',
      claims: normalizedClaims,
      claimIds: normalizedClaimIds,
      status: record.status,
      severity,
      resolution: record.resolution,
    }
  }

  const openMoment = async (moment: Moment) => {
    setActiveMoment(moment)
    if (!hasBackend) return
    const result = await getConversationTranscript(moment.id)
    if (result.data?.turns) {
      const excerpt = buildExcerpt(result.data.turns)
      setActiveMoment((prev) => (prev ? { ...prev, excerpt } : prev))
    }
  }

  useEffect(() => {
    if (!hasBackend) return
    if (!searchQuery.trim()) {
      setEmbeddingStatus('idle')
      setSearchMoments([])
      return
    }

    const isTestAgent =
      typeof navigator !== 'undefined' &&
      /Playwright|HeadlessChrome|Headless/i.test(navigator.userAgent)

    if (isTestAgent) return

    let isActive = true
    setEmbeddingStatus('loading')
    const timeout = setTimeout(async () => {
      const result = await embedQuery(searchQuery.trim())
      if (!isActive) return
      setEmbeddingStatus(result.error ? 'error' : 'ready')
      void trackEvent('search_query', { length: searchQuery.trim().length })

      if (hasBackend) {
        const searchRes = await searchConversations(searchQuery.trim())
        if (!isActive) return
        if (searchRes.data?.items?.length) {
          const mapped = searchRes.data.items.map((item) => ({
            id: item.id,
            summary: item.summary,
            startedAt: item.startedAt,
            excerpt: item.summary,
            tags: [],
            attachments: [],
            linkedClaims: item.claimIds ?? [],
          })) as Moment[]
          setSearchMoments(mapped)
        } else {
          setSearchMoments([])
        }
      }
    }, 300)

    return () => {
      isActive = false
      clearTimeout(timeout)
    }
  }, [searchQuery])

  useEffect(() => {
    if (!hasBackend || !profile) return

    const fetchData = async () => {
      setLoadingRemote(true)
      const [momentsRes, claimsRes, actionsRes, reviewRes, goalsRes] = await Promise.all([
        listConversations(),
        listClaims(),
        listActions(),
        listReviewQueue(),
        listGoals(),
      ])

      if (momentsRes.data?.items?.length) {
        const mapped = momentsRes.data.items.map((item) => ({
          id: item.id,
          summary: item.summary,
          startedAt: item.startedAt,
          excerpt: item.summary,
          tags: [],
          attachments: [],
          linkedClaims: item.claimIds ?? [],
        })) as Moment[]
        setMoments(mapped)
      }
      if (claimsRes.data?.items?.length) {
        setClaims(claimsRes.data.items.map(mapClaimRecord))
      }
      if (actionsRes.data?.items?.length) {
        const normalizeDue = (value: string) => {
          if (value === 'Today' || value === 'This Week' || value === 'This Month') return value
          return 'Everything else'
        }
        const mapped = actionsRes.data.items.map((item) => ({
          id: item.id,
          title: item.title,
          due: normalizeDue(item.dueWindow),
          source: item.source,
          sourceId: item.conversationId,
          reminder: item.reminder,
          done: item.status === 'done' || item.status === 'completed',
        }))
        replaceLoops(mapped as any)

        // Track actions with drafts for review
        const drafts = actionsRes.data.items.filter(
          (item) => item.draftContent || item.status === 'approved' || item.status === 'completed'
        )
        setDraftActions(drafts)
      }
      if (reviewRes.data?.items?.length) {
        const severityRank = (value?: ReviewItem['severity']) =>
          value === 'high' ? 3 : value === 'medium' ? 2 : value === 'low' ? 1 : 0
        setReviewQueue(
          reviewRes.data.items
            .map(mapReviewRecord)
            .sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
        )
      }
      if (goalsRes.data?.items) {
        setGoals(goalsRes.data.items)
      }

      setLoadingRemote(false)
    }

    void fetchData()
  }, [profile, replaceLoops])

  const applyClaimUpdate = (claimId: string, updates: Partial<Pick<Claim, 'status' | 'text' | 'pinned'>>) => {
    setClaims((prev) =>
      prev.map((claim) => (claim.id === claimId ? { ...claim, ...updates } : claim)),
    )

    if (hasBackend) {
      void updateClaim(claimId, updates)
    }
  }

  const handleClaimStatus = (claimId: string, status: Claim['status']) => {
    applyClaimUpdate(claimId, { status })
    void trackEvent('claim_status_updated', { status })
  }

  const handleClaimEdit = () => {
    if (!activeClaim) return
    setClaims((prev) =>
      prev.map((claim) =>
        claim.id === activeClaim.id ? { ...claim, text: editingClaim.trim() } : claim,
      ),
    )
    setActiveClaim((prev) => (prev ? { ...prev, text: editingClaim.trim() } : prev))
    void trackEvent('claim_edited')

    if (hasBackend) {
      void updateClaim(activeClaim.id, { text: editingClaim.trim() })
    }
  }

  const resolveConfidenceLabel = (claim: Claim) => {
    if (claim.status === 'confirmed') return 'High'
    if (claim.status === 'rejected') return 'Low'
    const score = Number(claim.confidence ?? 0)
    if (score >= 0.8) return 'High'
    if (score >= 0.6) return 'Medium'
    return 'Low'
  }

  const handlePinToggle = (claim: Claim) => {
    const nextPinned = !claim.pinned
    applyClaimUpdate(claim.id, { pinned: nextPinned })
    void trackEvent('claim_pinned', { pinned: nextPinned })
  }

  const resetMergeEditor = () => {
    setMergeReviewId(null)
    setMergeReviewText('')
  }

  const handleCreateGoal = async (goalData: {
    title: string
    description: string
    category: GoalRecord['category']
    targetDate: string | null
    milestones: Omit<Milestone, 'id'>[]
  }) => {
    const result = await createGoal({
      ...goalData,
      status: 'active',
      progress: 0,
      milestones: goalData.milestones.map((m, i) => ({
        id: `temp-${i}`,
        ...m,
      })),
    })
    if (result.data?.goal) {
      setGoals((prev) => [result.data!.goal, ...prev])
      void trackEvent('goal_created', { category: goalData.category })
    }
    setShowCreateGoal(false)
  }

  const handleUpdateGoal = async (goalId: string, updates: Partial<GoalRecord>) => {
    const result = await updateGoal(goalId, updates)
    if (result.data?.goal) {
      setGoals((prev) => prev.map((g) => (g.id === goalId ? result.data!.goal! : g)))
      if (activeGoal?.id === goalId) {
        setActiveGoal(result.data.goal)
      }
      void trackEvent('goal_updated')
    }
  }

  const handleToggleMilestone = async (goalId: string, milestoneId: string, completed: boolean) => {
    const completedAt = completed ? new Date().toISOString() : undefined
    await updateMilestone(goalId, milestoneId, { completed, completedAt })
    // Refresh goals to get updated progress
    const goalsRes = await listGoals()
    if (goalsRes.data?.items) {
      setGoals(goalsRes.data.items)
      const updatedGoal = goalsRes.data.items.find((g) => g.id === goalId)
      if (updatedGoal && activeGoal?.id === goalId) {
        setActiveGoal(updatedGoal)
      }
    }
  }

  const handleAddMilestone = async (goalId: string, title: string) => {
    await addMilestoneToGoal(goalId, { title, completed: false })
    // Refresh goals
    const goalsRes = await listGoals()
    if (goalsRes.data?.items) {
      setGoals(goalsRes.data.items)
      const updatedGoal = goalsRes.data.items.find((g) => g.id === goalId)
      if (updatedGoal && activeGoal?.id === goalId) {
        setActiveGoal(updatedGoal)
      }
    }
  }

  const handleDeleteMilestone = async (goalId: string, milestoneId: string) => {
    await deleteMilestone(goalId, milestoneId)
    // Refresh goals
    const goalsRes = await listGoals()
    if (goalsRes.data?.items) {
      setGoals(goalsRes.data.items)
      const updatedGoal = goalsRes.data.items.find((g) => g.id === goalId)
      if (updatedGoal && activeGoal?.id === goalId) {
        setActiveGoal(updatedGoal)
      }
    }
  }

  const handleCheckIn = async (goalId: string, checkInData: { status: 'on-track' | 'behind' | 'ahead'; notes: string; aiResponse: string }) => {
    const goal = goals.find((g) => g.id === goalId)
    await addCheckIn(goalId, {
      ...checkInData,
      progressSnapshot: goal?.progress,
    })
    // Refresh goals
    const goalsRes = await listGoals()
    if (goalsRes.data?.items) {
      setGoals(goalsRes.data.items)
      const updatedGoal = goalsRes.data.items.find((g) => g.id === goalId)
      if (updatedGoal && activeGoal?.id === goalId) {
        setActiveGoal(updatedGoal)
      }
    }
    setCheckingInGoal(null)
    void trackEvent('goal_checkin', { status: checkInData.status })
  }

  const refreshActions = async () => {
    const actionsRes = await listActions()
    if (actionsRes.data?.items) {
      const normalizeDue = (value: string) => {
        if (value === 'Today' || value === 'This Week' || value === 'This Month') return value
        return 'Everything else'
      }
      const mapped = actionsRes.data.items.map((item) => ({
        id: item.id,
        title: item.title,
        due: normalizeDue(item.dueWindow),
        source: item.source,
        sourceId: item.conversationId,
        reminder: item.reminder,
        done: item.status === 'done' || item.status === 'completed',
      }))
      replaceLoops(mapped as any)

      const drafts = actionsRes.data.items.filter(
        (item) => item.draftContent || item.status === 'approved' || item.status === 'completed'
      )
      setDraftActions(drafts)
    }
  }

  const handleApproveDraft = async (actionId: string) => {
    const result = await approveDraft(actionId)
    if (result.success) {
      void trackEvent('draft_approved', { actionId })
      setReviewingAction(null)
      await refreshActions()
    }
  }

  const handleEditDraft = async (actionId: string, newContent: string) => {
    const result = await updateDraftContent(actionId, newContent)
    if (result.success) {
      void trackEvent('draft_edited', { actionId })
      await refreshActions()
      // Update the modal with new content
      const updated = draftActions.find((a) => a.id === actionId)
      if (updated) {
        setReviewingAction({ ...updated, draftContent: newContent })
      }
    }
  }

  const handleDismissAction = async (actionId: string) => {
    const result = await dismissAction(actionId)
    if (result.success) {
      void trackEvent('action_dismissed', { actionId })
      setReviewingAction(null)
      await refreshActions()
    }
  }

  const resolveReview = (
    item: ReviewItem,
    resolution: ReviewItem['resolution'],
    mergedText?: string,
  ) => {
    if (!resolution) return
    const [leftId, rightId] = item.claimIds

    if (resolution === 'confirm-left') {
      applyClaimUpdate(leftId, { status: 'confirmed' })
      applyClaimUpdate(rightId, { status: 'rejected' })
    }

    if (resolution === 'confirm-right') {
      applyClaimUpdate(rightId, { status: 'confirmed' })
      applyClaimUpdate(leftId, { status: 'rejected' })
    }

    if (resolution === 'reject-both') {
      applyClaimUpdate(leftId, { status: 'rejected' })
      applyClaimUpdate(rightId, { status: 'rejected' })
    }

    if (resolution === 'merge') {
      const fallbackText = claims.find((claim) => claim.id === leftId)?.text ?? ''
      const nextText = mergedText?.trim() || fallbackText
      applyClaimUpdate(leftId, { text: nextText, status: 'confirmed' })
      applyClaimUpdate(rightId, { status: 'rejected' })
    }

    setReviewQueue((prev) =>
      prev.map((entry) =>
        entry.id === item.id ? { ...entry, status: 'resolved', resolution } : entry,
      ),
    )
    void trackEvent('review_queue_resolved', { resolution })

    if (hasBackend) {
      void resolveReviewQueue(item.id, resolution)
    }
    resetMergeEditor()
  }

  const searchActive = searchOpen || searchQuery.trim().length > 0
  const activeTab = tab === 'open-loops' || tab === 'follow-ups'
    ? 'follow-ups'
    : tab === 'review'
      ? 'review'
      : tab ?? 'memories'

  // Handle URL params for sub-tabs and deep-linking
  const subtab = params.get('subtab')
  const goalIdParam = params.get('goalId')

  useEffect(() => {
    if (subtab === 'goals') setFollowupSubTab('goals')
  }, [subtab])

  // Auto-open goal detail when goalId is in URL
  useEffect(() => {
    if (goalIdParam && goals.length > 0) {
      const goal = goals.find((g) => g.id === goalIdParam)
      if (goal) {
        setFollowupSubTab('goals')
        setActiveGoal(goal)
      }
    }
  }, [goalIdParam, goals])

  return (
    <AppShell variant="reflect">
      <div className="reflect-shell">
        <header className="reflect-header">
          <Link to="/" className="chat-header-button" aria-label="Back to Hub">
            <span className="material-symbols-outlined fill-1">grid_view</span>
          </Link>
          <h1 className="reflect-title">Reflect</h1>
          <button
            className="chat-header-button"
            aria-label="Search"
            onClick={() => setSearchOpen((prev) => !prev)}
          >
            <span className="material-symbols-outlined">search</span>
          </button>
        </header>

        <main className="reflect-main no-scrollbar">
          {searchActive ? (
            <>
              <div className="reflect-card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined">search</span>
                  <input
                    placeholder="Search memories, claims, receipts"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    style={{ flex: 1, border: 'none', background: 'transparent', font: 'inherit' }}
                  />
                  {searchQuery ? (
                    <button
                      style={{ border: 'none', background: 'none', color: 'var(--reflect-primary)', fontWeight: 600 }}
                      onClick={() => {
                        setSearchQuery('')
                        setSearchOpen(false)
                      }}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>

              {loadingRemote ? <div className="reflect-card">Syncing data...</div> : null}
              {embeddingStatus === 'loading' ? (
                <div className="reflect-card">Running semantic search...</div>
              ) : null}
              {embeddingStatus === 'error' ? (
                <div className="reflect-card">Semantic search unavailable - showing keyword matches.</div>
              ) : null}

              <section style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div className="reflect-subtitle">Memories ({searchResults.moments.length})</div>
                  {searchResults.moments.length === 0 ? (
                    <div className="reflect-card">No moments match your query.</div>
                  ) : (
                    searchResults.moments.map((moment) => (
                      <button
                        key={moment.id}
                        className="reflect-card"
                        onClick={() => {
                          void openMoment(moment)
                          void trackEvent('search_click', { type: 'moment' })
                        }}
                        style={{ textAlign: 'left' }}
                      >
                        <div style={{ fontWeight: 600 }}>{moment.summary}</div>
                        <div style={{ color: 'var(--reflect-muted)', fontSize: '0.85rem' }}>{moment.startedAt}</div>
                      </button>
                    ))
                  )}
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div className="reflect-subtitle">Claims ({searchResults.claims.length})</div>
                  {searchResults.claims.length === 0 ? (
                    <div className="reflect-card">No claims match your query.</div>
                  ) : (
                    searchResults.claims.map((claim) => (
                      <button
                        key={claim.id}
                        className="reflect-card"
                        onClick={() => {
                          setActiveClaim(claim)
                          setEditingClaim(claim.text)
                          void trackEvent('search_click', { type: 'claim' })
                        }}
                        style={{ textAlign: 'left' }}
                      >
                        <div style={{ fontWeight: 600 }}>{claim.text}</div>
                        <div style={{ color: 'var(--reflect-muted)', fontSize: '0.85rem' }}>
                          {claim.category} - {claim.status}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </>
          ) : activeTab === 'memories' ? (
            <section style={{ position: 'relative' }}>
              <div className="reflect-timeline-line" />
              {timelineGroups.length === 0 ? (
                <div className="reflect-card">No moments yet.</div>
              ) : (
                timelineGroups.map((group) => (
                  <div key={group.id} style={{ marginBottom: 32 }}>
                    <div className="timeline-group-title" style={{ marginLeft: 12 }}>{group.title}</div>
                    {group.items.map((moment, index) => (
                      <div key={moment.id} className="timeline-item">
                        <div className="timeline-dot" />
                        {index === 0 ? (
                          <button
                            className="timeline-card"
                            style={{ textAlign: 'left' }}
                            onClick={() => openMoment(moment)}
                          >
                            <div className="timeline-meta">
                              <span>{moment.startedAt}</span>
                              <span className="material-symbols-outlined">mic</span>
                            </div>
                            <h3 className="timeline-title">{moment.summary}</h3>
                            <p style={{ margin: 0, color: 'rgba(31,41,55,0.8)', fontSize: '0.9rem' }}>
                              {moment.excerpt}
                            </p>
                          </button>
                        ) : (
                          <button
                            style={{ paddingTop: 4, textAlign: 'left', background: 'none', border: 'none' }}
                            onClick={() => openMoment(moment)}
                          >
                            <div className="timeline-meta" style={{ marginBottom: 4 }}>
                              <span>{moment.startedAt}</span>
                            </div>
                            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700 }}>
                              {moment.summary}
                            </div>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </section>
          ) : activeTab === 'profile' ? (
            <section>
              <div style={{ marginBottom: 16 }}>
                <div className="reflect-chip-row no-scrollbar">
                  {(['all', 'confirmed', 'inferred'] as const).map((filter) => (
                    <button
                      key={filter}
                      className={`reflect-chip ${claimFilter === filter ? 'is-active' : ''}`}
                      onClick={() => setClaimFilter(filter)}
                    >
                      {filter === 'all'
                        ? `All (${claims.length})`
                        : filter === 'confirmed'
                          ? `Confirmed (${claims.filter((claim) => claim.status === 'confirmed').length})`
                          : `Inferred (${claims.filter((claim) => claim.status === 'inferred').length})`}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                {orderedClaimGroups.flatMap((group) => group.items).length === 0 ? (
                  <div className="reflect-card">No claims available.</div>
                ) : (
                  orderedClaimGroups.flatMap((group) => group.items).map((claim) => {
                    const confidenceLabel = resolveConfidenceLabel(claim)
                    const evidenceSnippet = createEvidenceSnippet(claim.evidence[0]?.snippet ?? '')
                    return (
                      <div
                        key={claim.id}
                        className="reflect-card"
                        onClick={() => {
                          setActiveClaim(claim)
                          setEditingClaim(claim.text)
                        }}
                      >
                        <div style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 8 }}>
                          {claim.text}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--reflect-muted)', marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span>{`Confidence: ${confidenceLabel}`}</span>
                          {evidenceSnippet ? <span>{`Evidence: ${evidenceSnippet}`}</span> : null}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className={`reflect-pill ${claim.status}`}>
                            {claim.status === 'confirmed' ? 'Confirmed' : claim.status === 'rejected' ? 'Rejected' : 'Inferred'}
                          </span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                              type="button"
                              aria-label={`${claim.pinned ? 'Unpin' : 'Pin'} claim ${claim.text}`}
                              aria-pressed={Boolean(claim.pinned)}
                              style={{ border: 'none', background: 'none', color: 'var(--reflect-muted)' }}
                              onClick={(event) => {
                                event.stopPropagation()
                                handlePinToggle(claim)
                              }}
                            >
                              <span className={`material-symbols-outlined ${claim.pinned ? 'fill-1' : ''}`}>
                                push_pin
                              </span>
                            </button>
                            <button
                              type="button"
                              style={{ border: 'none', background: 'none', color: 'var(--reflect-muted)' }}
                              onClick={(event) => {
                                event.stopPropagation()
                                setActiveClaim(claim)
                                setEditingClaim(claim.text)
                              }}
                            >
                              <span className="material-symbols-outlined">receipt_long</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          ) : activeTab === 'review' ? (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                  Review Queue
                </h1>
                <span className="reflect-chip" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                  {reviewQueue.filter((item) => item.status === 'pending').length} pending
                </span>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                {reviewQueue.length === 0 ? (
                  <div className="reflect-card">No items in review queue.</div>
                ) : null}
                {reviewQueue.map((item) => {
                  const leftClaim = claims.find((claim) => claim.id === item.claimIds[0])
                  const rightClaim = claims.find((claim) => claim.id === item.claimIds[1])
                  // Use claim text from record, with fallback to looked-up claim
                  const leftText = item.claims[0] || leftClaim?.text || ''
                  const rightText = item.claims[1] || rightClaim?.text || ''
                  const isEditingMerge = mergeReviewId === item.id
                  const selectedClaim = reviewSelections[item.id] ?? 'right'
                  const setSelectedClaim = (value: 'left' | 'right') => {
                    setReviewSelections((prev) => ({ ...prev, [item.id]: value }))
                  }

                  // Format timestamp for display (e.g., "22 JAN 2026")
                  const formatClaimDate = (timestamp?: string) => {
                    if (!timestamp) return 'JUST NOW'
                    const date = new Date(timestamp)
                    const day = date.getDate()
                    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
                    const year = date.getFullYear()
                    return `${day} ${month} ${year}`
                  }

                  const leftTimestamp = leftClaim?.createdAt
                  const rightTimestamp = rightClaim?.createdAt
                  const leftDate = formatClaimDate(leftTimestamp)
                  const rightDate = formatClaimDate(rightTimestamp)

                  const leftLabel = `NOTE FROM ${leftDate}`
                  const rightLabel = `NOTE FROM ${rightDate}`

                  return (
                    <div key={item.id} className="reflect-card" style={{ position: 'relative', overflow: 'hidden' }}>
                      {/* Severity badge in top-right corner */}
                      {item.severity === 'high' && (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          background: 'rgba(239,68,68,0.1)',
                          padding: '6px 12px',
                          borderBottomLeftRadius: 12,
                          borderBottom: '1px solid rgba(239,68,68,0.2)',
                          borderLeft: '1px solid rgba(239,68,68,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'rgb(239,68,68)' }}>
                            warning
                          </span>
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgb(239,68,68)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Contradiction
                          </span>
                        </div>
                      )}

                      {/* Title and summary */}
                      <div style={{ marginBottom: 16, marginTop: item.severity === 'high' ? 8 : 0 }}>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.3 }}>
                          {item.title}
                        </div>
                        <p style={{ marginTop: 2, color: 'var(--reflect-muted)', fontSize: '0.75rem', lineHeight: 1.4 }}>
                          {item.summary}
                        </p>
                      </div>

                      {/* Claims comparison */}
                      <div style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
                        {/* Left claim */}
                        <button
                          type="button"
                          onClick={() => setSelectedClaim('left')}
                          className="reflect-card"
                          style={{
                            background: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                            border: selectedClaim === 'left' ? '2px solid rgba(255,69,0,0.3)' : '1px solid rgba(0,0,0,0.08)',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '1rem', lineHeight: 1.4 }}>{leftText}</div>
                            <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--reflect-muted)', fontWeight: 600, marginTop: 4 }}>
                              {leftLabel}
                            </div>
                          </div>
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              border: selectedClaim === 'left' ? '5px solid var(--reflect-primary)' : '2px solid rgba(0,0,0,0.2)',
                              flexShrink: 0,
                              transition: 'all 0.2s',
                            }}
                          />
                        </button>

                        {/* VS divider */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '100%', borderTop: '1px solid rgba(0,0,0,0.1)' }} />
                          </div>
                          <div style={{ position: 'relative', background: 'var(--reflect-card-bg)', padding: '0 8px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--reflect-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                              vs
                            </span>
                          </div>
                        </div>

                        {/* Right claim (newer) */}
                        <button
                          type="button"
                          onClick={() => setSelectedClaim('right')}
                          className="reflect-card"
                          style={{
                            background: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            cursor: 'pointer',
                            textAlign: 'left',
                            position: 'relative',
                            transition: 'all 0.2s',
                            border: selectedClaim === 'right' ? '2px solid rgba(255,69,0,0.3)' : '1px solid rgba(0,0,0,0.08)',
                          }}
                        >
                          {/* Newest badge */}
                          <div style={{
                            position: 'absolute',
                            top: -12,
                            right: 16,
                            background: '#ef4444',
                            color: '#fff',
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 4,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            letterSpacing: '0.05em',
                          }}>
                            NEWEST
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '1rem', lineHeight: 1.4 }}>{rightText}</div>
                            <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--reflect-muted)', fontWeight: 600, marginTop: 4 }}>
                              {rightLabel}
                            </div>
                          </div>
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              border: selectedClaim === 'right' ? '5px solid var(--reflect-primary)' : '2px solid rgba(0,0,0,0.2)',
                              flexShrink: 0,
                              transition: 'all 0.2s',
                            }}
                          />
                        </button>
                      </div>

                      {/* Action buttons */}
                      {item.status === 'resolved' ? (
                        <div style={{ color: 'var(--reflect-muted)', fontSize: '0.85rem' }}>
                          Resolved
                        </div>
                      ) : isEditingMerge ? (
                        <div style={{ display: 'grid', gap: 12 }}>
                          <input
                            aria-label="Merged claim"
                            value={mergeReviewText}
                            onChange={(event) => setMergeReviewText(event.target.value)}
                            style={{
                              width: '100%',
                              padding: '12px',
                              border: '1px solid rgba(0,0,0,0.15)',
                              borderRadius: 8,
                              font: 'inherit',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 12 }}>
                            <button
                              className="button button--primary"
                              onClick={() => resolveReview(item, 'merge', mergeReviewText)}
                              style={{ flex: 1 }}
                            >
                              Apply merge
                            </button>
                            <button
                              className="button"
                              onClick={resetMergeEditor}
                              style={{
                                width: 56,
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 12 }}>
                          <button
                            className="button button--primary"
                            onClick={() => resolveReview(item, selectedClaim === 'left' ? 'confirm-left' : 'confirm-right')}
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>check</span>
                            Confirm Selected
                          </button>
                          <button
                            className="button"
                            onClick={() => {
                              setMergeReviewId(item.id)
                              setMergeReviewText(leftText)
                            }}
                            style={{
                              width: 56,
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>edit</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ) : (
            <section>
              <div className="reflect-chip-row no-scrollbar" style={{ marginBottom: 16 }}>
                <button
                  className={`reflect-chip ${followupSubTab === 'actions' ? 'is-active' : ''}`}
                  onClick={() => setFollowupSubTab('actions')}
                >
                  Actions
                </button>
                <button
                  className={`reflect-chip ${followupSubTab === 'goals' ? 'is-active' : ''}`}
                  onClick={() => setFollowupSubTab('goals')}
                >
                  Goals
                </button>
              </div>

              {followupSubTab === 'actions' ? (
                <>
                  {grouped.map((group) => (
                <div key={group.due} style={{ marginTop: 24 }}>
                  <div className="reflect-subtitle" style={{ marginLeft: 4 }}>
                    {group.due}
                  </div>
                  <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                    {group.items.length === 0 ? (
                      <div className="reflect-card">No items yet.</div>
                    ) : (
                      group.items.map((loop) => {
                        const draftAction = draftActions.find((a) => a.id === loop.id)
                        const hasDraft = draftAction?.draftContent && draftAction.status === 'approved'
                        const isCompleted = draftAction?.status === 'completed'
                        const hasFailed = draftAction?.status === 'failed'

                        return (
                          <div key={loop.id} className="reflect-card" style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: '100%' }}>
                            <button
                              style={{ border: 'none', background: 'none', color: 'var(--reflect-primary)', flexShrink: 0 }}
                              onClick={() => toggleDone(loop.id)}
                              aria-label={`Toggle ${loop.title}`}
                            >
                              <span className="material-symbols-outlined">
                                {loop.done || isCompleted ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 600 }}>{loop.title}</span>
                                {hasDraft && (
                                  <span
                                    style={{
                                      fontSize: '0.65rem',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: 'rgba(59, 130, 246, 0.15)',
                                      color: '#3b82f6',
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                    }}
                                  >
                                    Review
                                  </span>
                                )}
                                {isCompleted && (
                                  <span
                                    style={{
                                      fontSize: '0.65rem',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: 'rgba(34, 197, 94, 0.15)',
                                      color: '#22c55e',
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                    }}
                                  >
                                    Done
                                  </span>
                                )}
                                {hasFailed && (
                                  <span
                                    style={{
                                      fontSize: '0.65rem',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: 'rgba(239, 68, 68, 0.15)',
                                      color: '#ef4444',
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                    }}
                                  >
                                    Failed
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--reflect-muted)' }}>
                                Source:{' '}
                                {loop.sourceId ? (
                                  <button
                                    type="button"
                                    style={{
                                      border: 'none',
                                      background: 'none',
                                      padding: 0,
                                      color: 'var(--reflect-primary)',
                                      textDecoration: 'underline',
                                      cursor: 'pointer',
                                      fontSize: 'inherit',
                                    }}
                                    onClick={() => {
                                      const moment = moments.find((m) => m.id === loop.sourceId)
                                      if (moment) openMoment(moment)
                                    }}
                                  >
                                    {loop.source}
                                  </button>
                                ) : (
                                  loop.source
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                  </div>
                  ))}
                </>
              ) : (
                /* Goals sub-tab content */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <button
                      className="button button--primary"
                      onClick={() => setShowCreateGoal(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                      New Goal
                    </button>
                  </div>
                  <div className="reflect-chip-row no-scrollbar" style={{ marginBottom: 16 }}>
                    {(['active', 'completed', 'all'] as const).map((filter) => (
                      <button
                        key={filter}
                        className={`reflect-chip ${goalFilter === filter ? 'is-active' : ''}`}
                        onClick={() => setGoalFilter(filter)}
                      >
                        {filter === 'active'
                          ? `Active (${goals.filter((g) => g.status === 'active' || g.status === 'paused').length})`
                          : filter === 'completed'
                            ? `Completed (${goals.filter((g) => g.status === 'completed').length})`
                            : `All (${goals.length})`}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {filteredGoals.length === 0 ? (
                      <div className="reflect-card" style={{ textAlign: 'center', padding: 32 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--reflect-muted)', marginBottom: 12 }}>
                          flag
                        </span>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>No goals yet</div>
                        <div style={{ color: 'var(--reflect-muted)', marginBottom: 16 }}>
                          Set your first goal to start tracking your progress!
                        </div>
                        <button className="button button--primary" onClick={() => setShowCreateGoal(true)}>
                          Create Your First Goal
                        </button>
                      </div>
                    ) : (
                      filteredGoals.map((goal) => (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          onClick={() => setActiveGoal(goal)}
                        />
                      ))
                    )}
                  </div>
                </>
              )}
            </section>
          )}
        </main>

        <nav className="reflect-nav">
          <div className="reflect-nav-inner">
            <Link to="/reflect" className={`reflect-nav-item ${activeTab === 'memories' ? 'active' : ''}`}>
              <span
                className={`material-symbols-outlined ${activeTab === 'memories' ? 'fill-1' : ''}`}
                aria-hidden="true"
              >
                auto_stories
              </span>
              Memories
            </Link>
            <Link to="/reflect?tab=profile" className={`reflect-nav-item ${activeTab === 'profile' ? 'active' : ''}`}>
              <span
                className={`material-symbols-outlined ${activeTab === 'profile' ? 'fill-1' : ''}`}
                aria-hidden="true"
              >
                person
              </span>
              About Me
            </Link>
            <div className="reflect-nav-center">
              <button aria-label="Record" onClick={() => navigate('/chat')}>
                <span className="material-symbols-outlined" aria-hidden="true">mic</span>
              </button>
            </div>
            <Link
              to="/reflect?tab=follow-ups"
              className={`reflect-nav-item ${activeTab === 'follow-ups' ? 'active' : ''}`}
            >
              <span
                className={`material-symbols-outlined ${activeTab === 'follow-ups' ? 'fill-1' : ''}`}
                aria-hidden="true"
              >
                checklist
              </span>
              Commitments
            </Link>
            <Link to="/reflect?tab=review" className={`reflect-nav-item ${activeTab === 'review' ? 'active' : ''}`}>
              <span
                className={`material-symbols-outlined ${activeTab === 'review' ? 'fill-1' : ''}`}
                aria-hidden="true"
              >
                history_edu
              </span>
              Review
            </Link>
          </div>
          <div style={{ height: 4 }} />
        </nav>
      </div>

      {activeClaim ? (
        <div className="detail-backdrop">
          <div className="detail-modal">
            <div className="detail-header">
              <div>
                <div className="reflect-subtitle">Claim detail</div>
                <div style={{ fontWeight: 600 }}>{activeClaim.text}</div>
              </div>
              <button className="icon-button" aria-label="Close" onClick={() => setActiveClaim(null)}>
                x
              </button>
            </div>
            <div className="claim-actions">
              <button className="button button--primary" onClick={() => handleClaimStatus(activeClaim.id, 'confirmed')}>
                Confirm
              </button>
              <button className="button" onClick={() => handleClaimStatus(activeClaim.id, 'inferred')}>
                Inferred
              </button>
              <button className="button button--danger" onClick={() => handleClaimStatus(activeClaim.id, 'rejected')}>
                Reject
              </button>
            </div>
            <div className="detail-section">
              <div className="reflect-subtitle">Edit claim</div>
              <input value={editingClaim} onChange={(event) => setEditingClaim(event.target.value)} />
              <button className="button" onClick={handleClaimEdit}>
                Save edit
              </button>
            </div>
            <div className="detail-section">
              <div className="reflect-subtitle">Receipts</div>
              {activeClaim.evidence.map((ev) => (
                <div key={ev.id} className="detail-pill">
                  <div style={{ fontWeight: 600 }}>{ev.momentTitle}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)' }}>{ev.timestamp}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)' }}>{ev.snippet}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeMoment ? (
        <div className="detail-backdrop">
          <div className="detail-modal">
            <div className="detail-header">
              <div>
                <div className="reflect-subtitle">Moment detail</div>
                <div style={{ fontWeight: 600 }}>{activeMoment.summary}</div>
              </div>
              <button className="icon-button" aria-label="Close" onClick={() => setActiveMoment(null)}>
                x
              </button>
            </div>
            <div className="detail-section">
              <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)' }}>{activeMoment.startedAt}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{activeMoment.excerpt}</div>
            </div>
            <div className="detail-section">
              <div className="reflect-subtitle">Attachments</div>
              {activeMoment.attachments.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)' }}>No attachments.</div>
              ) : (
                activeMoment.attachments.map((item) => (
                  <div key={item} className="detail-pill">
                    {item}
                  </div>
                ))
              )}
            </div>
            <div className="detail-section">
              <div className="reflect-subtitle">Linked claims</div>
              {activeMoment.linkedClaims.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)' }}>No linked claims.</div>
              ) : (
                activeMoment.linkedClaims.map((claimId) => {
                  const claim = claims.find((entry) => entry.id === claimId)
                  return claim ? (
                    <div key={claim.id} className="detail-pill">
                      {claim.text}
                    </div>
                  ) : null
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeGoal ? (
        <GoalDetail
          goal={activeGoal}
          onClose={() => setActiveGoal(null)}
          onUpdateGoal={(updates) => handleUpdateGoal(activeGoal.id, updates)}
          onToggleMilestone={(milestoneId, completed) => handleToggleMilestone(activeGoal.id, milestoneId, completed)}
          onAddMilestone={(title) => handleAddMilestone(activeGoal.id, title)}
          onDeleteMilestone={(milestoneId) => handleDeleteMilestone(activeGoal.id, milestoneId)}
          onCheckIn={() => {
            setCheckingInGoal(activeGoal)
            setActiveGoal(null)
          }}
        />
      ) : null}

      {showCreateGoal ? (
        <CreateGoalModal
          onClose={() => setShowCreateGoal(false)}
          onCreate={handleCreateGoal}
        />
      ) : null}

      {checkingInGoal ? (
        <GoalCheckIn
          goal={checkingInGoal}
          onClose={() => setCheckingInGoal(null)}
          onSubmit={(data) => handleCheckIn(checkingInGoal.id, data)}
        />
      ) : null}

      {reviewingAction ? (
        <DraftReviewModal
          action={reviewingAction}
          onClose={() => setReviewingAction(null)}
          onApprove={() => handleApproveDraft(reviewingAction.id)}
          onEdit={(newContent) => handleEditDraft(reviewingAction.id, newContent)}
          onDismiss={() => handleDismissAction(reviewingAction.id)}
        />
      ) : null}
    </AppShell>
  )
}
