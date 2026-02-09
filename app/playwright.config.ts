import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.{ts,tsx}',
  // Exclude tests that require Firebase Auth (they have their own configs)
  timeout: 30_000,
  retries: 0,
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SKIP_AUTH: 'true',
      VITE_DISABLE_LIVE_AUDIO: 'true',
      // Prevent Firebase from initializing during e2e runs.
      VITE_DISABLE_AUTH: 'true',
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
  },
})
