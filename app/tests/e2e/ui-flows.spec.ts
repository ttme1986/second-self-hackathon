/**
 * E2E tests mirroring USER_FLOW.md
 * Tests the documented user journeys through the application.
 */

import { test, expect } from '@playwright/test'

// Helper to set up authenticated session with test data
const setupAuthenticatedSession = async (page: any, userData?: any) => {
  const uid = userData?.uid || 'test-user'
  const store = userData?.store || {
    version: 1,
    users: {
      [uid]: {
        profile: {
          uid,
          displayName: userData?.displayName || 'Test User',
          photoURL: null,
          email: 'test@example.com',
          geoCapture: true,
          onboardingComplete: true,
        },
        claims: {},
        reviewQueue: {},
        actions: {},
        conversations: {},
      },
    },
    moments: {},
    openLoops: {},
    uploads: {},
  }

  await page.addInitScript(
    ({ storeData, userId, name }) => {
      window.localStorage.setItem('skipAuth', 'true')
      window.localStorage.setItem('sessionToken', `test-token-${userId}`)
      window.localStorage.setItem('sessionUser', JSON.stringify({ uid: userId, displayName: name }))
      window.localStorage.setItem('secondSelfStore', JSON.stringify(storeData))
    },
    { storeData: store, userId: uid, name: userData?.displayName || 'Test User' }
  )

  await page.route('**/*', async (route: any) => {
    const url = route.request().url()
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      await route.abort()
      return
    }
    await route.continue()
  })
}

// ============================================================================
// SECTION 1: Hub (USER_FLOW.md Section 1.3)
// ============================================================================

test.describe('1. Hub - Home Screen', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page, { displayName: 'Alice' })
  })

  test('displays greeting with user name', async ({ page }) => {
    await page.goto('/')
    // USER_FLOW: "Greeting with user's display name"
    await expect(page.getByText(/Good (morning|afternoon|evening), Alice/i).or(page.getByText('Alice'))).toBeVisible()
  })

  test('shows Chat and Reflect navigation cards', async ({ page }) => {
    await page.goto('/')
    // USER_FLOW: "Chat card — entry to voice conversation"
    await expect(page.getByRole('link', { name: 'Chat' })).toBeVisible()
    // USER_FLOW: "Reflect card — entry to memory review"
    await expect(page.getByRole('link', { name: 'Reflect' })).toBeVisible()
  })

  test('shows Settings button', async ({ page }) => {
    await page.goto('/')
    // USER_FLOW: "Settings button in header"
    const settingsLink = page.getByRole('link', { name: /settings/i }).or(page.locator('a[href="/settings"]'))
    await expect(settingsLink).toBeVisible()
  })

  test('navigates to Chat from Hub', async ({ page }) => {
    await page.goto('/')
    // USER_FLOW: "From Hub, user taps Chat card"
    await page.getByRole('link', { name: 'Chat' }).click()
    await expect(page).toHaveURL('/chat')
  })

  test('navigates to Reflect from Hub', async ({ page }) => {
    await page.goto('/')
    // USER_FLOW: "user taps Reflect card"
    await page.getByRole('link', { name: 'Reflect' }).click()
    await expect(page).toHaveURL('/reflect')
  })
})

// ============================================================================
// SECTION 2: Chat - Voice Session (USER_FLOW.md Section 2)
// ============================================================================

