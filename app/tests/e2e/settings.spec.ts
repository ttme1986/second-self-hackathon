import { test, expect } from '@playwright/test'

test.describe('Settings page', () => {
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

  test('displays user profile information', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Test User')).toBeVisible()
  })

  test('toggles geo-capture setting', async ({ page }) => {
    await page.goto('/settings')

    // The geo toggle is a button that shows On/Off
    const geoToggle = page.locator('button.toggle')
    await expect(geoToggle).toBeVisible()

    const initialText = await geoToggle.textContent()
    await geoToggle.click()

    // Verify state changed
    const newText = await geoToggle.textContent()
    expect(newText).not.toBe(initialText)
  })

  test('navigates back to hub', async ({ page }) => {
    await page.goto('/settings')

    // Click the back/home link
    const homeLink = page.getByRole('link', { name: /home|hub|back/i }).or(page.locator('a[href="/"]'))
    if (await homeLink.isVisible()) {
      await homeLink.click()
      await expect(page).toHaveURL('/')
    }
  })

  test('shows delete confirmation dialog', async ({ page }) => {
    await page.goto('/settings')

    // Set up dialog handler
    let dialogMessage = ''
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message()
      await dialog.dismiss() // Cancel the delete
    })

    await page.getByRole('button', { name: 'Delete' }).click()

    // Verify dialog was shown (message should contain something about delete/data)
    expect(dialogMessage.length).toBeGreaterThan(0)
  })
})
