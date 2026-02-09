import { filterClaims, groupClaimsByCategory, searchRecords, type Claim, type Moment } from '../../src/reflect/reflectData'

describe('reflect data helpers', () => {
  const claims: Claim[] = [
    {
      id: 'c1',
      text: 'Prefers tea.',
      status: 'confirmed',
      category: 'preferences',
      confidence: 0.9,
      pinned: false,
      evidence: [
        { id: 'e1', momentTitle: 'Morning', snippet: 'Tea daily', timestamp: '2024-10-01' },
      ],
    },
    {
      id: 'c2',
      text: 'Practices design critique.',
      status: 'inferred',
      category: 'skills',
      confidence: 0.6,
      pinned: false,
      evidence: [
        { id: 'e2', momentTitle: 'Review', snippet: 'Weekly critique', timestamp: '2024-10-02' },
      ],
    },
  ]
  const moments: Moment[] = [
    {
      id: 'm1',
      summary: 'Morning routine summary',
      startedAt: '2024-10-01',
      excerpt: 'Tea and journaling.',
      tags: ['tea'],
      attachments: [],
      linkedClaims: ['c1'],
    },
  ]

  it('should filter claims by status', () => {
    const confirmed = filterClaims(claims, 'confirmed')
    expect(confirmed.every((claim) => claim.status === 'confirmed')).toBe(true)

    const inferred = filterClaims(claims, 'inferred')
    expect(inferred.every((claim) => claim.status === 'inferred')).toBe(true)
  })

  it('should group claims by category', () => {
    const grouped = groupClaimsByCategory(claims)
    const preferencesGroup = grouped.find((group) => group.id === 'preferences')

    expect(preferencesGroup).toBeDefined()
    expect(preferencesGroup?.items.length).toBeGreaterThan(0)
  })

  it('should search moments and claims', () => {
    const results = searchRecords(moments, claims, 'tea')
    expect(results.moments.length).toBeGreaterThan(0)
    expect(results.claims.length).toBeGreaterThan(0)
  })
})


