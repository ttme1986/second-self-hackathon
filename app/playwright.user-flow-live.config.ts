import { defineConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const silenceWav = path.resolve(__dirname, 'tests/fixtures/silence.wav')

export default defineConfig({
  testDir: "./tests/other",
  testMatch: "**/user-flow-live.spec.ts",
  timeout: 600_000, // 10 minutes
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
    headless: false,
    permissions: ['microphone'],
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${silenceWav}`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
});
