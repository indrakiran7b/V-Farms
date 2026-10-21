#!/usr/bin/env node
/**
 * Prints presence of required env var names only (no values).
 */
import { existsSync, readFileSync } from 'node:fs'
import { checkRequiredEnv, hasPublicSupabaseConfig, hasServerSupabaseConfig, hasRazorpayCheckoutConfig, publicEnvExposesPrivilegedKeys } from '../lib/env.ts'

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

const report = {
  publicSupabase: hasPublicSupabaseConfig(),
  serverSupabase: hasServerSupabaseConfig(),
  razorpayCheckout: hasRazorpayCheckoutConfig(),
  razorpayWebhookSecret: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim()),
  stagingBaseUrl: Boolean(process.env.STAGING_BASE_URL?.trim()),
  privilegedInPublicEnv: publicEnvExposesPrivilegedKeys(),
  variables: checkRequiredEnv(),
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.publicSupabase && report.serverSupabase ? 0 : 1)
