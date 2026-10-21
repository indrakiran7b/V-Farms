import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nightsBetween } from '../lib/booking/dates.ts'
import { bookingInputSchema, bookingReference } from '../lib/booking/schemas.ts'
import { hasPublicSupabaseConfig, hasRazorpayCheckoutConfig, hasServerSupabaseConfig } from '../lib/env.ts'
import { toAdminTableRows } from '../lib/admin/table-rows.ts'

describe('nightsBetween', () => {
  it('counts nights in IST for consecutive dates', () => {
    assert.equal(nightsBetween('2026-04-01', '2026-04-03'), 2)
  })

  it('returns zero for same-day checkout', () => {
    assert.equal(nightsBetween('2026-04-01', '2026-04-01'), 0)
  })
})

describe('bookingReference', () => {
  it('uses VF prefix and date segment', () => {
    const ref = bookingReference()
    assert.match(ref, /^VF-\d{8}-[A-F0-9]{8}$/)
  })
})

describe('bookingInputSchema', () => {
  it('requires terms acceptance', () => {
    const result = bookingInputSchema.safeParse({
      checkIn: '2026-05-01',
      checkOut: '2026-05-03',
      adults: 2,
      children: 0,
      guestName: 'Test Guest',
      guestEmail: 'guest@example.com',
      guestPhone: '+919876543210',
      termsAccepted: false,
    })
    assert.equal(result.success, false)
  })

  it('accepts a valid payload', () => {
    const result = bookingInputSchema.safeParse({
      checkIn: '2026-05-01',
      checkOut: '2026-05-03',
      adults: 2,
      children: 1,
      guestName: 'Test Guest',
      guestEmail: 'guest@example.com',
      guestPhone: '+919876543210',
      termsAccepted: true,
    })
    assert.equal(result.success, true)
  })
})

describe('toAdminTableRows', () => {
  it('drops Supabase error-shaped rows', () => {
    const rows = toAdminTableRows([{ id: '1', name: 'Stay' }, Object.assign(new String('bad'), { error: true })])
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.id, '1')
  })
})

describe('env presence helpers', () => {
  it('reports missing vars without throwing', () => {
    assert.equal(typeof hasPublicSupabaseConfig(), 'boolean')
    assert.equal(typeof hasServerSupabaseConfig(), 'boolean')
    assert.equal(typeof hasRazorpayCheckoutConfig(), 'boolean')
  })
})
