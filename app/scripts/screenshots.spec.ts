import { test, Page, BrowserContext } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const SCREENSHOT_DIR = 'screenshots'

// Helper to wait for fonts (including Material Symbols icons) to load
async function waitForFonts(page: Page) {
  await page.waitForFunction(() => document.fonts.ready.then(() => true), { timeout: 10000 })
  // Extra wait for icon font rendering
  await page.waitForTimeout(500)
}

// Ensure screenshot directory exists
test.beforeAll(async () => {
  const dir = path.join(process.cwd(), SCREENSHOT_DIR)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

// Sign in with demo account - always clears and signs in fresh
async function signInWithDemo(page: Page, context: BrowserContext) {
  // Clear all storage first
  await context.clearCookies()
  await page.goto('/')
  await page.evaluate(async () => {
    localStorage.clear()
    sessionStorage.clear()
    const databases = await indexedDB.databases()
    for (const db of databases) {
      if (db.name) indexedDB.deleteDatabase(db.name)
    }
  })

  // Navigate to login page
  await page.goto('/?forceLogin')
  await page.waitForLoadState('domcontentloaded')
  await waitForFonts(page)

  // Click demo sign-in
  const demoButton = page.getByRole('button', { name: /sign in for demo/i })
  await demoButton.click()

  // Wait for login screen to disappear
  await page.waitForSelector('.login-screen', { state: 'hidden', timeout: 30000 })

  // Wait for data sync from Firestore
  await page.waitForTimeout(2000)

  // Reload to ensure ProfileProvider loads fresh data from localStorage
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1000)
}

test.describe('Design & UX Screenshots', () => {
  test('Auth/Login page', async ({ page, context }) => {
    // Clear storage for fresh login page
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(async () => {
      localStorage.clear()
      sessionStorage.clear()
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) indexedDB.deleteDatabase(db.name)
      }
    })
    // Use forceLogin param to show login page
    await page.goto('/?forceLogin')
    await page.waitForLoadState('domcontentloaded')
    await waitForFonts(page)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/00-auth.png`, fullPage: true })
  })

  test('Hub page', async ({ page, context }) => {
    await signInWithDemo(page, context)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    // Wait for profile to load - greeting should show "Alex"
    await page.waitForSelector('text=Alex', { timeout: 10000 })
    await waitForFonts(page)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-hub.png`, fullPage: true })
  })

  test('Chat page', async ({ page, context }) => {
    await signInWithDemo(page, context)
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
    await waitForFonts(page)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-chat.png`, fullPage: true })
  })

  test('Reflect page - Memories tab', async ({ page, context }) => {
    await signInWithDemo(page, context)
    await page.goto('/reflect')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
    await waitForFonts(page)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-reflect-memories.png`, fullPage: true })
  })

  test('Reflect page - About Me tab', async ({ page, context }) => {
    await signInWithDemo(page, context)
    await page.goto('/reflect')
    await page.waitForLoadState('domcontentloaded')
    await waitForFonts(page)
    await page.getByRole('link', { name: 'About Me' }).click()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-reflect-about-me.png`, fullPage: true })
  })

  test('Reflect page - Commitments tab (Goals sub-tab)', async ({ page, context }) => {
    await signInWithDemo(page, context)
    await page.goto('/reflect')
    await page.waitForLoadState('domcontentloaded')
    await waitForFonts(page)
    await page.getByRole('link', { name: 'Commitments' }).click()
    await page.getByRole('button', { name: 'Goals' }).click()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-reflect-commitments-goals.png`, fullPage: true })
  })

  test('Reflect page - Commitments tab (Actions sub-tab)', async ({ page, context }) => {
    await signInWithDemo(page, context)
    await page.goto('/reflect')
    await page.waitForLoadState('domcontentloaded')
    await waitForFonts(page)
    await page.getByRole('link', { name: 'Commitments' }).click()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-reflect-commitments-actions.png`, fullPage: true })
  })

  test('Reflect page - Review tab', async ({ page, context }) => {
    await signInWithDemo(page, context)
    await page.goto('/reflect')
    await page.waitForLoadState('domcontentloaded')
    await waitForFonts(page)
    await page.getByRole('link', { name: 'Review' }).click()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-reflect-review.png`, fullPage: true })
  })  

  test('Reflect page - Search overlay', async ({ page, context }) => {
    await signInWithDemo(page, context)
    await page.goto('/reflect')
    await page.waitForLoadState('domcontentloaded')
    await waitForFonts(page)
    await page.getByRole('button', { name: 'Search' }).click()
    await page.waitForTimeout(300) // Wait for overlay animation
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-reflect-search.png`, fullPage: true })
  })

  test('Settings page', async ({ page, context }) => {
    await signInWithDemo(page, context)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
    // Wait for profile to load - "Loading..." should be replaced with actual name
    await page.waitForSelector('text=Alex', { timeout: 10000 })
    await waitForFonts(page)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09-settings.png`, fullPage: true })
  })
})
