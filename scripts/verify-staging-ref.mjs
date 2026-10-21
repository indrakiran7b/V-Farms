#!/usr/bin/env node
/** Confirms .env.local Supabase URLs contain the expected project ref (no secret values printed). */
import { existsSync, readFileSync } from 'node:fs'

const expectedRef = process.argv[2]
if (!expectedRef || !/^[a-z0-9]{20}$/.test(expectedRef)) {
  console.error('Usage: node scripts/verify-staging-ref.mjs <project-ref>')
  process.exit(2)
}

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const [, key, raw] = match
    if (process.env[key]?.trim()) continue
    let value = raw.trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (value) process.env[key] = value
  }
}

loadEnvFile('.env.local')

const pub = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const srv = process.env.SUPABASE_URL ?? pub
const report = {
  envLocalExists: existsSync('.env.local'),
  publicUrlContainsExpectedRef: pub.includes(expectedRef),
  serverUrlContainsExpectedRef: srv.includes(expectedRef),
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.envLocalExists && report.publicUrlContainsExpectedRef && report.serverUrlContainsExpectedRef ? 0 : 1)
