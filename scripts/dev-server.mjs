#!/usr/bin/env node
/**
 * Local: `pnpm dev` / `npm run dev` → next dev (Turbopack).
 * GoDaddy/Airo Preview sometimes invokes `npm run dev` in /app — run production build + next start instead.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  })
  return result.status ?? 1
}

function isGoDaddyHostedRuntime() {
  if (process.env.FORCE_PRODUCTION_SERVER === '1') return true
  if (process.env.GODADDY_NODEJS_HOSTING === '1') return true
  // PaaS deploy logs: "Changed to app directory: /app"
  if (process.cwd() === '/app') return true
  return false
}

if (isGoDaddyHostedRuntime()) {
  const prodEnv = { ...process.env, NODE_ENV: 'production' }
  if (!existsSync('.next/BUILD_ID')) {
    const code = run('npm', ['run', 'build'], prodEnv)
    if (code !== 0) process.exit(code)
  }
  process.exit(run('npm', ['run', 'start'], prodEnv))
}

process.exit(run('npx', ['next', 'dev']))
