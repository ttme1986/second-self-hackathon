import { test, expect } from '@playwright/test'

test('Reflect surface shows empty states without mock data', async ({ page }) => {
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

  await page.goto('/reflect')

  // Open the search overlay, then use the overlay placeholder.
  await page.getByRole('button', { name: 'Search' }).click()
  const searchInput = page.getByPlaceholder('Search memories, claims, receipts')
  await searchInput.fill('tea')
  await expect(page.getByText('No moments match your query.')).toBeVisible()
  await expect(page.getByText('No claims match your query.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear' }).click()

  await page.getByRole('link', { name: 'About Me' }).click()
  await expect(page.getByText('No claims available.')).toBeVisible()

  await page.getByRole('link', { name: 'Commitments' }).click()
  await page.getByRole('button', { name: 'Goals' }).click()
  await expect(page.getByText('No goals yet')).toBeVisible()
})
