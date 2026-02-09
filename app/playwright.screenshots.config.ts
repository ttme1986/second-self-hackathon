import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './scripts',
  testMatch: '**/screenshots.spec.ts',
  timeout: 120_000, // 2 minutes for screenshots with demo sign-in
  retries: 0,
  workers: 1, // Run serially to maintain demo sign-in state
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Auth enabled for demo sign-in
  },
  use: {
    baseURL: 'http://127.0.0.1:4175',
    viewport: { width: 390, height: 844 },
  },
})
