import { test, expect } from '@playwright/test'

test('Hub renders in portrait layout', async ({ page }) => {
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

  await page.goto('/')

  // The Hub now shows a dynamic greeting - check for any time-based greeting (use first() as there may be multiple)
  await expect(page.getByText(/Good (morning|afternoon|evening)/).first()).toBeVisible()
  await expect(page.getByText('Chat')).toBeVisible()
  await expect(page.getByText('Reflect')).toBeVisible()

  const frame = page.locator('.app-screen')
  await expect(frame).toBeVisible()

  const box = await frame.boundingBox()
  expect(box).not.toBeNull()
  if (box) {
    expect(box.width).toBeLessThanOrEqual(400)
    expect(box.height).toBeGreaterThanOrEqual(800)
  }
})