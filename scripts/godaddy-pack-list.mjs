import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, resolve, sep } from 'node:path'

export const ROOT = resolve(import.meta.dirname, '..')

/** Not uploaded to GoDaddy; kept in repo for local pnpm only. */
export const UPLOAD_EXCLUDE_FILES = new Set(['pnpm-lock.yaml', 'pnpm-workspace.yaml'])

/** Directories omitted from GoDaddy upload zip (not application source). */
export const UPLOAD_EXCLUDE_DIR_NAMES = new Set([])

const EXCLUDED_DIR_NAMES = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', '.turbo'])

export function normalizeRel(absPath) {
  return relative(ROOT, absPath).split(sep).join('/')
}

/** Secret env files — exclude from upload. `.env.example` is allowed (names only, no values). */
export function isEnvFile(relPath) {
  const name = basename(relPath)
  if (name === '.env.example') return false
  return name === '.env' || name.startsWith('.env.')
}

function isSecretBasename(name) {
  const SECRET_BASENAMES = new Set([
    'credentials.json',
    'secrets.json',
    'service-account.json',
    'service_account.json',
  ])
  const SECRET_BASENAME_SUFFIXES = ['.pem', '.p12', '.key', '.pfx']
  if (SECRET_BASENAMES.has(name)) return true
  if (name === 'id_rsa' || name === 'id_dsa') return true
  return SECRET_BASENAME_SUFFIXES.some((suffix) => name.endsWith(suffix))
}

function shouldSkipDir(relPath, dirName) {
  if (EXCLUDED_DIR_NAMES.has(dirName)) return true
  if (UPLOAD_EXCLUDE_DIR_NAMES.has(dirName)) return true
  if (relPath === 'supabase/.temp' || relPath.startsWith('supabase/.temp/')) return true
  return false
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    const rel = normalizeRel(abs)
    if (entry.isDirectory()) {
      if (shouldSkipDir(rel, entry.name)) continue
      walk(abs, files)
      continue
    }
    if (entry.isFile()) files.push({ abs, rel })
  }
  return files
}

export function collectUploadFiles() {
  const all = walk(ROOT)
  const included = []
  const skippedEnv = []

  for (const { abs, rel } of all) {
    if (isEnvFile(rel)) {
      skippedEnv.push(rel)
      continue
    }
    if (UPLOAD_EXCLUDE_FILES.has(rel)) continue
    if (isSecretBasename(basename(rel))) {
      included.push({ abs, rel, blocked: 'secret_filename' })
      continue
    }
    included.push({ abs, rel })
  }

  const blocked = included.filter((f) => f.blocked).map(({ rel, blocked: rule }) => ({ rel, rule }))
  const packList = included.filter((f) => !f.blocked)
  return { packList, blocked, skippedEnvCount: skippedEnv.length }
}

const INLINE_SECRET_LINE =
  /^(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|RESEND_API_KEY)\s*=\s*(\S.+)$/m
const INLINE_LIVE_KEY = /\b(rzp_live_[a-zA-Z0-9]+|sk_live_[a-zA-Z0-9]+)\b/
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.sql', '.css', '.html', '.toml', '.yaml', '.yml', '.txt', '.svg',
])
const MAX_SCAN_BYTES = 512 * 1024
const LEGACY_SITE_URL = 'https://v-farms-website-development.vercel.app'

export function scanPackListForIssues(packList) {
  const scanIssues = []
  const legacyUrlHits = []

  for (const { abs, rel } of packList) {
    const ext = rel.includes('.') ? rel.slice(rel.lastIndexOf('.')) : ''
    if (TEXT_EXTENSIONS.has(ext)) {
      const st = statSync(abs)
      if (st.size <= MAX_SCAN_BYTES) {
        const text = readFileSync(abs, 'utf8')
        if (INLINE_SECRET_LINE.test(text)) scanIssues.push({ rel, rule: 'inline_env_secret_assignment' })
        if (INLINE_LIVE_KEY.test(text)) scanIssues.push({ rel, rule: 'live_payment_key_pattern' })
        if (rel !== 'scripts/godaddy-pack-list.mjs' && text.includes(LEGACY_SITE_URL)) legacyUrlHits.push(rel)
      }
    }
  }

  return { scanIssues, legacyUrlHits }
}

