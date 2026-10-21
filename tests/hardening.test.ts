import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { beforeEach, describe, it, mock } from 'node:test'
import { __integrationTestSetAdminSupabase } from '../lib/booking.ts'
import { hasTransactionalEmailConfig } from '../lib/env.ts'
import { dispatchPendingBookingNotifications } from '../lib/notifications/dispatch-booking-notifications.ts'
import { sendTransactionalEmail } from '../lib/notifications/resend-email.ts'
import { processRazorpayWebhookPayload } from '../lib/payments/process-webhook-event.ts'
import { retryWebhookEventProcessing } from '../lib/payments/retry-webhook-event.ts'
import { consumeRateLimit, __integrationTestSetRateLimit } from '../lib/security/distributed-rate-limit.ts'
import { API_RATE_LIMIT_PROFILES, apiRateLimitBucketKey } from '../lib/security/rate-limit-profiles.ts'
import { createMemoryStore, createMemorySupabase } from './integration/memory-supabase.ts'
import { inrToRazorpayPaise } from '../lib/payments/money.ts'

describe('distributed rate limiting (Supabase RPC contract)', () => {
  beforeEach(() => {
    __integrationTestSetRateLimit(undefined)
    const store = createMemoryStore()
    __integrationTestSetAdminSupabase(() => createMemorySupabase(store))
  })

  it('blocks after the configured limit within a window', async () => {
    const key = apiRateLimitBucketKey(API_RATE_LIMIT_PROFILES.payments, '203.0.113.1')
    const first = await consumeRateLimit(key, 2, 60)
    const second = await consumeRateLimit(key, 2, 60)
    const third = await consumeRateLimit(key, 2, 60)
    assert.equal(first.allowed, true)
    assert.equal(second.allowed, true)
    assert.equal(third.allowed, false)
    assert.ok(third.retryAfterMs > 0)
  })
})

describe('booking notification dispatch', () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
  })

  it('skips email send when provider is not configured', async () => {
    const store = createMemoryStore()
    const bookingId = crypto.randomUUID()
    store.tables.stay_bookings.push({
      id: bookingId,
      booking_reference: 'VF-TEST',
      guest_email: 'guest@example.com',
      guest_name: 'Guest',
      check_in: '2026-12-01',
      check_out: '2026-12-03',
    })
    store.tables.booking_notifications.push({
      id: crypto.randomUUID(),
      booking_id: bookingId,
      channel: 'email',
      status: 'pending',
      attempt_count: 0,
      idempotency_key: 'test:1:email',
    })
    const summary = await dispatchPendingBookingNotifications(createMemorySupabase(store), { limit: 5 })
    assert.equal(hasTransactionalEmailConfig(), false)
    assert.equal(summary.skipped, 1)
    assert.equal(summary.sent, 0)
  })

  it('marks provider failures with retry/dead-letter semantics', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.EMAIL_FROM = 'V-Farms <test@example.com>'
    const store = createMemoryStore()
    const bookingId = crypto.randomUUID()
    store.tables.stay_bookings.push({
      id: bookingId,
      booking_reference: 'VF-TEST',
      guest_email: 'guest@example.com',
      guest_name: 'Guest',
      check_in: '2026-12-01',
      check_out: '2026-12-03',
    })
    const rowId = crypto.randomUUID()
    store.tables.booking_notifications.push({
      id: rowId,
      booking_id: bookingId,
      channel: 'email',
      status: 'pending',
      attempt_count: 0,
      idempotency_key: 'test:2:email',
    })
    mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ message: 'rate limited' }), { status: 429 }))
    const summary = await dispatchPendingBookingNotifications(createMemorySupabase(store), { limit: 5 })
    assert.equal(summary.failed, 1)
    assert.equal(store.tables.booking_notifications[0].status, 'failed')
    mock.restoreAll()
  })
})

describe('webhook processing and retry', () => {
  it('records exception payments when hold expired on capture (no booking confirm)', async () => {
    const store = createMemoryStore()
    const bookingId = crypto.randomUUID()
    const paymentId = crypto.randomUUID()
    store.tables.payments.push({
      id: paymentId,
      booking_id: bookingId,
      razorpay_order_id: 'order_wh',
      expected_amount_inr: 56000,
      currency: 'INR',
      payment_status: 'created',
    })
    store.tables.inventory_holds.push({
      booking_id: bookingId,
      status: 'active',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    })
    store.tables.stay_bookings.push({ id: bookingId, booking_status: 'held' })
    const result = await processRazorpayWebhookPayload(createMemorySupabase(store), 'evt_1', {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_wh_1',
            order_id: 'order_wh',
            amount: inrToRazorpayPaise(56000),
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.holdExpired, true)
      assert.equal(result.paymentRecorded, true)
    }
    assert.equal(store.tables.payments[0].payment_status, 'exception')
    assert.equal(store.tables.stay_bookings[0].booking_status, 'held')
  })

  it('retries stored webhook payloads without bypassing idempotency at ingress', async () => {
    const store = createMemoryStore()
    const bookingId = crypto.randomUUID()
    const paymentRowId = crypto.randomUUID()
    store.tables.payments.push({
      id: paymentRowId,
      booking_id: bookingId,
      razorpay_order_id: 'order_retry',
      expected_amount_inr: 56000,
      currency: 'INR',
      payment_status: 'created',
    })
    store.tables.inventory_holds.push({
      booking_id: bookingId,
      status: 'active',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    })
    store.tables.stay_bookings.push({ id: bookingId, booking_status: 'held' })
    const eventId = crypto.randomUUID()
    store.tables.payment_webhook_events.push({
      id: eventId,
      provider_event_id: 'prov_retry_1',
      event_type: 'payment.captured',
      processing_status: 'failed',
      attempt_count: 1,
      payload_json: {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_retry',
              order_id: 'order_retry',
              amount: inrToRazorpayPaise(56000),
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      },
    })
    const result = await retryWebhookEventProcessing(createMemorySupabase(store), eventId)
    assert.equal(result.confirmed, true)
    assert.equal(store.tables.stay_bookings[0].booking_status, 'confirmed')
  })
})

describe('transactional email helper', () => {
  it('does not call provider when configuration is absent', async () => {
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    const result = await sendTransactionalEmail({ to: 'a@b.com', subject: 'x', html: 'y' })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.retryable, false)
  })
})
