import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { adminSupabase } from '@/lib/booking'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature')
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!signature || !secret) return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 })
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  if (digest.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  try {
    const payload = JSON.parse(rawBody) as { event?: string; account_id?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string } } } }
    const eventId = request.headers.get('x-razorpay-event-id') ?? crypto.createHash('sha256').update(rawBody).digest('hex')
    const supabase = adminSupabase()
    const inserted = await supabase.from('payment_webhook_events').insert({ provider_event_id: eventId, event_type: payload.event ?? 'unknown', processing_status: 'received' }).select('id').maybeSingle()
    if (inserted.error?.code === '23505') return NextResponse.json({ received: true, duplicate: true })
    if (inserted.error) throw inserted.error
    const entity = payload.payload?.payment?.entity
    if (entity?.order_id) {
      const { data: payment } = await supabase.from('payments').select('id,booking_id,expected_amount_inr,currency').eq('razorpay_order_id', entity.order_id).single()
      if (payment && entity.amount === Math.round(Number(payment.expected_amount_inr) * 100) && entity.currency === payment.currency) {
        const status = payload.event === 'payment.captured' ? 'captured' : payload.event === 'payment.failed' ? 'failed' : 'pending'
        await supabase.from('payments').update({ razorpay_payment_id: entity.id, captured_amount_inr: entity.amount / 100, payment_status: status, verification_status: 'verified' }).eq('id', payment.id)
        if (status === 'captured') {
          const { data: confirmedBooking, error: bookingError } = await supabase
            .from('stay_bookings')
            .update({ booking_status: 'confirmed', payment_status: 'captured' })
            .eq('id', payment.booking_id)
            .eq('booking_status', 'held')
            .select('id')
            .maybeSingle()
          if (bookingError) throw bookingError

          if (confirmedBooking) {
            const notificationRows = ['email', 'sms'].map((channel) => ({
              booking_id: confirmedBooking.id,
              channel,
              idempotency_key: `booking-confirmed:${confirmedBooking.id}:${channel}`,
            }))
            const { error: notificationError } = await supabase
              .from('booking_notifications')
              .upsert(notificationRows, { onConflict: 'idempotency_key', ignoreDuplicates: true })
            if (notificationError) throw notificationError
          }
        }
      }
    }
    await supabase.from('payment_webhook_events').update({ processing_status: 'processed', processed_at: new Date().toISOString() }).eq('provider_event_id', eventId)
    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook processing failed' }, { status: 500 })
  }
}