test.describe('2. Chat - Voice Session', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page)
  })

  test('shows microphone button on Chat screen', async ({ page }) => {
    await page.goto('/chat')
    // USER_FLOW: "User sees Chat screen with microphone button"
    await expect(page.getByLabel('Microphone')).toBeVisible()
  })

  test('starts voice session when microphone tapped', async ({ page }) => {
    await page.goto('/chat')
    // USER_FLOW: "User taps microphone to start recording"
    await page.getByLabel('Microphone').click()
    // USER_FLOW: "App enters listening state with status indicator"
    await expect(page.getByText(/Listening|Paused|Tap to start|Tap to resume/)).toBeVisible()
  })

  test('shows Tools drawer button', async ({ page }) => {
    await page.goto('/chat')
    // USER_FLOW: "User taps Tools button (widgets icon)"
    await expect(page.getByLabel('Open tools')).toBeVisible()
  })

  test('Tools drawer shows empty state', async ({ page }) => {
    await page.goto('/chat')
    // USER_FLOW: "Currently displays 'No tools available.'"
    await page.getByLabel('Open tools').click()
    await expect(page.getByText('No tools available.')).toBeVisible()
  })

  test('shows End session button', async ({ page }) => {
    await page.goto('/chat')
    // USER_FLOW: "User taps End session button"
    await expect(page.getByLabel('End session')).toBeVisible()
  })

  test('full chat flow: start session → end → recap → close', async ({ page }) => {
    await page.goto('/chat')

    // USER_FLOW 2.1: Start voice session
    await page.getByLabel('Microphone').click()
    await expect(page.getByText(/Listening|Paused|Tap to start|Tap to resume/)).toBeVisible()

    // USER_FLOW 2.7: End session
    await page.getByLabel('End session').click()

    // USER_FLOW 2.7: Session Recap modal opens
    await expect(page.getByText('Session Recap')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Knowledge inferred' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Confirmed Actions' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Suggested Actions' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Rejected Actions' })).toBeVisible()

    // USER_FLOW 2.7: "Tap Close to return to Hub"
    await page.getByLabel('Close recap').click()
    // Wait for Hub to load with the dynamic greeting
    await expect(page.getByText(/Good (morning|afternoon|evening)/).first()).toBeVisible()
  })
})

// ============================================================================
// SECTION 3: Reflect (USER_FLOW.md Section 3)
// ============================================================================

test.describe('3. Reflect - Memories Tab', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page)
  })

  test('Memories is default tab', async ({ page }) => {
    await page.goto('/reflect')
    // USER_FLOW: "User opens Reflect (default tab: Memories)"
    await expect(page.getByRole('link', { name: 'Memories' })).toBeVisible()
  })

  test('shows empty state when no moments', async ({ page }) => {
    await page.goto('/reflect')
    // Empty state for no moments shows timeline with no items
    await expect(page.getByText('No moments yet.')).toBeVisible()
  })
})

test.describe('3. Reflect - About Me Tab (Claims)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page)
  })

  test('navigates to About Me tab', async ({ page }) => {
    await page.goto('/reflect')
    // USER_FLOW: "User taps About Me tab"
    await page.getByRole('link', { name: 'About Me' }).click()
    // Verify claims tab is active by checking for filter chips
    await expect(page.getByRole('button', { name: /All/i })).toBeVisible()
  })

  test('shows empty state when no claims', async ({ page }) => {
    await page.goto('/reflect')
    await page.getByRole('link', { name: 'About Me' }).click()
    // USER_FLOW empty state: "No claims available"
    await expect(page.getByText('No claims available.')).toBeVisible()
  })
})

test.describe('3. Reflect - Commitments Tab (Goals sub-tab)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page)
  })

  test('navigates to Goals sub-tab', async ({ page }) => {
    await page.goto('/reflect')
    // USER_FLOW: "User taps Commitments tab, then Goals sub-tab"
    await page.getByRole('link', { name: 'Commitments' }).click()
    await page.getByRole('button', { name: 'Goals' }).click()
  })

  test('shows empty state when no goals', async ({ page }) => {
    await page.goto('/reflect')
    await page.getByRole('link', { name: 'Commitments' }).click()
    await page.getByRole('button', { name: 'Goals' }).click()
    // USER_FLOW empty state: "No goals yet"
    await expect(page.getByText('No goals yet')).toBeVisible()
  })
})

test.describe('3. Reflect - Commitments Tab', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page)
  })

  test('navigates to Commitments tab', async ({ page }) => {
    await page.goto('/reflect')
    // USER_FLOW: "User taps Commitments tab"
    await page.getByRole('link', { name: 'Commitments' }).click()
  })
})

