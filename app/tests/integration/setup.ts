import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import dotenv from 'dotenv'
import { vi } from 'vitest'

// Load Vite-style env files for node-based integration tests.
// (Vite loads these automatically for the app, but Vitest(node) doesn't.)
const envFile = resolve(process.cwd(), '.env')
const envLocal = resolve(process.cwd(), '.env.local')
const envIntegrationLocal = resolve(process.cwd(), '.env.integration.local')

// Load in order of precedence (later files override earlier ones)
// Use override: true to ensure values are loaded even if already set
if (existsSync(envFile)) dotenv.config({ path: envFile, override: true })
if (existsSync(envLocal)) dotenv.config({ path: envLocal, override: true })
if (existsSync(envIntegrationLocal)) dotenv.config({ path: envIntegrationLocal, override: true })

// Stub environment variables so they're available via import.meta.env
// (vi.stubEnv populates both process.env and import.meta.env)
if (process.env.VITE_GEMINI_API_KEY) {
  vi.stubEnv('VITE_GEMINI_API_KEY', process.env.VITE_GEMINI_API_KEY)
}
vi.stubEnv('VITE_DISABLE_AI', process.env.VITE_DISABLE_AI ?? 'false')
