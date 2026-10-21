#!/usr/bin/env node
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
  console.log(JSON.stringify({ error: 'missing_public_supabase_config' }))
  process.exit(2)
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
const buckets = await supabase.from('api_rate_limit_buckets').select('bucket_key').limit(1)
const audit = await supabase.from('admin_audit_logs').select('id').limit(1)
console.log(
  JSON.stringify({
    anonCanReadRateLimitBuckets: !buckets.error,
    bucketsErrorCode: buckets.error?.code ?? null,
    anonCanReadAdminAuditLogs: !audit.error,
    auditErrorCode: audit.error?.code ?? null,
  }),
)
