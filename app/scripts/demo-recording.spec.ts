import { test, expect, Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

// Configure video recording for demo
test.use({
  video: {
    mode: 'on',
    size: { width: 390, height: 844 }, // iPhone 15 size
  },
  viewport: { width: 390, height: 844 },
})

const DEMO_OUTPUT_DIR = path.join(process.cwd(), 'demo-output')

// Ensure output directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(DEMO_OUTPUT_DIR)) {
    fs.mkdirSync(DEMO_OUTPUT_DIR, { recursive: true })
  }
})

// Font URLs to preload
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap',
]

// Preload fonts by fetching the CSS and waiting for all fonts to load
async function preloadFonts(page: Page) {
  // Fetch font CSS to trigger download
  for (const url of FONT_URLS) {
    await page.evaluate(async (fontUrl) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = fontUrl
      document.head.appendChild(link)
    }, url)
  }

  // Wait for all fonts to be loaded
  await page.waitForFunction(
    () => document.fonts.ready.then(() => document.fonts.status === 'loaded'),
    { timeout: 15000 }
  )

  // Extra wait for fonts to render
  await page.waitForTimeout(1000)
}

// Helper to wait for fonts to load after navigation
async function waitForFonts(page: Page) {
  // Wait for document fonts ready
  await page.waitForFunction(
    () => document.fonts.ready.then(() => document.fonts.status === 'loaded'),
    { timeout: 10000 }
  )

  // Wait for Material Symbols to be fully loaded (check if icon renders correctly)
  await page.waitForFunction(() => {
    const icons = document.querySelectorAll('.material-symbols-rounded, .material-symbols-outlined')
    if (icons.length === 0) return true // No icons on page

    // Check if first icon has proper font applied (width > 0 means font loaded)
    const icon = icons[0] as HTMLElement
    const style = window.getComputedStyle(icon)
    return style.fontFamily.includes('Material Symbols')
  }, { timeout: 10000 }).catch(() => {})

  // Stabilization time for rendering
  await page.waitForTimeout(800)
}

// Helper to add visual pause for demo
async function demoPause(page: Page, seconds: number = 2) {
  await page.waitForTimeout(seconds * 1000)
}

// Helper to dismiss any open modals
async function dismissModals(page: Page) {
  // Try pressing Escape multiple times
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  // Try clicking close button if present
  const closeBtn = page.locator('[aria-label="Close"], .modal-close, button:has-text("Close"), button:has-text("×")')
  if (await closeBtn.first().isVisible({ timeout: 300 }).catch(() => false)) {
    await closeBtn.first().click({ force: true })
    await page.waitForTimeout(300)
  }

  // Try clicking outside modal
  const backdrop = page.locator('.modal-backdrop')
  if (await backdrop.isVisible({ timeout: 300 }).catch(() => false)) {
    await page.mouse.click(10, 10)
    await page.waitForTimeout(300)
  }
}