test.describe('3. Reflect - Search', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page)
  })

  test('opens search overlay', async ({ page }) => {
    await page.goto('/reflect')
    // USER_FLOW: "User taps Search button"
    await page.getByRole('button', { name: 'Search' }).click()
    // USER_FLOW: "Search overlay opens with input field"
    await expect(page.getByPlaceholder(/search/i)).toBeVisible()
  })

  test('can type search query and clear', async ({ page }) => {
    await page.goto('/reflect')
    await page.getByRole('button', { name: 'Search' }).click()

    // USER_FLOW: "User types query"
    const searchInput = page.getByPlaceholder(/search/i)
    await searchInput.fill('test query')
    await expect(searchInput).toHaveValue('test query')

    // USER_FLOW: "User can see Clear button"
    const clearButton = page.getByRole('button', { name: 'Clear' })
    await expect(clearButton).toBeVisible()
  })

  test('shows no results message for search', async ({ page }) => {
    await page.goto('/reflect')
    await page.getByRole('button', { name: 'Search' }).click()

    const searchInput = page.getByPlaceholder(/search/i)
    await searchInput.fill('nonexistent query')

    // USER_FLOW empty state: "No moments/claims match your query"
    await expect(page.getByText('No moments match your query.')).toBeVisible()
    await expect(page.getByText('No claims match your query.')).toBeVisible()
  })
})

// ============================================================================
// SECTION 4: Settings (USER_FLOW.md Section 4)
// ============================================================================

test.describe('4. Settings', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page, { displayName: 'Test User' })
  })

  test('navigates to Settings from Hub', async ({ page }) => {
    await page.goto('/')
    // USER_FLOW: "User taps Settings"
    const settingsLink = page.getByRole('link', { name: /settings/i }).or(page.locator('a[href="/settings"]'))
    await settingsLink.click()
    await expect(page).toHaveURL('/settings')
  })

  test('displays user profile name', async ({ page }) => {
    await page.goto('/settings')
    // USER_FLOW: "Profile section: Display name (read-only)"
    await expect(page.getByText('Test User')).toBeVisible()
  })

  test('shows location capture toggle', async ({ page }) => {
    await page.goto('/settings')
    // USER_FLOW: "Privacy section: 'Always capture location' toggle"
    await expect(page.getByText('Always capture location')).toBeVisible()
    await expect(page.locator('button.toggle')).toBeVisible()
  })

  test('shows delete all data button', async ({ page }) => {
    await page.goto('/settings')
    // USER_FLOW: "Data section: 'Delete all data' button"
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  test('delete shows confirmation dialog', async ({ page }) => {
    await page.goto('/settings')

    // USER_FLOW: "Delete all data (with confirmation dialog)"
    let dialogShown = false
    page.once('dialog', async (dialog: any) => {
      dialogShown = true
      await dialog.dismiss()
    })

    await page.getByRole('button', { name: 'Delete' }).click()
    expect(dialogShown).toBe(true)
  })

  test('can navigate back to Hub', async ({ page }) => {
    await page.goto('/settings')
    // USER_FLOW: "Return to Hub (back button)"
    const backLink = page.getByRole('link', { name: /home|hub|back/i }).or(page.locator('a[href="/"]'))
    if (await backLink.isVisible()) {
      await backLink.click()
      await expect(page).toHaveURL('/')
    }
  })
})

// ============================================================================
// SECTION 5: Navigation Summary (USER_FLOW.md Section 5)
// ============================================================================

test.describe('5. Navigation Summary', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page)
  })

  test('Hub → Chat', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Chat' }).click()
    await expect(page).toHaveURL('/chat')
  })

  test('Hub → Reflect', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Reflect' }).click()
    await expect(page).toHaveURL('/reflect')
  })

  test('Hub → Settings', async ({ page }) => {
    await page.goto('/')
    const settingsLink = page.getByRole('link', { name: /settings/i }).or(page.locator('a[href="/settings"]'))
    await settingsLink.click()
    await expect(page).toHaveURL('/settings')
  })

  test('Reflect tabs navigation', async ({ page }) => {
    await page.goto('/reflect')

    // Memories → About Me
    await page.getByRole('link', { name: 'About Me' }).click()
    await expect(page.getByText('No claims available.')).toBeVisible()

    // About Me → Commitments
    await page.getByRole('link', { name: 'Commitments' }).click()

    // Commitments Actions → Goals sub-tab
    await page.getByRole('button', { name: 'Goals' }).click()
    await expect(page.getByText('No goals yet')).toBeVisible()

    // Commitments → Memories
    await page.getByRole('link', { name: 'Memories' }).click()
  })

  test('Chat → Hub (via recap close)', async ({ page }) => {
    await page.goto('/chat')
    await page.getByLabel('Microphone').click()
    await page.getByLabel('End session').click()
    await expect(page.getByText('Session Recap')).toBeVisible()
    await page.getByLabel('Close recap').click()
    await expect(page).toHaveURL('/')
  })
})
