import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { before, beforeEach, describe, it } from 'node:test'
import { __integrationTestSetAdminSupabase } from '../../lib/booking.ts'
import { checkoutDismissedUserMessage, shouldShowBookingSuccessAfterVerify } from '../../lib/payments/checkout-client.ts'
import { inrToRazorpayPaise } from '../../lib/payments/money.ts'
import { __integrationTestSetRazorpayClient, type RazorpayServerClient } from '../../lib/payments/razorpay-server.ts'
import { razorpayCheckoutSignature, razorpayWebhookDigest } from '../../lib/payments/signatures.ts'
import { createMemoryStore, createMemorySupabase, type MemoryStore } from './memory-supabase.ts'

const TEST_SECRET = 'integration_test_secret'
const WEBHOOK_SECRET = 'integration_webhook_secret'

type RoutePost = (request: Request) => Promise<Response>

const gatewayPayments = new Map<string, Record<string, unknown>>()
let orderSeq = 0

let store: MemoryStore
let quotePost: RoutePost
let holdPost: RoutePost
let createOrderPost: RoutePost
let verifyPost: RoutePost
let webhookPost: RoutePost

function installMockRazorpay() {
  const client: RazorpayServerClient = {
    orders: {
      create: async (opts) => ({
        id: `order_test_${++orderSeq}`,
        amount: opts.amount,
        currency: opts.currency,
      }),
    },
    payments: {
      fetch: async (id: string) => {
        const payment = gatewayPayments.get(id)
        if (!payment) throw new Error(`payment ${id} not found in mock gateway`)
        return payment as Awaited<ReturnType<RazorpayServerClient['payments']['fetch']>>
      },
    },
  }
  __integrationTestSetRazorpayClient(client)
}

before(async () => {
  const quote = await import('../../app/api/bookings/quote/route.ts')
  const hold = await import('../../app/api/bookings/hold/route.ts')
  const createOrder = await import('../../app/api/payments/create-order/route.ts')
  const verify = await import('../../app/api/payments/verify/route.ts')
  const webhook = await import('../../app/api/webhooks/razorpay/route.ts')
  quotePost = quote.POST
  holdPost = hold.POST
  createOrderPost = createOrder.POST
  verifyPost = verify.POST
  webhookPost = webhook.POST
})

beforeEach(() => {
  store = createMemoryStore()
  __integrationTestSetAdminSupabase(() => createMemorySupabase(store))
  gatewayPayments.clear()
  orderSeq = 0
  installMockRazorpay()
  process.env.RAZORPAY_KEY_ID = 'rzp_test_integration'
  process.env.RAZORPAY_KEY_SECRET = TEST_SECRET
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET
  process.env.SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'integration_service_role'
})

async function postJson(
  handler: RoutePost,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await handler(
    new Request('http://127.0.0.1/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  )
  const json = (await response.json()) as Record<string, unknown>
  return { status: response.status, json }
}

async function postWebhook(rawBody: string, eventId: string, signature: string) {
  const response = await webhookPost(
    new Request('http://127.0.0.1/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
        'x-razorpay-event-id': eventId,
      },
      body: rawBody,
    }),
  )
  const json = (await response.json()) as Record<string, unknown>
  return { status: response.status, json }
}

function seedHeldBooking(amountInr = 56000, holdExpiresAt?: string) {
  const bookingId = crypto.randomUUID()
  const expires = holdExpiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString()
  store.tables.stay_bookings.push({
    id: bookingId,
    booking_reference: 'VF-20261101-TEST0001',
    guest_name: 'Integration Guest',
    guest_email: 'guest@example.com',
    guest_phone: '+919999999999',
    property_id: 'vfarms-estate',
    check_in: '2026-11-10',
    check_out: '2026-11-12',
    guest_count: 2,
    booking_status: 'held',
    payment_status: 'unpaid',
    amount_due_now_inr: amountInr,
    total_inr: amountInr,
    currency: 'INR',
  })
  store.tables.inventory_holds.push({
    id: crypto.randomUUID(),
    property_id: 'vfarms-estate',
    booking_id: bookingId,
    check_in: '2026-11-10',
    check_out: '2026-11-12',
    status: 'active',
    expires_at: expires,
  })
  return bookingId
}

async function createOrderForBooking(bookingId: string) {
  return postJson(createOrderPost, { bookingId })
}

