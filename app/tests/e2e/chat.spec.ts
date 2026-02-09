import { test, expect } from '@playwright/test'

test('User flow: Hub → Chat → voice session → hang-up recap', async ({ page }) => {
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

  // Hub
  await page.goto('/')
  // The Hub now shows a dynamic greeting
  await expect(page.getByText(/Good (morning|afternoon|evening)/).first()).toBeVisible()

  // Navigate to Chat
  await page.getByRole('link', { name: 'Chat' }).click()
  await expect(page.getByLabel('Microphone')).toBeVisible()

  // Start (and then end) a voice session.
  await page.getByLabel('Microphone').click()
  await expect(page.getByText(/Listening|Paused|Tap to start|Tap to resume/)).toBeVisible()

  await page.getByLabel('End session').click()

  // Recap
  await expect(page.getByText('Session Recap')).toBeVisible()
  // AI Summary card is only shown when a summary exists.
  await expect(page.getByRole('heading', { name: 'Knowledge inferred' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Confirmed Actions' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Suggested Actions' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Rejected Actions' })).toBeVisible()

  // Close recap returns to Hub
  await page.getByLabel('Close recap').click()
  await expect(page.getByText(/Good (morning|afternoon|evening)/).first()).toBeVisible()
})
