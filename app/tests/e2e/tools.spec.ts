import { test, expect } from '@playwright/test'

test('Tools drawer shows empty state when unconfigured', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('skipAuth', 'true')
  })

  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      await route.abort()
      return
    }
    await route.continue()
  })

  await page.goto('/chat')

  await page.getByLabel('Open tools').click()
  await expect(page.getByText('No tools available.')).toBeVisible()
})