describe('HTTP integration (mocked Razorpay + in-memory Supabase)', () => {
  it('POST /api/bookings/quote returns quote when dates are available', async () => {
    const { status, json } = await postJson(quotePost, {
      checkIn: '2026-12-01',
      checkOut: '2026-12-03',
      adults: 2,
      children: 0,
    })
    assert.equal(status, 200)
    assert.equal(json.available, true)
    assert.ok(json.quote)
  })

  it('POST /api/bookings/quote returns 409 when an overlapping hold exists', async () => {
    store.tables.inventory_holds.push({
      id: crypto.randomUUID(),
      property_id: 'vfarms-estate',
      booking_id: crypto.randomUUID(),
      check_in: '2026-12-01',
      check_out: '2026-12-03',
      status: 'active',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    })
    const { status } = await postJson(quotePost, {
      checkIn: '2026-12-01',
      checkOut: '2026-12-03',
      adults: 2,
      children: 0,
    })
    assert.equal(status, 409)
  })

  it('POST /api/bookings/hold creates booking and inventory hold rows', async () => {
    const { status, json } = await postJson(holdPost, {
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      adults: 2,
      children: 0,
      guestName: 'Hold Guest',
      guestEmail: 'hold@example.com',
      guestPhone: '+919888877777',
      termsAccepted: true,
    })
    assert.equal(status, 200)
    const booking = json.booking as Record<string, unknown>
    const hold = json.hold as Record<string, unknown>
    assert.ok(booking.id)
    assert.equal(store.tables.stay_bookings.length, 1)
    assert.equal(store.tables.inventory_holds.length, 1)
    assert.equal(store.tables.inventory_holds[0].booking_id, booking.id)
    assert.ok(hold.expires_at)
  })

  it('POST /api/payments/create-order rejects expired holds', async () => {
    const bookingId = seedHeldBooking(56000, new Date(Date.now() - 60_000).toISOString())
    const { status, json } = await createOrderForBooking(bookingId)
    assert.equal(status, 409)
    assert.equal(json.code, 'hold_expired')
  })

  it('POST /api/payments/create-order heals prematurely expired bookings with active holds', async () => {
    const bookingId = seedHeldBooking()
    store.tables.stay_bookings[0].booking_status = 'expired'
    const { status, json } = await createOrderForBooking(bookingId)
    assert.equal(status, 200)
    assert.ok(json.orderId)
    assert.equal(store.tables.stay_bookings[0].booking_status, 'held')
  })

  it('successful payment via POST /api/payments/verify confirms booking', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    assert.equal(order.status, 200)
    const orderId = String(order.json.orderId)
    const paymentId = 'pay_success_1'
    const amountPaise = inrToRazorpayPaise(56000)
    gatewayPayments.set(paymentId, {
      id: paymentId,
      order_id: orderId,
      amount: amountPaise,
      currency: 'INR',
      status: 'captured',
    })
    const signature = razorpayCheckoutSignature(orderId, paymentId, TEST_SECRET)
    const { status, json } = await postJson(verifyPost, {
      bookingId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    })
    assert.equal(status, 200)
    assert.equal(json.status, 'confirmed')
    assert.equal(store.tables.stay_bookings[0].booking_status, 'confirmed')
    assert.equal(shouldShowBookingSuccessAfterVerify(true, json), true)
  })

  it('failed gateway payment returns pending without confirming booking', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    const orderId = String(order.json.orderId)
    const paymentId = 'pay_failed_1'
    gatewayPayments.set(paymentId, {
      id: paymentId,
      order_id: orderId,
      amount: inrToRazorpayPaise(56000),
      currency: 'INR',
      status: 'failed',
    })
    const signature = razorpayCheckoutSignature(orderId, paymentId, TEST_SECRET)
    const { status, json } = await postJson(verifyPost, {
      bookingId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    })
    assert.equal(status, 200)
    assert.equal(json.status, 'pending')
    assert.equal(store.tables.stay_bookings[0].booking_status, 'held')
    assert.equal(shouldShowBookingSuccessAfterVerify(true, json), false)
  })

  it('POST /api/payments/verify rejects invalid checkout signatures', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    const orderId = String(order.json.orderId)
    const { status } = await postJson(verifyPost, {
      bookingId,
      razorpayOrderId: orderId,
      razorpayPaymentId: 'pay_bad_sig',
      razorpaySignature: 'not-valid',
    })
    assert.equal(status, 400)
  })

  it('POST /api/payments/verify rejects mismatched amount or currency', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    const orderId = String(order.json.orderId)
    const paymentId = 'pay_mismatch_1'
    gatewayPayments.set(paymentId, {
      id: paymentId,
      order_id: orderId,
      amount: inrToRazorpayPaise(1),
      currency: 'INR',
      status: 'captured',
    })
    const signature = razorpayCheckoutSignature(orderId, paymentId, TEST_SECRET)
    const { status } = await postJson(verifyPost, {
      bookingId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    })
    assert.equal(status, 400)
  })

  it('POST /api/payments/verify rejects capture when hold expired', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    const orderId = String(order.json.orderId)
    store.tables.inventory_holds[0].expires_at = new Date(Date.now() - 1000).toISOString()
    const paymentId = 'pay_expired_hold'
    gatewayPayments.set(paymentId, {
      id: paymentId,
      order_id: orderId,
      amount: inrToRazorpayPaise(56000),
      currency: 'INR',
      status: 'captured',
    })
    const signature = razorpayCheckoutSignature(orderId, paymentId, TEST_SECRET)
    const { status, json } = await postJson(verifyPost, {
      bookingId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    })
    assert.equal(status, 409)
    assert.equal(json.paymentRecorded, true)
    assert.equal(store.tables.stay_bookings[0].booking_status, 'held')
    assert.equal(store.tables.payments[0].payment_status, 'exception')
    assert.equal(store.tables.payments[0].exception_resolution_status, 'open')
    assert.equal(store.tables.payments[0].captured_amount_inr, 56000)
  })

  it('POST /api/payments/verify returns 404 when payment order is missing', async () => {
    const bookingId = seedHeldBooking()
    const paymentId = 'pay_orphan'
    const orderId = 'order_missing'
    gatewayPayments.set(paymentId, {
      id: paymentId,
      order_id: orderId,
      amount: inrToRazorpayPaise(56000),
      currency: 'INR',
      status: 'captured',
    })
    const signature = razorpayCheckoutSignature(orderId, paymentId, TEST_SECRET)
    const { status } = await postJson(verifyPost, {
      bookingId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    })
    assert.equal(status, 404)
  })

  it('POST /api/payments/verify rejects currency mismatch', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    const orderId = String(order.json.orderId)
    const paymentId = 'pay_currency_mismatch'
    gatewayPayments.set(paymentId, {
      id: paymentId,
      order_id: orderId,
      amount: inrToRazorpayPaise(56000),
      currency: 'USD',
      status: 'captured',
    })
    const signature = razorpayCheckoutSignature(orderId, paymentId, TEST_SECRET)
    const { status } = await postJson(verifyPost, {
      bookingId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    })
    assert.equal(status, 400)
  })

  it('POST /api/payments/verify retry is idempotent after capture', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    const orderId = String(order.json.orderId)
    const paymentId = 'pay_retry_idempotent'
    gatewayPayments.set(paymentId, {
      id: paymentId,
      order_id: orderId,
      amount: inrToRazorpayPaise(56000),
      currency: 'INR',
      status: 'captured',
    })
    const signature = razorpayCheckoutSignature(orderId, paymentId, TEST_SECRET)
    const body = { bookingId, razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature }
    const first = await postJson(verifyPost, body)
    const second = await postJson(verifyPost, body)
    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.equal(first.json.status, 'confirmed')
    assert.equal(second.json.status, 'confirmed')
    assert.equal(store.tables.stay_bookings[0].booking_status, 'confirmed')
    assert.equal(store.tables.booking_notifications.length, 2)
  })

  it('POST /api/webhooks/razorpay rejects invalid webhook signatures', async () => {
    const raw = JSON.stringify({ event: 'payment.captured' })
    const { status } = await postWebhook(raw, 'evt_bad_sig', 'invalid')
    assert.equal(status, 400)
  })

  it('POST /api/webhooks/razorpay accepts valid signatures on raw body', async () => {
    const rawBody = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_x', order_id: 'order_none', amount: 100, currency: 'INR' } } } })
    const signature = razorpayWebhookDigest(rawBody, WEBHOOK_SECRET)
    const { status, json } = await postWebhook(rawBody, 'evt_valid_sig_only', signature)
    assert.equal(status, 200)
    assert.equal(json.received, true)
  })

  it('POST /api/webhooks/razorpay payment.failed cannot confirm booking', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    const orderId = String(order.json.orderId)
    const amountPaise = inrToRazorpayPaise(56000)
    const rawBody = JSON.stringify({
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_failed_wh', order_id: orderId, amount: amountPaise, currency: 'INR', status: 'failed' } } },
    })
    const signature = razorpayWebhookDigest(rawBody, WEBHOOK_SECRET)
    const { status } = await postWebhook(rawBody, 'evt_failed_wh', signature)
    assert.equal(status, 200)
    assert.equal(store.tables.stay_bookings[0].booking_status, 'held')
    assert.equal(store.tables.payments[0].payment_status, 'failed')
  })

  it('POST /api/webhooks/razorpay processes out-of-order failed then captured events', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    const orderId = String(order.json.orderId)
    const amountPaise = inrToRazorpayPaise(56000)
    const failedBody = JSON.stringify({
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_ooo_failed', order_id: orderId, amount: amountPaise, currency: 'INR', status: 'failed' } } },
    })
    const capturedBody = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_ooo_captured', order_id: orderId, amount: amountPaise, currency: 'INR', status: 'captured' } } },
    })
    const failedSig = razorpayWebhookDigest(failedBody, WEBHOOK_SECRET)
    const capturedSig = razorpayWebhookDigest(capturedBody, WEBHOOK_SECRET)
    await postWebhook(failedBody, 'evt_ooo_failed', failedSig)
    const captured = await postWebhook(capturedBody, 'evt_ooo_captured', capturedSig)
    assert.equal(captured.status, 200)
    assert.equal(store.tables.stay_bookings[0].booking_status, 'confirmed')
    assert.equal(store.tables.payments[0].payment_status, 'captured')
  })

  it('POST /api/webhooks/razorpay treats duplicate provider events as idempotent', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    const orderId = String(order.json.orderId)
    const amountPaise = inrToRazorpayPaise(56000)
    const rawBody = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_wh_1', order_id: orderId, amount: amountPaise, currency: 'INR', status: 'captured' } } },
    })
    const signature = razorpayWebhookDigest(rawBody, WEBHOOK_SECRET)
    const first = await postWebhook(rawBody, 'evt_duplicate_1', signature)
    const second = await postWebhook(rawBody, 'evt_duplicate_1', signature)
    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.equal(second.json.duplicate, true)
  })

  it('POST /api/webhooks/razorpay acknowledges capture but skips confirm when hold expired', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    const orderId = String(order.json.orderId)
    store.tables.inventory_holds[0].expires_at = new Date(Date.now() - 1000).toISOString()
    const amountPaise = inrToRazorpayPaise(56000)
    const rawBody = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_wh_expired', order_id: orderId, amount: amountPaise, currency: 'INR', status: 'captured' } } },
    })
    const signature = razorpayWebhookDigest(rawBody, WEBHOOK_SECRET)
    const { status, json } = await postWebhook(rawBody, 'evt_hold_expired', signature)
    assert.equal(status, 200)
    assert.equal(json.holdExpired, true)
    assert.equal(json.paymentRecorded, true)
    assert.equal(store.tables.stay_bookings[0].booking_status, 'held')
    assert.equal(store.tables.payments[0].payment_status, 'exception')
  })

  it('POST /api/webhooks/razorpay ignores mismatched payment amount', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    const orderId = String(order.json.orderId)
    const rawBody = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_wh_mismatch', order_id: orderId, amount: 100, currency: 'INR', status: 'captured' } } },
    })
    const signature = razorpayWebhookDigest(rawBody, WEBHOOK_SECRET)
    const { status, json } = await postWebhook(rawBody, 'evt_amount_mismatch', signature)
    assert.equal(status, 200)
    assert.equal(json.received, true)
    assert.equal(store.tables.stay_bookings[0].booking_status, 'held')
  })

  it('concurrent verify and webhook both confirm without leaving booking stuck', async () => {
    const bookingId = seedHeldBooking()
    const order = await createOrderForBooking(bookingId)
    const orderId = String(order.json.orderId)
    const amountPaise = inrToRazorpayPaise(56000)
    const paymentId = 'pay_concurrent_1'
    gatewayPayments.set(paymentId, {
      id: paymentId,
      order_id: orderId,
      amount: amountPaise,
      currency: 'INR',
      status: 'captured',
    })
    const signature = razorpayCheckoutSignature(orderId, paymentId, TEST_SECRET)
    const rawBody = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: amountPaise, currency: 'INR', status: 'captured' } } },
    })
    const webhookSignature = razorpayWebhookDigest(rawBody, WEBHOOK_SECRET)
    const [verifyResult, webhookResult] = await Promise.all([
      postJson(verifyPost, { bookingId, razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature }),
      postWebhook(rawBody, 'evt_concurrent_1', webhookSignature),
    ])
    assert.equal(verifyResult.status, 200)
    assert.equal(webhookResult.status, 200)
    assert.equal(store.tables.stay_bookings[0].booking_status, 'confirmed')
    const capturedPayments = store.tables.payments.filter((p) => p.payment_status === 'captured')
    assert.equal(capturedPayments.length, 1)
  })

  it('checkout dismissal copy does not imply payment success', () => {
    assert.match(checkoutDismissedUserMessage(), /closed/i)
    assert.equal(shouldShowBookingSuccessAfterVerify(false, {}), false)
  })
})
