import { chromium } from 'playwright'

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:4173'

async function withPage(browser, handler) {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    window.localStorage.setItem('skipAuth', 'true')
  })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  try {
    await handler(page)
  } finally {
    await context.close()
  }
}

async function demo1(browser) {
  const steps = []
  await withPage(browser, async (page) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
    steps.push('hub_loaded')

    await page.getByText('Chat').first().click()
    await page.waitForURL('**/chat')
    steps.push('chat_opened')

    await page.getByLabel('Microphone').click()
    await page.getByLabel('Open tools').click()
    await page.getByRole('button', { name: /Bio Builder/i }).click()
    const input = page.getByPlaceholder('Your answer')
    await input.fill('Product lead')
    await page.getByRole('button', { name: /Next/i }).click()
    await input.fill('Human-first AI')
    await page.getByRole('button', { name: /Finish/i }).click()
    await page.getByText('Bio Draft').waitFor()
    await page.getByText(/Mentioned leading AI prototypes/i).waitFor()
    steps.push('bio_tool_completed')

    await page.getByText('Refine bio for demo deck').click()
    steps.push('action_saved')

    await page.getByLabel('End session').click()
    await page.getByText('Session Recap').waitFor()
    steps.push('recap_opened')

    const saveButtons = page.getByRole('button', { name: 'Save' })
    if (await saveButtons.count()) {
      await saveButtons.first().click()
      steps.push('recap_action_saved')
    }

    await page.getByRole('link', { name: /Open Open loops/i }).click()
    await page.waitForURL('**/reflect**')
    steps.push('open_loops_opened')
  })
  return steps
}

async function demo2(browser) {
  const steps = []
  await withPage(browser, async (page) => {
    await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' })
    steps.push('chat_opened')

    const mic = page.getByLabel('Microphone')
    await mic.click()
    await mic.click()
    await mic.click()
    await mic.click()
    steps.push('mic_actions_generated')

    const actionRows = page.locator('.action-row')
    const count = await actionRows.count()
    if (count > 3) {
      throw new Error(`Expected <=3 action rows, saw ${count}`)
    }
    steps.push('action_bar_capped')

    const bookDentist = page.getByText('Book dentist')
    if (await bookDentist.count()) {
      throw new Error('Expected Book dentist to overflow off the bar')
    }
    steps.push('overflow_evicted_oldest')

    await page.getByLabel('Open tools').click()
    await page.getByRole('button', { name: /Bio Builder/i }).click()
    const input = page.getByPlaceholder('Your answer')
    await input.fill('Product lead')
    await page.getByRole('button', { name: /Next/i }).click()
    await input.fill('Human-first AI')
    await page.getByRole('button', { name: /Finish/i }).click()

    const refineCount = await page.getByText('Refine bio for demo deck').count()
    if (refineCount > 1) {
      throw new Error('Expected dedupe of Refine bio for demo deck')
    }
    steps.push('dedupe_confirmed')

    await page.getByLabel('End session').click()
    await page.getByText('Session Recap').waitFor()
    steps.push('recap_opened')
  })
  return steps
}

async function demo3(browser) {
  const steps = []
  await withPage(browser, async (page) => {
    await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' })
    steps.push('chat_opened')

    await page.getByLabel('Open tools').click()
    await page.getByRole('button', { name: /Weekly Summary/i }).click()
    const input = page.getByPlaceholder('Your answer')
    await input.fill('Last 7 days')
    await page.getByRole('button', { name: /Next/i }).click()
    await input.fill('Onboarding')
    await page.getByRole('button', { name: /Finish/i }).click()
    await page.getByText('Weekly Summary').waitFor()
    steps.push('weekly_summary_done')

    await page.getByLabel('Open tools').click()
    await page.getByRole('button', { name: /Growth Plan/i }).click()
    await input.fill('Ship demo')
    await page.getByRole('button', { name: /Next/i }).click()
    await input.fill('Time')
    await page.getByRole('button', { name: /Finish/i }).click()
    await page.getByText('Growth Plan').waitFor()
    steps.push('growth_plan_done')

    const actionSelectors = [
      'Schedule onboarding review',
      'Draft 30-day capture ritual',
      'Refine bio for demo deck',
    ]
    let savedCount = 0
    for (const title of actionSelectors) {
      const row = page.getByText(title)
      if (await row.count()) {
        await row.click()
        savedCount += 1
      }
    }
    if (savedCount === 0) {
      const actionButtons = page.locator('.action-row')
      const actionCount = await actionButtons.count()
      if (actionCount > 0) {
        await actionButtons.first().click()
        savedCount = 1
      }
    }
    steps.push('actions_saved')

    await page.goto(`${BASE_URL}/reflect?tab=open-loops`, { waitUntil: 'networkidle' })
    await page.getByText('Open loops').waitFor()
    steps.push('open_loops_viewed')

    const toggle = page.getByRole('button', { name: /Open/i }).first()
    await toggle.click()
    steps.push('open_loop_toggled')

    await page.goto(`${BASE_URL}/reflect`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Confirm left/i }).click()
    await page.getByText(/Resolved/i).waitFor()
    steps.push('review_queue_resolved')
  })
  return steps
}

async function run() {
  const results = []
  const browser = await chromium.launch({ headless: true })
  try {
    results.push({ demo: 'Demo 1', steps: await demo1(browser) })
    results.push({ demo: 'Demo 2', steps: await demo2(browser) })
    results.push({ demo: 'Demo 3', steps: await demo3(browser) })
  } finally {
    await browser.close()
  }

  for (const result of results) {
    console.log(`${result.demo}: ${result.steps.join(', ')}`)
  }
}

run().catch((error) => {
  console.error('Demo flow failed:', error.message)
  process.exit(1)
})
