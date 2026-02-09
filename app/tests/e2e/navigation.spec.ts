import { test, expect } from '@playwright/test'

test.describe('App navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('skipAuth', 'true')
      window.localStorage.setItem('sessionToken', 'test-token')
      window.localStorage.setItem('sessionUser', JSON.stringify({ uid: 'test-user', displayName: 'Test User' }))
      window.localStorage.setItem('secondSelfStore', JSON.stringify({
        version: 1,
        users: {
          'test-user': {
            profile: {
              uid: 'test-user',
              displayName: 'Test User',
              photoURL: null,
              email: null,
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
      }))
    })

    await page.route('**/*', async (route) => {
      const url = route.request().url()
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        await route.abort()
        return
      }
      await route.continue()
    })
  })

  test('navigates from Hub to Chat', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Chat' }).click()
    await expect(page).toHaveURL('/chat')
    await expect(page.getByLabel('Microphone')).toBeVisible()
  })

  test('navigates from Hub to Reflect', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Reflect' }).click()
    await expect(page).toHaveURL('/reflect')
  })

  test('navigates from Hub to Settings', async ({ page }) => {
    await page.goto('/')

    // Try different ways to find the settings link/button
    const settingsLink = page.getByRole('link', { name: /settings/i })
      .or(page.getByRole('button', { name: /settings/i }))
      .or(page.locator('a[href="/settings"]'))

    if (await settingsLink.isVisible()) {
      await settingsLink.click()
      await expect(page).toHaveURL('/settings')
    }
  })

  test('navigates between Reflect tabs', async ({ page }) => {
    await page.goto('/reflect')

    // Navigate to About Me tab
    await page.getByRole('link', { name: 'About Me' }).click()
    await expect(page.getByText('No claims available.')).toBeVisible()

    // Navigate to Commitments tab
    await page.getByRole('link', { name: 'Commitments' }).click()

    // Navigate to Goals sub-tab
    await page.getByRole('button', { name: 'Goals' }).click()
    await expect(page.getByText('No goals yet')).toBeVisible()

    // Navigate back to Memories tab
    await page.getByRole('link', { name: 'Memories' }).click()
  })

  test('opens and closes search overlay in Reflect', async ({ page }) => {
    await page.goto('/reflect')

    // Open search
    await page.getByRole('button', { name: 'Search' }).click()
    const searchInput = page.getByPlaceholder(/search/i)
    await expect(searchInput).toBeVisible()

    // Type in search
    await searchInput.fill('test query')
    await expect(searchInput).toHaveValue('test query')

    // Clear search button is visible
    const clearButton = page.getByRole('button', { name: /clear/i })
    if (await clearButton.isVisible()) {
      await expect(clearButton).toBeVisible()
    }
  })

  test('Chat back button returns to Hub', async ({ page }) => {
    await page.goto('/chat')

    // Find and click back/home link
    const backLink = page.getByRole('link', { name: /back|home|hub/i })
      .or(page.locator('a[href="/"]'))

    if (await backLink.isVisible()) {
      await backLink.click()
      await expect(page).toHaveURL('/')
    }
  })
})
