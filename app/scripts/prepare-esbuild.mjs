import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd())
const sourceBinary = path.join(
  repoRoot,
  'node_modules',
  '@esbuild',
  'win32-x64',
  'esbuild.exe',
)
const targetDir = path.join(repoRoot, '.esbuild')
const targetBinary = path.join(targetDir, 'esbuild.exe')

const copyBinary = async () => {
  await fs.mkdir(targetDir, { recursive: true })
  await fs.copyFile(sourceBinary, targetBinary)
}

try {
  await fs.access(sourceBinary)
  await copyBinary()
} catch (error) {
  console.warn('prepare-esbuild: unable to copy esbuild binary', error)
}
