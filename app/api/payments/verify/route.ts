import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { z } from 'zod'
import Razorpay from 'razorpay'
import { adminSupabase } from '@/lib/booking'

const schema = z.object({ bookingId: z.string().uuid(), razorpayOrderId: z.string().min(1), razorpayPaymentId: z.string().min(1), razorpaySignature: z.string().min(1) })

function signaturesMatch(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const receivedBuffer = Buffer.from(received, 'utf8')
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json())
    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) return NextResponse.json({ error: 'Payment gateway is not configured' }, { status: 503 })
    const expectedSignature = crypto.createHmac('sha256', secret).update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`).digest('hex')
    if (!signaturesMatch(expectedSignature, input.razorpaySignature)) return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })

    const supabase = adminSupabase()
    const { data: payment, error: paymentError } = await supabase.from('payments').select('id,booking_id,expected_amount_inr,currency,payment_status').eq('booking_id', input.bookingId).eq('razorpay_order_id', input.razorpayOrderId).single()
    if (paymentError || !payment) return NextResponse.json({ error: 'Payment order not found' }, { status: 404 })

    if (payment.payment_status === 'captured') return NextResponse.json({ status: 'confirmed' })
    if (!process.env.RAZORPAY_KEY_ID) return NextResponse.json({ error: 'Payment gateway is not configured' }, { status: 503 })
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: secret })
    const gatewayPayment = await razorpay.payments.fetch(input.razorpayPaymentId)
    if (gatewayPayment.order_id !== input.razorpayOrderId || gatewayPayment.amount !== Math.round(Number(payment.expected_amount_inr) * 100) || gatewayPayment.currency !== payment.currency) return NextResponse.json({ error: 'Payment details did not match the booking' }, { status: 400 })
    if (gatewayPayment.status !== 'captured') {
      await supabase.from('payments').update({ razorpay_payment_id: input.razorpayPaymentId, verification_status: 'verified', payment_status: gatewayPayment.status === 'failed' ? 'failed' : 'pending' }).eq('id', payment.id)
      return NextResponse.json({ status: 'pending', message: 'Payment is awaiting capture confirmation.' })
    }

    const { data: hold } = await supabase.from('inventory_holds').select('id').eq('booking_id', input.bookingId).eq('status', 'active').gt('expires_at', new Date().toISOString()).maybeSingle()
    if (!hold) return NextResponse.json({ error: 'Booking hold has expired' }, { status: 409 })
    await supabase.from('payments').update({ razorpay_payment_id: input.razorpayPaymentId, captured_amount_inr: gatewayPayment.amount / 100, verification_status: 'verified', payment_status: 'captured' }).eq('id', payment.id)
    const { data: confirmedBooking, error: bookingError } = await supabase.from('stay_bookings').update({ booking_status: 'confirmed', payment_status: 'captured' }).eq('id', input.bookingId).eq('booking_status', 'held').select('id').maybeSingle()
    if (bookingError) throw bookingError
    if (confirmedBooking) {
      const notifications = ['email', 'sms'].map((channel) => ({ booking_id: confirmedBooking.id, channel, idempotency_key: `booking-confirmed:${confirmedBooking.id}:${channel}` }))
      const { error: notificationError } = await supabase.from('booking_notifications').upsert(notifications, { onConflict: 'idempotency_key', ignoreDuplicates: true })
      if (notificationError) throw notificationError
    }
    return NextResponse.json({ status: 'confirmed' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? 'Invalid payment details' : error instanceof Error ? error.message : 'Unable to verify payment' }, { status: 400 })
  }
}
