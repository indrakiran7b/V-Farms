import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dateRangesOverlap, holdExpiresAt, isHoldActive, validateStayDates } from '../lib/booking/dates.ts'
import { inrToRazorpayPaise, razorpayAmountMatchesInr, razorpayPaiseToInr } from '../lib/payments/money.ts'
import { bookingConfirmedNotificationRows } from '../lib/payments/notifications.ts'
import { canConfirmHeldBooking, isPostgresUniqueViolation, paymentStatusFromGatewayStatus, paymentStatusFromRazorpayEvent } from '../lib/payments/status.ts'
import { razorpayCheckoutSignature, razorpayWebhookDigest, verifyCheckoutSignature, verifyWebhookSignature } from '../lib/payments/signatures.ts'

describe('validateStayDates', () => {
  it('rejects checkout on or before check-in', () => {
    assert.equal(validateStayDates('2026-05-02', '2026-05-02').ok, false)
    assert.equal(validateStayDates('2026-05-03', '2026-05-02').ok, false)
  })

  it('accepts valid ranges', () => {
    assert.equal(validateStayDates('2026-05-01', '2026-05-03').ok, true)
  })
})

describe('dateRangesOverlap', () => {
  it('detects overlapping stays', () => {
    assert.equal(dateRangesOverlap('2026-05-01', '2026-05-05', '2026-05-03', '2026-05-07'), true)
  })

  it('allows back-to-back stays', () => {
    assert.equal(dateRangesOverlap('2026-05-01', '2026-05-03', '2026-05-03', '2026-05-05'), false)
  })
})

describe('hold expiration', () => {
  it('expires after 15 minutes', () => {
    const now = Date.parse('2026-05-01T10:00:00.000Z')
    const expiresAt = holdExpiresAt(now)
    assert.equal(isHoldActive(expiresAt, now + 14 * 60 * 1000), true)
    assert.equal(isHoldActive(expiresAt, now + 16 * 60 * 1000), false)
  })
})

describe('INR and paise conversion', () => {
  it('converts rupees to paise for Razorpay', () => {
    assert.equal(inrToRazorpayPaise(1250.5), 125050)
    assert.equal(inrToRazorpayPaise(99.99), 9999)
  })

  it('round-trips captured amounts', () => {
    const paise = inrToRazorpayPaise(4200)
    assert.equal(razorpayPaiseToInr(paise), 4200)
    assert.equal(razorpayAmountMatchesInr(paise, 4200), true)
    assert.equal(razorpayAmountMatchesInr(paise, 4200.01), false)
  })
})

describe('Razorpay signatures', () => {
  const secret = 'test_secret_only'

  it('accepts valid checkout signatures', () => {
    const signature = razorpayCheckoutSignature('order_1', 'pay_1', secret)
    assert.equal(verifyCheckoutSignature('order_1', 'pay_1', secret, signature), true)
  })

  it('rejects invalid checkout signatures', () => {
    const signature = razorpayCheckoutSignature('order_1', 'pay_1', secret)
    assert.equal(verifyCheckoutSignature('order_1', 'pay_2', secret, signature), false)
  })

  it('accepts valid webhook signatures', () => {
    const body = '{"event":"payment.captured"}'
    const expected = razorpayWebhookDigest(body, secret)
    assert.equal(verifyWebhookSignature(body, secret, expected), true)
    assert.equal(verifyWebhookSignature(body, secret, 'deadbeef'), false)
  })
})

describe('payment and booking status mapping', () => {
  it('maps Razorpay events', () => {
    assert.equal(paymentStatusFromRazorpayEvent('payment.captured'), 'captured')
    assert.equal(paymentStatusFromRazorpayEvent('payment.failed'), 'failed')
    assert.equal(paymentStatusFromRazorpayEvent('payment.authorized'), 'pending')
  })

  it('maps gateway fetch statuses', () => {
    assert.equal(paymentStatusFromGatewayStatus('captured'), 'captured')
    assert.equal(paymentStatusFromGatewayStatus('failed'), 'failed')
    assert.equal(paymentStatusFromGatewayStatus('authorized'), 'pending')
  })

  it('requires held booking, active hold, and capture before confirm', () => {
    assert.equal(canConfirmHeldBooking({ bookingStatus: 'held', holdActive: true, paymentCaptured: true }), true)
    assert.equal(canConfirmHeldBooking({ bookingStatus: 'held', holdActive: false, paymentCaptured: true }), false)
    assert.equal(canConfirmHeldBooking({ bookingStatus: 'confirmed', holdActive: true, paymentCaptured: true }), false)
  })
})

describe('webhook idempotency helpers', () => {
  it('detects duplicate provider events', () => {
    assert.equal(isPostgresUniqueViolation('23505'), true)
    assert.equal(isPostgresUniqueViolation('23503'), false)
  })
})

describe('booking_notifications rows', () => {
  it('creates stable idempotency keys per channel', () => {
    const rows = bookingConfirmedNotificationRows('11111111-1111-1111-1111-111111111111')
    assert.equal(rows.length, 2)
    assert.equal(rows[0]?.idempotency_key, 'booking-confirmed:11111111-1111-1111-1111-111111111111:email')
    assert.equal(rows[1]?.idempotency_key, 'booking-confirmed:11111111-1111-1111-1111-111111111111:sms')
  })

  it('dedupes on repeat upsert semantics via unique keys', () => {
    const first = bookingConfirmedNotificationRows('22222222-2222-2222-2222-222222222222')
    const second = bookingConfirmedNotificationRows('22222222-2222-2222-2222-222222222222')
    assert.deepEqual(first, second)
  })
})