test.describe('Demo Recording', () => {
  test('Full demo flow - 3 minute walkthrough', async ({ page, context }) => {
    // ============================================
    // SETUP: Clear all storage and sign out
    // ============================================
    console.log('Clearing previous session...')

    // Clear all browser storage (localStorage, sessionStorage, IndexedDB, cookies)
    await context.clearCookies()
    await page.goto('/')

    // Clear localStorage, sessionStorage and IndexedDB
    await page.evaluate(async () => {
      localStorage.clear()
      sessionStorage.clear()
      // Clear IndexedDB (Firebase stores auth here)
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) indexedDB.deleteDatabase(db.name)
      }
    })

    // ============================================
    // SEGMENT 1: Login with Demo Account (15 sec)
    // ============================================
    console.log('Starting demo recording...')

    // Navigate to login page with forceLogin to bypass Playwright auto-skip
    await page.goto('/?forceLogin')
    await page.waitForLoadState('domcontentloaded')

    // Preload fonts on the login page
    console.log('Preloading fonts...')
    await preloadFonts(page)
    console.log('Fonts preloaded')
    await page.waitForLoadState('domcontentloaded')
    await waitForFonts(page)
    await demoPause(page, 2)

    // Click demo sign-in button and wait for auth to complete
    const demoButton = page.getByRole('button', { name: /sign in for demo/i })
    if (await demoButton.isVisible()) {
      console.log('Clicking demo sign-in button...')
      await demoButton.click()

      // Wait for auth to complete - login screen should disappear
      await page.waitForSelector('.login-screen', { state: 'hidden', timeout: 30000 })
      console.log('Demo sign-in completed')

      // Wait for data to sync from Firestore
      await page.waitForTimeout(2000)

      // Reload page to ensure profile data is loaded fresh from localStorage
      await page.reload()
      await page.waitForLoadState('domcontentloaded')
      await waitForFonts(page)
    } else {
      console.log('Demo button not found, skipping auth')
    }
    await demoPause(page, 2)

    // ============================================
    // SEGMENT 2: Hub Page - Morning Briefing (30 sec)
    // ============================================
    console.log('Segment 2: Hub page')

    // Navigate to hub (should now have demo data)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await waitForFonts(page)

    // Show the hub with greeting and insights
    await demoPause(page, 3)

    // Scroll to show Today's Focus if present
    const todaysFocus = page.getByText(/today's focus|good morning/i).first()
    if (await todaysFocus.isVisible({ timeout: 2000 }).catch(() => false)) {
      await todaysFocus.scrollIntoViewIfNeeded()
      await demoPause(page, 2)
    }

    // Show proactive insight if present
    const insightCard = page.locator('.insight-card, [data-testid="insight"]').first()
    if (await insightCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await insightCard.scrollIntoViewIfNeeded()
      await demoPause(page, 2)
    }

    // ============================================
    // SEGMENT 3: Chat Page - Voice Capture (60 sec)
    // ============================================
    console.log('Segment 3: Chat page')

    // Navigate to Chat (use domcontentloaded - Chat page may have ongoing network activity)
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000) // Allow page to render
    await waitForFonts(page)
    await demoPause(page, 2)

    // Look for voice/mic button
    const voiceButton = page.locator('button:has(.material-symbols-rounded:text("mic"))').first()
    if (await voiceButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Show the mic button (don't click for now - would need real audio)
      await demoPause(page, 2)
    }

    // Show any existing conversation
    const messageArea = page.locator('.chat-messages, .message-list, [data-testid="messages"]').first()
    if (await messageArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await demoPause(page, 3)
    }

    // ============================================
    // SEGMENT 4: Reflect - Goals Tab (30 sec)
    // ============================================
    console.log('Segment 4: Goals')

    await page.goto('/reflect')
    await page.waitForLoadState('domcontentloaded')
    await waitForFonts(page)
    await dismissModals(page)
    await demoPause(page, 2)

    // Click Commitments tab, then Goals sub-tab
    const commitmentsTab = page.getByRole('link', { name: 'Commitments' })
    if (await commitmentsTab.isVisible()) {
      await dismissModals(page)
      await commitmentsTab.click({ force: true, timeout: 5000 }).catch(() => {
        console.log('Commitments tab click failed, navigating directly')
      })
      await page.goto('/reflect?tab=follow-ups&subtab=goals')
      await page.waitForLoadState('domcontentloaded')
      await demoPause(page, 3)

      // Show goal progress if present
      const goalCard = page.locator('.goal-card, [data-testid="goal"]').first()
      if (await goalCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await goalCard.click({ force: true }).catch(() => {})
        await demoPause(page, 3)
      }
    }

    // ============================================
    // SEGMENT 5: Reflect - Memories Tab (30 sec)
    // ============================================
    console.log('Segment 5: Memories')

    await dismissModals(page)
    const memoriesTab = page.getByRole('link', { name: 'Memories' })
    if (await memoriesTab.isVisible()) {
      await dismissModals(page)
      await memoriesTab.click({ force: true, timeout: 5000 }).catch(() => {
        console.log('Memories tab click failed, navigating directly')
      })
      await page.goto('/reflect?tab=memories')
      await page.waitForLoadState('domcontentloaded')
      await demoPause(page, 3)

      // Scroll through memories
      const memoryCard = page.locator('.memory-card, .moment-card, [data-testid="memory"]').first()
      if (await memoryCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await demoPause(page, 2)
      }
    }

    // ============================================
    // SEGMENT 6: Return to Hub - Emotional Insight (15 sec)
    // ============================================
    console.log('Segment 6: Closing')

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await waitForFonts(page)
    await demoPause(page, 3)

    // Final pause to show the complete hub
    console.log('Demo recording complete!')
    await demoPause(page, 2)
  })
})

// After test, copy video to demo-output folder
test.afterEach(async ({ page }, testInfo) => {
  const video = page.video()
  if (video) {
    const videoPath = await video.path()
    if (videoPath) {
      const destPath = path.join(DEMO_OUTPUT_DIR, `demo-${Date.now()}.webm`)
      // Wait a moment for video to finish writing
      await page.waitForTimeout(1000)
      try {
        fs.copyFileSync(videoPath, destPath)
        console.log(`Demo video saved to: ${destPath}`)
      } catch (e) {
        console.log('Video will be available in test-results folder')
      }
    }
  }
})
