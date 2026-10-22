#!/usr/bin/env node
/**
 * Disposable-copy checks (does not modify main node_modules):
 * 1) npm ci — lockfile matches package.json
 * 2) typecheck + tests + production build (full install)
 * 3) npm ci --omit=dev + npm run build — GoDaddy production-only simulation
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  ROOT,
  assertAiroObjectForGoDaddy,
  assertRepoLockfiles,
  assertUploadExcludesPnpmLock,
  collectUploadFiles,
  parseAiroConfigFromJsonText,
  scanPackListForIssues,
} from './godaddy-pack-list.mjs'

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  return r.status ?? 1
}

function copyUploadTree(destRoot, packList) {
  for (const { abs, rel } of packList) {
    const target = join(destRoot, rel)
    mkdirSync(dirname(target), { recursive: true })
    cpSync(abs, target)
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function main() {
  const repoErrors = assertRepoLockfiles()
  if (repoErrors.length) {
    console.error('verify-godaddy-preflight: repo prerequisites failed:')
    for (const e of repoErrors) console.error(`  - ${e}`)
    process.exit(1)
  }

  const { packList, blocked, skippedEnvCount } = collectUploadFiles()
  const { scanIssues, legacyUrlHits } = scanPackListForIssues(packList)

  if (blocked.length || scanIssues.length) {
    console.error('verify-godaddy-preflight: secret/content checks failed.')
    process.exit(1)
  }
  if (legacyUrlHits.length) {
    console.error('verify-godaddy-preflight: legacy Vercel site URL still present in upload files:')
    for (const rel of legacyUrlHits) console.error(`  - ${rel}`)
    process.exit(1)
  }

  const uploadErrors = assertUploadExcludesPnpmLock(packList)
  if (uploadErrors.length) {
    console.error('verify-godaddy-preflight: upload set invalid for GoDaddy npm deploy:')
    for (const e of uploadErrors) console.error(`  - ${e}`)
    process.exit(1)
  }

  const tmp = mkdtempSync(join(tmpdir(), 'vfarms-godaddy-'))
  console.log(`verify-godaddy-preflight: using ${tmp}`)
  copyUploadTree(tmp, packList)

  if (existsSync(join(tmp, 'pnpm-lock.yaml'))) {
    console.error('verify-godaddy-preflight: pnpm-lock.yaml must not appear in deployment copy.')
    rmSync(tmp, { recursive: true, force: true })
    process.exit(1)
  }

  const airoPath = join(tmp, '.airo', 'config.json')
  const airoText = readFileSync(airoPath, 'utf8')
  const airoObj = parseAiroConfigFromJsonText(airoText)
  const airoErrors = assertAiroObjectForGoDaddy(airoObj)
  if (airoErrors.length) {
    console.error('verify-godaddy-preflight: deployment .airo/config.json invalid:')
    for (const e of airoErrors) console.error(`  - ${e}`)
    rmSync(tmp, { recursive: true, force: true })
    process.exit(1)
  }

  const lockBefore = sha256(join(ROOT, 'package-lock.json'))
  const lockCopied = sha256(join(tmp, 'package-lock.json'))
  if (lockBefore !== lockCopied) {
    console.error('verify-godaddy-preflight: package-lock.json copy mismatch.')
    process.exit(1)
  }

  let code = run('npm', ['ci', '--ignore-scripts'], tmp)
  if (code !== 0) {
    rmSync(tmp, { recursive: true, force: true })
    process.exit(code)
  }

  code = run('npm', ['run', 'typecheck'], tmp)
  if (code !== 0) {
    rmSync(tmp, { recursive: true, force: true })
    process.exit(code)
  }

  code = run('npm', ['run', 'test'], tmp)
  if (code !== 0) {
    rmSync(tmp, { recursive: true, force: true })
    process.exit(code)
  }

  code = run('npm', ['run', 'build'], tmp)
  if (code !== 0) {
    rmSync(tmp, { recursive: true, force: true })
    process.exit(code)
  }

  rmSync(join(tmp, 'node_modules'), { recursive: true, force: true })
  if (existsSync(join(tmp, '.next'))) rmSync(join(tmp, '.next'), { recursive: true, force: true })

  console.log('verify-godaddy-preflight: simulating GoDaddy production-only install (npm ci --omit=dev)…')
  code = run('npm', ['ci', '--omit=dev'], tmp)
  if (code !== 0) {
    rmSync(tmp, { recursive: true, force: true })
    process.exit(code)
  }

  code = run('npm', ['run', 'build'], tmp)
  rmSync(tmp, { recursive: true, force: true })
  if (code !== 0) process.exit(code)

  console.log(
    JSON.stringify(
      {
        ok: true,
        skippedEnvFilesOnDisk: skippedEnvCount,
        uploadFileCount: packList.length,
        lockfileSha256: lockBefore,
        godaddyLockfile: 'package-lock.json (pnpm-lock.yaml excluded from upload)',
        deploymentAiroConfig: airoObj,
        effectiveServeCommand: airoObj?.serveCommand ?? '',
        siteUrlHelper: 'lib/site-url.ts',
      },
      null,
      2,
    ),
  )
}

main()
