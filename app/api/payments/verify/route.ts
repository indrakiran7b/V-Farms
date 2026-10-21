import { NextResponse } from 'next/server'
import { z } from 'zod'
import { adminSupabase } from '@/lib/booking'
import { isHoldActive } from '@/lib/booking/dates'
import { razorpayPaiseToInr, razorpayAmountMatchesInr } from '@/lib/payments/money'
import { dispatchPendingBookingNotifications } from '@/lib/notifications/dispatch-booking-notifications'
import { bookingConfirmedNotificationRows } from '@/lib/payments/notifications'
import { paymentStatusFromGatewayStatus } from '@/lib/payments/status'
import { recordCapturedPaymentNeedsReconciliation } from '@/lib/payments/capture-reconciliation'
import { createRazorpayServerClient } from '@/lib/payments/razorpay-server'
import { verifyCheckoutSignature } from '@/lib/payments/signatures'

const schema = z.object({ bookingId: z.string().uuid(), razorpayOrderId: z.string().min(1), razorpayPaymentId: z.string().min(1), razorpaySignature: z.string().min(1) })

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json())
    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) return NextResponse.json({ error: 'Payment gateway is not configured' }, { status: 503 })
    if (!verifyCheckoutSignature(input.razorpayOrderId, input.razorpayPaymentId, secret, input.razorpaySignature)) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    const supabase = adminSupabase()
    const { data: payment, error: paymentError } = await supabase.from('payments').select('id,booking_id,expected_amount_inr,currency,payment_status').eq('booking_id', input.bookingId).eq('razorpay_order_id', input.razorpayOrderId).single()
    if (paymentError || !payment) return NextResponse.json({ error: 'Payment order not found' }, { status: 404 })

    if (payment.payment_status === 'captured') return NextResponse.json({ status: 'confirmed' })
    if (!process.env.RAZORPAY_KEY_ID) return NextResponse.json({ error: 'Payment gateway is not configured' }, { status: 503 })
    const razorpay = createRazorpayServerClient()
    const gatewayPayment = await razorpay.payments.fetch(input.razorpayPaymentId)
    if (
      gatewayPayment.order_id !== input.razorpayOrderId
      || !razorpayAmountMatchesInr(Number(gatewayPayment.amount), Number(payment.expected_amount_inr))
      || gatewayPayment.currency !== payment.currency
    ) {
      return NextResponse.json({ error: 'Payment details did not match the booking' }, { status: 400 })
    }

    const gatewayStatus = paymentStatusFromGatewayStatus(gatewayPayment.status)
    if (gatewayStatus !== 'captured') {
      await supabase.from('payments').update({ razorpay_payment_id: input.razorpayPaymentId, verification_status: 'verified', payment_status: gatewayStatus }).eq('id', payment.id)
      return NextResponse.json({ status: 'pending', message: 'Payment is awaiting capture confirmation.' })
    }

    const { data: hold } = await supabase.from('inventory_holds').select('expires_at,status').eq('booking_id', input.bookingId).eq('status', 'active').maybeSingle()
    if (!hold || !isHoldActive(hold.expires_at)) {
      await recordCapturedPaymentNeedsReconciliation(
        supabase,
        payment.id,
        input.razorpayPaymentId,
        Number(gatewayPayment.amount),
      )
      return NextResponse.json(
        { error: 'Booking hold has expired', code: 'hold_expired', paymentRecorded: true },
        { status: 409 },
      )
    }

    await supabase.from('payments').update({
      razorpay_payment_id: input.razorpayPaymentId,
      captured_amount_inr: razorpayPaiseToInr(Number(gatewayPayment.amount)),
      verification_status: 'verified',
      payment_status: 'captured',
    }).eq('id', payment.id).neq('payment_status', 'captured')

    const { data: confirmedBooking, error: bookingError } = await supabase.from('stay_bookings').update({ booking_status: 'confirmed', payment_status: 'captured' }).eq('id', input.bookingId).eq('booking_status', 'held').select('id').maybeSingle()
    if (bookingError) throw bookingError
    if (confirmedBooking) {
      const { error: notificationError } = await supabase.from('booking_notifications').upsert(bookingConfirmedNotificationRows(confirmedBooking.id), { onConflict: 'idempotency_key', ignoreDuplicates: true })
      if (notificationError) throw notificationError
      await dispatchPendingBookingNotifications(supabase, { bookingId: confirmedBooking.id, limit: 10 })
    }
    return NextResponse.json({ status: 'confirmed' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? 'Invalid payment details' : error instanceof Error ? error.message : 'Unable to verify payment' }, { status: 400 })
  }
}
