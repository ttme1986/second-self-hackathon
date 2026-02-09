type ClaimStatus = 'confirmed' | 'inferred' | 'rejected'
type ClaimCategory = 'preferences' | 'skills' | 'relationships' | 'other'

type Evidence = {
  id: string
  momentTitle: string
  snippet: string
  timestamp: string
}

type Claim = {
  id: string
  text: string
  status: ClaimStatus
  category: ClaimCategory
  confidence: number
  pinned?: boolean
  createdAt?: string
  evidence: Evidence[]
}

type Moment = {
  id: string
  summary: string
  startedAt: string
  excerpt: string
  tags: string[]
  attachments: string[]
  linkedClaims: string[]
}

type ReviewSeverity = 'low' | 'medium' | 'high'

type ReviewItem = {
  id: string
  title: string
  summary: string
  claims: [string, string]
  claimIds: [string, string]
  status: 'pending' | 'resolved'
  severity?: ReviewSeverity
  resolution?: 'confirm-left' | 'confirm-right' | 'reject-both' | 'merge'
}

const claimCategories: Array<{ id: ClaimCategory; label: string }> = [
  { id: 'preferences', label: 'Preferences' },
  { id: 'skills', label: 'Skills' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'other', label: 'Other' },
]

const filterClaims = (claims: Claim[], filter: 'all' | 'confirmed' | 'inferred') => {
  if (filter === 'all') return claims
  return claims.filter((claim) => claim.status === filter)
}

const groupClaimsByCategory = (claims: Claim[]) =>
  claimCategories.map((category) => ({
    id: category.id,
    label: category.label,
    items: claims.filter((claim) => claim.category === category.id),
  }))

const searchRecords = (moments: Moment[], claims: Claim[], query: string) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return { moments: [], claims: [] }
  }

  return {
    moments: moments.filter(
      (moment) =>
        moment.summary.toLowerCase().includes(normalized) ||
        moment.excerpt.toLowerCase().includes(normalized) ||
        moment.tags.some((tag) => tag.toLowerCase().includes(normalized)),
    ),
    claims: claims.filter(
      (claim) =>
        claim.text.toLowerCase().includes(normalized) ||
        claim.evidence.some((ev) => ev.snippet.toLowerCase().includes(normalized)),
    ),
  }
}

export {
  claimCategories,
  filterClaims,
  groupClaimsByCategory,
  searchRecords,
}

export type { Claim, ClaimCategory, ClaimStatus, Evidence, Moment, ReviewItem, ReviewSeverity }
