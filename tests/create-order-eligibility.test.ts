import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shouldExpireUnpaidHeldBooking } from '../lib/booking/release-eligibility.ts'
import { evaluateCreateOrderEligibility } from '../lib/payments/create-order-eligibility.ts'

const NOW = Date.parse('2026-10-21T06:13:21.856Z')
const HOLD_END = '2026-10-21T06:27:16.898+00:00'

describe('shouldExpireUnpaidHeldBooking', () => {
  it('does not expire when no hold row exists yet', () => {
    assert.equal(
      shouldExpireUnpaidHeldBooking(
        { booking_status: 'held', payment_status: 'unpaid' },
        [],
        new Date(NOW).toISOString(),
      ),
      false,
    )
  })

  it('does not expire when an active unexpired hold exists', () => {
    assert.equal(
      shouldExpireUnpaidHeldBooking(
        { booking_status: 'held', payment_status: 'unpaid' },
        [{ status: 'active', expires_at: HOLD_END }],
        new Date(NOW).toISOString(),
      ),
      false,
    )
  })

  it('expires when holds exist but none are active unexpired', () => {
    assert.equal(
      shouldExpireUnpaidHeldBooking(
        { booking_status: 'held', payment_status: 'unpaid' },
        [{ status: 'expired', expires_at: '2026-10-21T06:00:00.000Z' }],
        new Date(NOW).toISOString(),
      ),
      true,
    )
  })
})

describe('evaluateCreateOrderEligibility', () => {
  it('rejects VF-20261021-style inconsistent state with generic not payable', () => {
    const result = evaluateCreateOrderEligibility(
      { booking_status: 'expired', payment_status: 'unpaid' },
      { status: 'active', expires_at: HOLD_END },
      false,
      NOW,
    )
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.needsStatusHeal, true)
  })

  it('allows normal held booking with active hold', () => {
    const result = evaluateCreateOrderEligibility(
      { booking_status: 'held', payment_status: 'unpaid' },
      { status: 'active', expires_at: HOLD_END },
      false,
      NOW,
    )
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.needsStatusHeal, false)
  })

  it('returns hold expired when hold window passed', () => {
    const result = evaluateCreateOrderEligibility(
      { booking_status: 'held', payment_status: 'unpaid' },
      { status: 'active', expires_at: '2026-10-21T06:00:00.000Z' },
      false,
      NOW,
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.code, 'hold_expired')
      assert.equal(result.error, 'Booking hold has expired')
    }
  })
})
