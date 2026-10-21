import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { adminSupabase } from '@/lib/booking'
import { processRazorpayWebhookPayload, type RazorpayWebhookPayload } from '@/lib/payments/process-webhook-event'
import { isPostgresUniqueViolation } from '@/lib/payments/status'
import { verifyWebhookSignature } from '@/lib/payments/signatures'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature')
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!signature || !secret) return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 })
  if (!verifyWebhookSignature(rawBody, secret, signature)) return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })

  const eventId = request.headers.get('x-razorpay-event-id') ?? crypto.createHash('sha256').update(rawBody).digest('hex')
  let payload: RazorpayWebhookPayload
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
  }

  const supabase = adminSupabase()
  const inserted = await supabase
    .from('payment_webhook_events')
    .insert({
      provider_event_id: eventId,
      event_type: payload.event ?? 'unknown',
      processing_status: 'received',
      payload_json: payload,
      attempt_count: 1,
    })
    .select('id')
    .maybeSingle()

  if (isPostgresUniqueViolation(inserted.error?.code)) {
    return NextResponse.json({ received: true, duplicate: true })
  }
  if (inserted.error) {
    return NextResponse.json({ error: 'Unable to record webhook event' }, { status: 500 })
  }

  try {
    const result = await processRazorpayWebhookPayload(supabase, eventId, payload)
    if (!result.ok) {
      await supabase
        .from('payment_webhook_events')
        .update({
          processing_status: 'failed',
          last_error: result.error,
          processed_at: new Date().toISOString(),
          next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq('provider_event_id', eventId)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    await supabase
      .from('payment_webhook_events')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('provider_event_id', eventId)

    return NextResponse.json({
      received: true,
      holdExpired: result.holdExpired,
      paymentRecorded: result.paymentRecorded,
      confirmed: result.confirmed,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed'
    await supabase
      .from('payment_webhook_events')
      .update({
        processing_status: 'failed',
        last_error: message,
        processed_at: new Date().toISOString(),
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .eq('provider_event_id', eventId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
