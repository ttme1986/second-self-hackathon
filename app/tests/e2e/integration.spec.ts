import { test, expect } from '@playwright/test'

type SessionContext = {
  uid: string
  token: string
}

type SeededData = {
  startedAt: string
  claimA: string
  reviewTitle: string
  actionTitle: string
}

const buildSeedStore = (session: SessionContext): { store: any; seeded: SeededData } => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const conversationId = `e2e-${runId}`
  const startedAt = new Date().toISOString()
  const endedAt = new Date(Date.now() + 60_000).toISOString()

  const claimA = `E2E prefers tea ${runId}`
  const claimB = `E2E avoids coffee ${runId}`
  const claimAId = `claim-a-${runId}`
  const claimBId = `claim-b-${runId}`
  const reviewTitle = `Potential conflict ${runId}`
  const reviewId = `review-${runId}`
  const actionTitle = `Follow up ${runId}`
  const actionId = `action-${runId}`

  const store = {
    version: 1,
    users: {
      [session.uid]: {
        profile: {
          uid: session.uid,
          displayName: 'E2E',
          photoURL: null,
          email: null,
          geoCapture: true,
          onboardingComplete: true,
        },
        claims: {
          [claimAId]: {
            id: claimAId,
            text: claimA,
            status: 'inferred',
            category: 'preferences',
            confidence: 0.72,
            evidence: [claimA],
            conversationId,
          },
          [claimBId]: {
            id: claimBId,
            text: claimB,
            status: 'confirmed',
            category: 'preferences',
            confidence: 0.91,
            evidence: [claimB],
            conversationId,
          },
        },
        reviewQueue: {
          [reviewId]: {
            id: reviewId,
            title: reviewTitle,
            summary: 'Check preferences',
            claims: [claimAId, claimBId],
            status: 'pending',
            conversationId,
          },
        },
        actions: {
          [actionId]: {
            id: actionId,
            title: actionTitle,
            dueWindow: 'Today',
            source: 'conversation',
            reminder: false,
            status: 'confirmed',
            conversationId,
          },
        },
        conversations: {
          [conversationId]: {
            id: conversationId,
            summary: `E2E ${runId} summary`,
            startedAt,
            endedAt,
            durationMs: 60_000,
            transcriptPath: `users/${session.uid}/conversations/${conversationId}/transcript.json`,
            claimIds: [claimAId, claimBId],
            confirmedActionIds: [actionId],
            transcript: [
              { speaker: 'user', text: `E2E ${runId} hello`, t_ms: 1 },
              { speaker: 'assistant', text: `E2E ${runId} hi`, t_ms: 2 },
            ],
          },
        },
      },
    },
    moments: {},
    openLoops: {},
    uploads: {},
  }

  return {
    store,
    seeded: {
      startedAt,
      claimA,
      reviewTitle,
      actionTitle,
    },
  }
}

const setSessionAndStore = async (page: any, session: SessionContext, store: any) => {
  await page.addInitScript(
    ({ token, uid, storePayload }) => {
      window.localStorage.setItem('sessionToken', token)
      window.localStorage.setItem('sessionUser', JSON.stringify({ uid, displayName: 'E2E' }))
      window.localStorage.setItem('secondSelfStore', JSON.stringify(storePayload))
    },
    { token: session.token, uid: session.uid, storePayload: store },
  )
}

test.describe.serial('Local backend integration', () => {
  test('Reflect integrates with local list endpoints', async ({ page }) => {
    const uid = `e2e-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const session = { uid, token: `local-${uid}` }
    const { store, seeded } = buildSeedStore(session)

    await setSessionAndStore(page, session, store)
    await page.goto('/reflect')

    const onboardingModal = page.locator('.modal-backdrop')
    if (await onboardingModal.isVisible()) {
      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(onboardingModal).toBeHidden()
    }

    const momentButton = page.locator('button', { hasText: seeded.startedAt }).first()
    await expect(momentButton).toBeVisible()
    await momentButton.click()
    await expect(page.getByText('Moment detail')).toBeVisible()
    await expect(page.locator('.detail-modal').getByText(seeded.startedAt)).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()

    await page.getByRole('link', { name: 'About Me' }).click()
    await expect(page.getByText(seeded.claimA).first()).toBeVisible()

    await page.getByRole('link', { name: 'Commitments' }).click()
    await page.getByRole('button', { name: 'Goals' }).click()
    await expect(page.getByText('No goals yet')).toBeVisible()

    await page.getByRole('button', { name: 'Actions' }).click()
    await expect(page.getByText(seeded.actionTitle).first()).toBeVisible()
  })

  test('Settings deletes local data', async ({ page }) => {
    const uid = `e2e-delete-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const session = { uid, token: `local-${uid}` }
    const { store } = buildSeedStore(session)

    await setSessionAndStore(page, session, store)
    await page.goto('/settings')

    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })

    await page.getByRole('button', { name: 'Delete' }).click()

    const stored = await page.evaluate(() => {
      const raw = window.localStorage.getItem('secondSelfStore')
      return raw ? JSON.parse(raw) : null
    })
    expect(stored?.users?.[uid]).toBeUndefined()
  })
})
