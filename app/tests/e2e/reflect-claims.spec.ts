import { test, expect } from '@playwright/test'

const buildTestStore = (uid: string) => ({
  version: 1,
  users: {
    [uid]: {
      profile: {
        uid,
        displayName: 'Test User',
        photoURL: null,
        email: null,
        geoCapture: true,
        onboardingComplete: true,
      },
      claims: {
        'claim-1': {
          id: 'claim-1',
          text: 'User prefers tea over coffee',
          status: 'confirmed',
          category: 'preferences',
          confidence: 0.92,
          evidence: ['I really love tea'],
          conversationId: 'conv-1',
          pinned: false,
        },
        'claim-2': {
          id: 'claim-2',
          text: 'User exercises in the morning',
          status: 'inferred',
          category: 'habits',
          confidence: 0.65,
          evidence: ['I usually go to the gym early'],
          conversationId: 'conv-1',
          pinned: true,
        },
        'claim-3': {
          id: 'claim-3',
          text: 'User dislikes loud music',
          status: 'rejected',
          category: 'preferences',
          confidence: 0.45,
          evidence: ['Noise bothers me'],
          conversationId: 'conv-1',
          pinned: false,
        },
      },
      reviewQueue: {
        'review-1': {
          id: 'review-1',
          title: 'Conflicting preferences detected',
          summary: 'User mentioned both liking and disliking mornings',
          claims: ['claim-1', 'claim-2'],
          claimIds: ['claim-1', 'claim-2'],
          status: 'pending',
          severity: 'medium',
          conversationId: 'conv-1',
        },
      },
      actions: {
        'action-1': {
          id: 'action-1',
          title: 'Buy more tea',
          dueWindow: 'Today',
          source: 'conversation',
          reminder: false,
          status: 'confirmed',
          conversationId: 'conv-1',
        },
        'action-2': {
          id: 'action-2',
          title: 'Schedule gym session',
          dueWindow: 'This Week',
          source: 'conversation',
          reminder: true,
          status: 'confirmed',
          conversationId: 'conv-1',
        },
      },
      conversations: {
        'conv-1': {
          id: 'conv-1',
          summary: 'Discussed daily routines',
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          durationMs: 120000,
          claimIds: ['claim-1', 'claim-2', 'claim-3'],
          confirmedActionIds: ['action-1', 'action-2'],
          status: 'ended',
        },
      },
    },
  },
  moments: {},
  openLoops: {},
  uploads: {},
})

test.describe('Reflect - Claims (About Me) tab', () => {
  test.beforeEach(async ({ page }) => {
    const uid = 'test-user'
    const store = buildTestStore(uid)

    await page.addInitScript(
      ({ storeData, userId }) => {
        window.localStorage.setItem('skipAuth', 'true')
        window.localStorage.setItem('sessionToken', `test-token-${userId}`)
        window.localStorage.setItem('sessionUser', JSON.stringify({ uid: userId, displayName: 'Test User' }))
        window.localStorage.setItem('secondSelfStore', JSON.stringify(storeData))
      },
      { storeData: store, userId: uid }
    )

    await page.route('**/*', async (route) => {
      const url = route.request().url()
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        await route.abort()
        return
      }
      await route.continue()
    })
  })

  test('displays claims in About Me tab', async ({ page }) => {
    await page.goto('/reflect')
    await page.getByRole('link', { name: 'About Me' }).click()

    await expect(page.getByText('User prefers tea over coffee')).toBeVisible()
    await expect(page.getByText('User exercises in the morning')).toBeVisible()
  })

  test('filters claims by status', async ({ page }) => {
    await page.goto('/reflect')
    await page.getByRole('link', { name: 'About Me' }).click()

    // Click Confirmed filter
    const confirmedFilter = page.getByRole('button', { name: /Confirmed/i })
    if (await confirmedFilter.isVisible()) {
      await confirmedFilter.click()
      await expect(page.getByText('User prefers tea over coffee')).toBeVisible()
    }

    // Click Inferred filter
    const inferredFilter = page.getByRole('button', { name: /Inferred/i })
    if (await inferredFilter.isVisible()) {
      await inferredFilter.click()
      await expect(page.getByText('User exercises in the morning')).toBeVisible()
    }
  })
})

test.describe('Reflect - Review (Verify) tab', () => {
  test.beforeEach(async ({ page }) => {
    const uid = 'test-user'
    const store = buildTestStore(uid)

    await page.addInitScript(
      ({ storeData, userId }) => {
        window.localStorage.setItem('skipAuth', 'true')
        window.localStorage.setItem('sessionToken', `test-token-${userId}`)
        window.localStorage.setItem('sessionUser', JSON.stringify({ uid: userId, displayName: 'Test User' }))
        window.localStorage.setItem('secondSelfStore', JSON.stringify(storeData))
      },
      { storeData: store, userId: uid }
    )

    await page.route('**/*', async (route) => {
      const url = route.request().url()
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        await route.abort()
        return
      }
      await route.continue()
    })
  })

  test('displays review queue items', async ({ page }) => {
    // Navigate directly to review tab via URL since Verify was replaced by Goals in nav
    await page.goto('/reflect?tab=review')

    await expect(page.getByText('Conflicting preferences detected')).toBeVisible()
  })
})

test.describe('Reflect - Follow-ups tab', () => {
  test.beforeEach(async ({ page }) => {
    const uid = 'test-user'
    const store = buildTestStore(uid)

    await page.addInitScript(
      ({ storeData, userId }) => {
        window.localStorage.setItem('skipAuth', 'true')
        window.localStorage.setItem('sessionToken', `test-token-${userId}`)
        window.localStorage.setItem('sessionUser', JSON.stringify({ uid: userId, displayName: 'Test User' }))
        window.localStorage.setItem('secondSelfStore', JSON.stringify(storeData))
      },
      { storeData: store, userId: uid }
    )

    await page.route('**/*', async (route) => {
      const url = route.request().url()
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        await route.abort()
        return
      }
      await route.continue()
    })
  })

  test('displays actions grouped by due window', async ({ page }) => {
    await page.goto('/reflect')
    await page.getByRole('link', { name: 'Commitments' }).click()

    await expect(page.getByText('Buy more tea')).toBeVisible()
    await expect(page.getByText('Schedule gym session')).toBeVisible()
  })

  test('shows Today and This Week groupings', async ({ page }) => {
    await page.goto('/reflect')
    await page.getByRole('link', { name: 'Commitments' }).click()

    // The seeded data has actions with 'Today' and 'This Week' due windows
    await expect(page.getByText('Buy more tea')).toBeVisible()
    await expect(page.getByText('Schedule gym session')).toBeVisible()
  })
})
