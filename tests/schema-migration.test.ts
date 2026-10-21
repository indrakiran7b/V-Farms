import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { join } from 'node:path'
import { isPostgresExclusionViolation } from '../lib/payments/status.ts'

const initialMigrationPath = join(process.cwd(), 'supabase/migrations/20261021103000_initial_vfarms_schema.sql')
const forwardMigrationPath = join(process.cwd(), 'supabase/migrations/20261021114800_fix_premature_held_booking_expiry.sql')
const opsHardeningMigrationPath = join(process.cwd(), 'supabase/migrations/20261021120000_ops_hardening.sql')
const revokeRateLimitGrantsMigrationPath = join(
  process.cwd(),
  'supabase/migrations/20261021124500_revoke_consume_rate_limit_anon_grants.sql',
)

describe('initial schema migration (static audit)', () => {
  const sql = readFileSync(initialMigrationPath, 'utf8')

  it('defines every table referenced by application code', () => {
    const tables = [
      'pricing_rules',
      'stay_bookings',
      'inventory_holds',
      'payments',
      'payment_webhook_events',
      'booking_notifications',
      'event_enquiries',
      'event_quotes',
      'event_audit_logs',
      'content_entries',
      'gallery_items',
    ]
    for (const table of tables) {
      assert.match(sql, new RegExp(`create table public\\.${table}`, 'i'), `missing ${table}`)
    }
  })

  it('implements half-open overlap guards expected by the hold route', () => {
    assert.match(sql, /inventory_holds_no_overlap_active/i)
    assert.ok(sql.includes("daterange(check_in, check_out, '[)')"), 'expected half-open daterange')
    assert.match(sql, /stay_bookings_no_overlap_confirmed/i)
  })

  it('defines reserve triggers and advisory locks (expiry fix is forward migration)', () => {
    assert.match(sql, /release_expired_inventory_holds/i)
    assert.match(sql, /before insert or update on public\.stay_bookings/i)
    assert.match(sql, /booking_status in \('held', 'confirmed', 'expired'\)/i)
    assert.match(sql, /inventory_holds_reserve_dates/i)
    assert.match(sql, /pg_advisory_xact_lock\(hashtextextended/i)
  })

  it('restricts anon table access to published content only', () => {
    assert.match(sql, /revoke all on all tables in schema public from anon/i)
    assert.match(sql, /grant select on public\.content_entries to anon/i)
    assert.match(sql, /grant execute on function public\.release_expired_inventory_holds\(text\) to service_role/i)
  })

  it('supports webhook and notification idempotency keys', () => {
    assert.match(sql, /payment_webhook_events_provider_event_id_key/i)
    assert.match(sql, /booking_notifications_idempotency_key_key/i)
  })

  it('stores money as numeric INR columns', () => {
    assert.match(sql, /nightly_inr numeric\(12, 2\)/)
    assert.match(sql, /expected_amount_inr numeric\(12, 2\)/)
    assert.match(sql, /constraint payments_currency_inr check \(currency = 'INR'\)/)
  })

  it('enables row level security on sensitive tables', () => {
    assert.match(sql, /alter table public\.stay_bookings enable row level security/)
    assert.match(sql, /alter table public\.payments enable row level security/)
  })
})

describe('ops hardening migration (static audit)', () => {
  const sql = readFileSync(opsHardeningMigrationPath, 'utf8')

  it('defines distributed rate limit RPC and admin audit logs', () => {
    assert.match(sql, /consume_rate_limit/)
    assert.match(sql, /admin_audit_logs/)
    assert.match(sql, /exception_resolution_status/)
    assert.match(sql, /payload_json/)
  })
})

describe('revoke consume_rate_limit grants migration (static audit)', () => {
  const sql = readFileSync(revokeRateLimitGrantsMigrationPath, 'utf8')
  const signature = 'public.consume_rate_limit(text, integer, integer)'

  it('revokes execute from public, anon, and authenticated for the exact function signature', () => {
    assert.match(sql, new RegExp(`revoke all on function ${signature.replace(/\(/g, '\\(').replace(/\)/g, '\\)')} from public`, 'i'))
    assert.match(sql, /revoke all on function public\.consume_rate_limit\(text, integer, integer\) from anon, authenticated/i)
  })

  it('grants execute to service_role only among application roles', () => {
    const grantLines = sql.split('\n').filter((line) => /^\s*grant execute/i.test(line))
    assert.equal(grantLines.length, 1)
    assert.match(grantLines[0], /grant execute on function public\.consume_rate_limit\(text, integer, integer\) to service_role/i)
    for (const line of grantLines) {
      assert.doesNotMatch(line, /\bto anon\b/i)
      assert.doesNotMatch(line, /\bto authenticated\b/i)
    }
  })

  it('does not replace the function body or return contract', () => {
    assert.doesNotMatch(sql, /create or replace function/i)
    assert.doesNotMatch(sql, /returns jsonb/i)
  })
})

describe('forward premature-expiry migration (static audit)', () => {
  const sql = readFileSync(forwardMigrationPath, 'utf8')

  it('requires hold rows before expiring unpaid held bookings', () => {
    assert.ok(sql.includes('where ih.booking_id = sb.id') && sql.includes('and exists ('))
  })

  it('defers release sweep on stay_bookings insert', () => {
    assert.match(sql, /if tg_op = 'UPDATE' then/i)
    assert.match(sql, /perform public\.release_expired_inventory_holds\(new\.property_id\)/i)
  })
})

describe('isPostgresExclusionViolation', () => {
  it('detects overlap constraint failures', () => {
    assert.equal(isPostgresExclusionViolation('23P01'), true)
    assert.equal(isPostgresExclusionViolation('23505'), false)
  })
})
