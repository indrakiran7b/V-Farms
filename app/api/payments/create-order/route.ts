import { NextResponse } from 'next/server'
import { z } from 'zod'
import { adminSupabase } from '@/lib/booking'
import { inrToRazorpayPaise } from '@/lib/payments/money'
import { evaluateCreateOrderEligibility } from '@/lib/payments/create-order-eligibility'
import { createRazorpayServerClient } from '@/lib/payments/razorpay-server'

const schema = z.object({ bookingId: z.string().uuid() })
export async function POST(request: Request) {
  try {
    const { bookingId } = schema.parse(await request.json())
    const supabase = adminSupabase()
    const { data: booking, error } = await supabase
      .from('stay_bookings')
      .select('id,booking_reference,guest_name,guest_email,guest_phone,amount_due_now_inr,currency,booking_status,payment_status')
      .eq('id', bookingId)
      .single()

    const { data: hold } = await supabase
      .from('inventory_holds')
      .select('expires_at,status')
      .eq('booking_id', bookingId)
      .eq('status', 'active')
      .maybeSingle()

    const eligibility = evaluateCreateOrderEligibility(booking, hold, Boolean(error))
    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.error, code: eligibility.code }, { status: eligibility.status })
    }

    if (eligibility.needsStatusHeal) {
      const { data: healed, error: healError } = await supabase
        .from('stay_bookings')
        .update({ booking_status: 'held' })
        .eq('id', bookingId)
        .eq('booking_status', 'expired')
        .eq('payment_status', 'unpaid')
        .select('id')
        .maybeSingle()
      if (healError || !healed) {
        return NextResponse.json({ error: 'Booking is not payable', code: 'not_payable' }, { status: 409 })
      }
    }

    if (!booking) throw new Error('Booking not found')

    const existing = await supabase
      .from('payments')
      .select('id,razorpay_order_id,expected_amount_inr')
      .eq('booking_id', bookingId)
      .eq('expected_amount_inr', booking.amount_due_now_inr)
      .neq('payment_status', 'failed')
      .maybeSingle()

    const amountPaise = inrToRazorpayPaise(Number(booking.amount_due_now_inr))
    if (existing.data?.razorpay_order_id) {
      return NextResponse.json({
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: existing.data.razorpay_order_id,
        amount: amountPaise,
        currency: booking.currency,
        bookingReference: booking.booking_reference,
      })
    }
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Payment gateway is not configured' }, { status: 503 })
    }
    const razorpay = createRazorpayServerClient()
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: booking.currency,
      receipt: booking.booking_reference,
      notes: { bookingId },
    })
    await supabase.from('payments').insert({
      booking_id: bookingId,
      razorpay_order_id: order.id,
      expected_amount_inr: booking.amount_due_now_inr,
      currency: booking.currency,
      payment_status: 'created',
    })
    return NextResponse.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: amountPaise,
      currency: booking.currency,
      bookingReference: booking.booking_reference,
      prefill: { name: booking.guest_name, email: booking.guest_email, contact: booking.guest_phone },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create payment order' }, { status: 400 })
  }
}
