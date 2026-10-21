#!/usr/bin/env node
/**
 * Read-only privilege probe: attempts consume_rate_limit with anon credentials.
 * Prints { anonRpcAllowed: boolean, errorCode: string | null } — never prints secrets.
 */
import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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
loadEnvFile('.env')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.log(JSON.stringify({ anonRpcAllowed: null, errorCode: 'missing_public_supabase_config' }))
  process.exit(2)
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
const probeKey = `staging-readonly-probe-${Date.now()}`
const { data, error } = await supabase.rpc('consume_rate_limit', {
  p_bucket_key: probeKey,
  p_limit: 1,
  p_window_seconds: 60,
})

console.log(
  JSON.stringify({
    anonRpcAllowed: !error && data && typeof data === 'object' && 'allowed' in data,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ? error.message.slice(0, 120) : null,
  }),
)
