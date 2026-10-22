#!/usr/bin/env node
/**
 * Static checks for Render Node web service deploy (no secrets, no network).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')

function fail(msg) {
  console.error(`verify-render-readiness: ${msg}`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
if (pkg.scripts?.build !== 'next build --webpack') {
  fail('scripts.build must be "next build --webpack"')
}
if (pkg.scripts?.start !== 'next start') {
  fail('scripts.start must be "next start" (Next.js reads process.env.PORT on Render)')
}
if (!existsSync(join(ROOT, 'package-lock.json'))) {
  fail('package-lock.json required for "npm ci" on Render')
}
if (!existsSync(join(ROOT, '.next', 'BUILD_ID'))) {
  console.warn('verify-render-readiness: no local .next/BUILD_ID — run npm run build locally to confirm compile')
}
if (!existsSync(join(ROOT, 'render.yaml'))) {
  fail('render.yaml missing')
}
if (!existsSync(join(ROOT, '.airo', 'config.json'))) {
  console.warn('verify-render-readiness: .airo/config.json absent (GoDaddy-only; Render ignores it)')
}

const renderYaml = readFileSync(join(ROOT, 'render.yaml'), 'utf8')
if (!renderYaml.includes('npm ci && npm run build')) {
  fail('render.yaml buildCommand should use npm ci && npm run build')
}
if (!renderYaml.includes('npm start')) {
  fail('render.yaml startCommand should use npm start')
}
if (/\bpnpm\b/.test(renderYaml)) {
  fail('render.yaml must not reference pnpm')
}

console.log(
  JSON.stringify(
    {
      ok: true,
      nodeEngine: pkg.engines?.node ?? '',
      renderBuild: 'npm ci && npm run build',
      renderStart: 'npm start',
      portNote: 'Render sets PORT; next start binds automatically',
      siteUrlEnv: 'NEXT_PUBLIC_SITE_URL (build-time for inlined public config)',
      docs: 'docs/RENDER_DEPLOYMENT.md',
    },
    null,
    2,
  ),
)