const AIRO_CONFIG = join(ROOT, '.airo', 'config.json')

/** When Airo config is present, platform logs hasAiroConfig:true and uses these instead of package.json defaults. */
export function readAiroConfig() {
  if (!existsSync(AIRO_CONFIG)) return null
  try {
    return JSON.parse(readFileSync(AIRO_CONFIG, 'utf8'))
  } catch {
    return { parseError: true }
  }
}

export function assertAiroConfigForGoDaddy() {
  const errors = []
  const airo = readAiroConfig()
  if (!airo) {
    errors.push('.airo/config.json missing (required to override stored Airo pnpm build/start on GoDaddy)')
    return errors
  }
  if (airo.parseError) {
    errors.push('.airo/config.json is not valid JSON')
    return errors
  }
  const build = String(airo.buildCommand ?? '').trim()
  const serve = String(airo.serveCommand ?? '').trim()
  if (build !== 'npm run build') {
    errors.push(`.airo/config.json buildCommand must be "npm run build" (got: ${JSON.stringify(airo.buildCommand)})`)
  }
  if (serve !== 'npm start') {
    errors.push(`.airo/config.json serveCommand must be "npm start" (got: ${JSON.stringify(airo.serveCommand)})`)
  }
  if (/\bpnpm\b/.test(build) || /\bpnpm\b/.test(serve)) {
    errors.push('.airo/config.json must not reference pnpm (production EACCES on pnpm-native)')
  }
  const pm = airo.packageManager
  if (pm !== undefined && pm !== null && String(pm).trim() !== '' && String(pm).trim() !== 'npm') {
    errors.push(`.airo/config.json packageManager must be "npm" or omitted (got: ${JSON.stringify(pm)})`)
  }
  return errors
}

export function effectiveGoDaddyCommands() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const airo = readAiroConfig()
  return {
    hasAiroConfig: Boolean(airo && !airo.parseError),
    installLockfile: 'package-lock.json',
    packageManagerField: pkg.packageManager ?? '',
    buildCommand: airo?.buildCommand ?? 'npm run build',
    serveCommand: airo?.serveCommand ?? 'npm start',
    packageJsonBuildScript: pkg.scripts?.build ?? '',
    packageJsonStartScript: pkg.scripts?.start ?? '',
  }
}

export function assertNpmOnlyForGoDaddy() {
  const errors = []
  if (!existsSync(join(ROOT, 'package.json'))) {
    errors.push('package.json missing')
    return errors
  }
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  if (pkg.packageManager) {
    errors.push(
      'package.json must not set packageManager (GoDaddy selects pnpm/corepack and runs pnpm start — use npm + package-lock.json only)',
    )
  }
  if (pkg.scripts?.build && !String(pkg.scripts.build).includes('next build')) {
    errors.push('scripts.build should run next build --webpack')
  }
  if (pkg.scripts?.start !== 'next start') {
    errors.push('scripts.start must be "next start" for GoDaddy npm start')
  }
  errors.push(...assertAiroConfigForGoDaddy())
  return errors
}

export function assertRepoLockfiles() {
  const errors = assertNpmOnlyForGoDaddy()
  if (!existsSync(join(ROOT, 'package-lock.json'))) errors.push('package-lock.json missing (run pnpm run lockfile:sync-npm)')
  if (!existsSync(join(ROOT, '.npmrc'))) errors.push('.npmrc missing')
  if (!existsSync(join(ROOT, 'lib/site-url.ts'))) errors.push('lib/site-url.ts missing')
  return errors
}
