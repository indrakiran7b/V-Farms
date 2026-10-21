import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canHealPrematureExpiredBooking,
  legacyReleaseWouldExpireHeldWithoutActiveHold,
  shouldExpireUnpaidHeldBooking,
} from '../lib/booking/release-eligibility.ts'
import { evaluateCreateOrderEligibility } from '../lib/payments/create-order-eligibility.ts'

const NOW = '2026-10-21T06:13:21.856Z'
const HOLD_END = '2026-10-21T06:27:16.898+00:00'
const UNPAID_HELD = { booking_status: 'held', payment_status: 'unpaid' } as const

describe('booking/hold insert race (release_expired semantics)', () => {
  it('legacy release would expire held booking before hold row exists', () => {
    assert.equal(legacyReleaseWouldExpireHeldWithoutActiveHold(UNPAID_HELD, [], NOW), true)
    assert.equal(shouldExpireUnpaidHeldBooking(UNPAID_HELD, [], NOW), false)
  })

  it('fixed release does not expire when hold list is empty (API gap)', () => {
    assert.equal(shouldExpireUnpaidHeldBooking(UNPAID_HELD, [], NOW), false)
  })

  it('expires only after hold rows exist and all are inactive or past expires_at', () => {
    assert.equal(
      shouldExpireUnpaidHeldBooking(
        UNPAID_HELD,
        [{ status: 'expired', expires_at: '2026-10-21T06:00:00.000Z' }],
        NOW,
      ),
      true,
    )
    assert.equal(
      shouldExpireUnpaidHeldBooking(UNPAID_HELD, [{ status: 'active', expires_at: HOLD_END }], NOW),
      false,
    )
  })
})

describe('status heal eligibility', () => {
  it('allows heal for premature expired + unpaid + active hold', () => {
    assert.equal(
      canHealPrematureExpiredBooking({ booking_status: 'expired', payment_status: 'unpaid' }, { status: 'active', expires_at: HOLD_END }, NOW),
      true,
    )
    const result = evaluateCreateOrderEligibility(
      { booking_status: 'expired', payment_status: 'unpaid' },
      { status: 'active', expires_at: HOLD_END },
      false,
      Date.parse(NOW),
    )
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.needsStatusHeal, true)
  })

  it('refuses heal when payment is captured', () => {
    assert.equal(
      canHealPrematureExpiredBooking({ booking_status: 'expired', payment_status: 'captured' }, { status: 'active', expires_at: HOLD_END }, NOW),
      false,
    )
  })

  it('refuses heal for confirmed bookings', () => {
    const result = evaluateCreateOrderEligibility(
      { booking_status: 'confirmed', payment_status: 'unpaid' },
      { status: 'active', expires_at: HOLD_END },
      false,
      Date.parse(NOW),
    )
    assert.equal(result.ok, false)
  })

  it('refuses heal when hold is missing or expired', () => {
    assert.equal(
      canHealPrematureExpiredBooking({ booking_status: 'expired', payment_status: 'unpaid' }, null, NOW),
      false,
    )
    assert.equal(
      canHealPrematureExpiredBooking(
        { booking_status: 'expired', payment_status: 'unpaid' },
        { status: 'active', expires_at: '2026-10-21T06:00:00.000Z' },
        NOW,
      ),
      false,
    )
  })
})
