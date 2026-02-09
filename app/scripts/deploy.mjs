#!/usr/bin/env node
import { execFileSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const rootDir = path.dirname(appDir)

console.log('Building app...')
execFileSync('npm', ['run', 'build'], { cwd: appDir, stdio: 'inherit', shell: true })

console.log('Deploying to Firebase Hosting...')
execFileSync('firebase', ['deploy', '--only', 'hosting'], { cwd: rootDir, stdio: 'inherit', shell: true })

console.log('Deploy complete!')
