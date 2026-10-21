#!/usr/bin/env node
/** Read-only staging lookup by booking_reference — prints status fields only, no secrets. */
import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const reference = process.argv[2]
if (!reference) {
  console.error('Usage: node scripts/diagnose-booking-ref.mjs <booking-reference>')
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

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Missing Supabase server env (load .env.local)')
  process.exit(2)
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: booking, error: bookingError } = await supabase
  .from('stay_bookings')
  .select('id, booking_reference, booking_status, payment_status, check_in, check_out, total_inr, amount_due_now_inr, created_at')
  .eq('booking_reference', reference)
  .maybeSingle()

if (bookingError) {
  console.log(JSON.stringify({ ok: false, stage: 'booking_lookup', code: bookingError.code, message: bookingError.message }, null, 2))
  process.exit(1)
}

if (!booking) {
  console.log(JSON.stringify({ ok: false, stage: 'booking_lookup', found: false, reference }, null, 2))
  process.exit(1)
}

const { data: hold } = await supabase
  .from('inventory_holds')
  .select('id, status, expires_at, created_at')
  .eq('booking_id', booking.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

const now = new Date().toISOString()
const holdActive = hold?.status === 'active' && hold?.expires_at && Date.parse(hold.expires_at) > Date.parse(now)

const { data: payments } = await supabase
  .from('payments')
  .select('id, payment_status, expected_amount_inr, razorpay_order_id')
  .eq('booking_id', booking.id)

const createOrderChecks = {
  bookingLookupError: false,
  bookingMissing: false,
  bookingStatusHeld: booking.booking_status === 'held',
  holdPresent: Boolean(hold),
  holdActive,
  holdStatus: hold?.status ?? null,
  holdExpiresAt: hold?.expires_at ?? null,
  nowIso: now,
  wouldReturnNotPayable: booking.booking_status !== 'held',
  wouldReturnHoldExpired: !hold || !holdActive,
}

console.log(
  JSON.stringify(
    {
      ok: true,
      booking: {
        id: booking.id,
        reference: booking.booking_reference,
        booking_status: booking.booking_status,
        payment_status: booking.payment_status,
        check_in: booking.check_in,
        check_out: booking.check_out,
        total_inr: booking.total_inr,
        amount_due_now_inr: booking.amount_due_now_inr,
        created_at: booking.created_at,
      },
      hold: hold ?? null,
      payments: payments ?? [],
      createOrderChecks,
    },
    null,
    2,
  ),
)
