import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: "./tests/other",
  testMatch: "**/user-flow.spec.ts",
  timeout: 600_000, // 10 minutes for 10-turn + second session + validation
  retries: 0,
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4175",
    viewport: { width: 390, height: 844 },
  },
});
