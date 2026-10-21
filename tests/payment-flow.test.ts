import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isHoldActive } from '../lib/booking/dates.ts'
import { evaluateCreateOrderEligibility } from '../lib/payments/create-order-eligibility.ts'
import { checkoutDismissedUserMessage, shouldShowBookingSuccessAfterVerify, verifyNetworkFailureMessage, verifyUserMessageAfterCheckout } from '../lib/payments/checkout-client.ts'
import { canConfirmHeldBooking, paymentStatusFromGatewayStatus } from '../lib/payments/status.ts'
import { verifyCheckoutSignature, razorpayCheckoutSignature } from '../lib/payments/signatures.ts'
import { isPostgresUniqueViolation } from '../lib/payments/status.ts'

const SECRET = 'unit_test_secret'
const NOW = Date.parse('2026-10-21T06:13:21.856Z')
const HOLD_OK = '2026-10-21T06:27:16.898+00:00'

describe('frontend verify gate (does not assume Razorpay success)', () => {
  it('shows success only when verify API returns status confirmed', () => {
    assert.equal(shouldShowBookingSuccessAfterVerify(true, { status: 'confirmed' }), true)
    assert.equal(shouldShowBookingSuccessAfterVerify(true, { status: 'pending' }), false)
    assert.equal(shouldShowBookingSuccessAfterVerify(false, { status: 'confirmed' }), false)
    assert.equal(shouldShowBookingSuccessAfterVerify(true, { error: 'Invalid payment signature' }), false)
  })

  it('surfaces verify errors and pending messages', () => {
    assert.equal(verifyUserMessageAfterCheckout(false, { error: 'Invalid payment signature' }), 'Invalid payment signature')
    assert.equal(verifyUserMessageAfterCheckout(true, { status: 'pending', message: 'Payment is awaiting capture confirmation.' }), 'Payment is awaiting capture confirmation.')
  })
})

describe('successful payment (server-side confirm preconditions)', () => {
  it('requires captured gateway status, active hold, and held booking', () => {
    assert.equal(paymentStatusFromGatewayStatus('captured'), 'captured')
    assert.equal(
      canConfirmHeldBooking({ bookingStatus: 'held', holdActive: true, paymentCaptured: true }),
      true,
    )
    const sig = razorpayCheckoutSignature('order_ok', 'pay_ok', SECRET)
    assert.equal(verifyCheckoutSignature('order_ok', 'pay_ok', SECRET, sig), true)
  })
})

describe('failed payment', () => {
  it('maps gateway failed status without treating as confirmed', () => {
    assert.equal(paymentStatusFromGatewayStatus('failed'), 'failed')
    assert.equal(
      canConfirmHeldBooking({ bookingStatus: 'held', holdActive: true, paymentCaptured: false }),
      false,
    )
    assert.equal(shouldShowBookingSuccessAfterVerify(true, { status: 'pending' }), false)
  })
})

describe('invalid signature', () => {
  it('rejects tampered checkout signature before confirm', () => {
    const sig = razorpayCheckoutSignature('order_1', 'pay_1', SECRET)
    assert.equal(verifyCheckoutSignature('order_1', 'pay_1', SECRET, sig), true)
    assert.equal(verifyCheckoutSignature('order_1', 'pay_1', SECRET, 'bad'), false)
  })
})

describe('duplicate webhook', () => {
  it('treats unique violation as duplicate provider event', () => {
    assert.equal(isPostgresUniqueViolation('23505'), true)
  })
})

describe('expired hold at payment time', () => {
  it('blocks create-order when hold window elapsed', () => {
    const result = evaluateCreateOrderEligibility(
      { booking_status: 'held', payment_status: 'unpaid' },
      { status: 'active', expires_at: '2026-10-21T06:00:00.000Z' },
      false,
      NOW,
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, 'hold_expired')
  })

  it('blocks confirm when hold is not active at verify time', () => {
    assert.equal(isHoldActive('2026-10-21T06:00:00.000Z', NOW), false)
    assert.equal(
      canConfirmHeldBooking({ bookingStatus: 'held', holdActive: false, paymentCaptured: true }),
      false,
    )
  })

  it('allows create-order while hold still active', () => {
    const result = evaluateCreateOrderEligibility(
      { booking_status: 'held', payment_status: 'unpaid' },
      { status: 'active', expires_at: HOLD_OK },
      false,
      NOW,
    )
    assert.equal(result.ok, true)
  })
})

describe('cancelled Razorpay checkout (client behavior)', () => {
  it('does not advance to success without verify handler running', () => {
    assert.equal(shouldShowBookingSuccessAfterVerify(false, {}), false)
  })

  it('shows a clear message when the modal is dismissed', () => {
    assert.match(checkoutDismissedUserMessage(), /still held/i)
  })

  it('does not show success when verify network call fails', () => {
    assert.equal(shouldShowBookingSuccessAfterVerify(false, {}), false)
    assert.match(verifyNetworkFailureMessage(), /verify payment/i)
  })
})
