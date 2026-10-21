#!/usr/bin/env node
/**
 * Build a GoDaddy upload zip from the repo root.
 * Runs verify-godaddy-preflight.mjs first (disposable npm ci + production build simulation).
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  ROOT,
  assertRepoLockfiles,
  collectUploadFiles,
  isEnvFile,
  normalizeRel,
  scanPackListForIssues,
} from './godaddy-pack-list.mjs'

const OUT_DIR = join(ROOT, 'dist')
const OUT_ZIP = join(OUT_DIR, 'vfarms-godaddy-staging.zip')
const FILE_LIST = join(OUT_DIR, 'godaddy-package-files.txt')
const MANIFEST = join(OUT_DIR, 'godaddy-package-manifest.json')

function sha256File(abs) {
  const hash = createHash('sha256')
  hash.update(readFileSync(abs))
  return hash.digest('hex')
}

function createZip(relPaths) {
  writeFileSync(FILE_LIST, `${relPaths.join('\n')}\n`, 'utf8')

  const tar = spawnSync('tar', ['-a', '-c', '-f', OUT_ZIP, '-C', ROOT, '-T', FILE_LIST], {
    cwd: ROOT,
    encoding: 'utf8',
  })

  if (tar.status !== 0) {
    console.error('package-godaddy-deploy: tar failed.')
    if (tar.stderr) console.error(tar.stderr.trim())
    if (tar.stdout) console.error(tar.stdout.trim())
    process.exit(1)
  }
}

function runPreflight() {
  const pre = spawnSync('node', [join(ROOT, 'scripts/verify-godaddy-preflight.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  if (pre.status !== 0) {
    console.error('package-godaddy-deploy: preflight failed — fix issues before packaging.')
    process.exit(pre.status ?? 1)
  }
}

function main() {
  runPreflight()

  const repoErrors = assertRepoLockfiles()
  if (repoErrors.length) {
    console.error('package-godaddy-deploy: repo prerequisites failed:')
    for (const e of repoErrors) console.error(`  - ${e}`)
    process.exit(1)
  }

  const { packList, blocked, skippedEnvCount } = collectUploadFiles()
  const { scanIssues, legacyUrlHits } = scanPackListForIssues(packList)

  if (blocked.length > 0 || scanIssues.length > 0) {
    console.error('package-godaddy-deploy: refused — sensitive paths or content would be included.')
    for (const item of blocked) console.error(`  blocked [${item.rule}]: ${item.rel}`)
    for (const item of scanIssues) console.error(`  blocked [${item.rule}]: ${item.rel}`)
    process.exit(1)
  }
  if (legacyUrlHits.length) {
    console.error('package-godaddy-deploy: refused — legacy Vercel canonical URL in upload set:')
    for (const rel of legacyUrlHits) console.error(`  - ${rel}`)
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  if (existsSync(OUT_ZIP)) rmSync(OUT_ZIP)

  const relPaths = packList.map(({ rel }) => rel).sort()
  const envInZip = relPaths.filter((rel) => isEnvFile(rel))
  if (envInZip.length > 0) {
    console.error('package-godaddy-deploy: refused — .env* would be included in zip.')
    process.exit(1)
  }

  const forbiddenInZip = ['node_modules/', '.git/', '.next/']
  for (const rel of relPaths) {
    if (rel.split('/').some((p) => p === 'node_modules' || p === '.git' || p === '.next')) {
      console.error(`package-godaddy-deploy: forbidden path in zip list: ${rel}`)
      process.exit(1)
    }
  }

  createZip(relPaths)

  const zipStat = statSync(OUT_ZIP)
  const lockSha = sha256File(join(ROOT, 'package-lock.json'))

  const manifest = {
    createdAt: new Date().toISOString(),
    zipPath: normalizeRel(OUT_ZIP),
    fileCount: relPaths.length,
    skippedEnvFilesOnDisk: skippedEnvCount,
    sizeBytes: zipStat.size,
    sizeMiB: Number((zipStat.size / (1024 * 1024)).toFixed(2)),
    sha256: sha256File(OUT_ZIP),
    packageLockSha256: lockSha,
    platformPackageManager: 'npm (GoDaddy docs; upload package-lock.json only)',
    excludes: [
      'node_modules/',
      '.git/',
      '.next/',
      '.env* (except .env.example template)',
      'supabase/.temp/',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      '.airo/ (may force pnpm — omit; use npm scripts in package.json)',
      'dist/ (output only; not inside zip)',
    ],
    requiredInZip: [
      'package.json',
      'package-lock.json',
      '.npmrc',
      'lib/site-url.ts',
      'app/',
      'public/',
      'supabase/migrations/',
      'docs/GODADDY_STAGING_DEPLOYMENT.md',
    ],
  }

  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(manifest, null, 2))
  if (manifest.sizeMiB > 100) {
    console.warn('Warning: zip exceeds GoDaddy ~100 MB guidance.')
  }
}

main()
