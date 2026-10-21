#!/usr/bin/env node
/**
 * Regenerate package-lock.json for GoDaddy npm install without removing pnpm-lock.yaml.
 * Uses a clean tree (no pnpm node_modules) so npm arborist does not traverse .pnpm links.
 */
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(import.meta.dirname, '..')
const PKG = join(ROOT, 'package.json')
const NM = join(ROOT, 'node_modules')
const NM_BACKUP = join(ROOT, 'node_modules.pnpm-backup')

function restoreNodeModules() {
  if (existsSync(NM_BACKUP)) {
    if (existsSync(NM)) rmSync(NM, { recursive: true, force: true })
    renameSync(NM_BACKUP, NM)
  }
}

const raw = readFileSync(PKG, 'utf8')
const pkg = JSON.parse(raw)
const savedManager = pkg.packageManager
delete pkg.packageManager
writeFileSync(PKG, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')

if (existsSync(NM)) {
  if (existsSync(NM_BACKUP)) rmSync(NM_BACKUP, { recursive: true, force: true })
  renameSync(NM, NM_BACKUP)
}

let exitCode = 0
try {
  const npm = spawnSync('npm', ['install', '--package-lock-only', '--ignore-scripts'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (npm.status !== 0) {
    console.error('sync-npm-lock: npm install --package-lock-only failed.')
    exitCode = npm.status ?? 1
  } else {
    console.log('sync-npm-lock: wrote package-lock.json (pnpm-lock.yaml unchanged).')
    console.log('sync-npm-lock: run pnpm install to restore node_modules for local dev.')
  }
} finally {
  if (savedManager) pkg.packageManager = savedManager
  writeFileSync(PKG, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
  restoreNodeModules()
}

process.exit(exitCode)
