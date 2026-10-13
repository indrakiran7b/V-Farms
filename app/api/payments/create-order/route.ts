import { NextResponse } from 'next/server'
import { z } from 'zod'
import Razorpay from 'razorpay'
import { adminSupabase } from '@/lib/booking'

const schema = z.object({ bookingId: z.string().uuid() })
export async function POST(request: Request) {
  try {
    const { bookingId } = schema.parse(await request.json())
    const supabase = adminSupabase()
    const { data: booking, error } = await supabase.from('stay_bookings').select('id,booking_reference,guest_name,guest_email,guest_phone,amount_due_now_paise,currency,booking_status').eq('id', bookingId).single()
    if (error || !booking || booking.booking_status !== 'held') return NextResponse.json({ error: 'Booking is not payable' }, { status: 409 })
    const { data: hold } = await supabase.from('inventory_holds').select('expires_at,status').eq('booking_id', bookingId).eq('status', 'active').gt('expires_at', new Date().toISOString()).single()
    if (!hold) return NextResponse.json({ error: 'Booking hold has expired' }, { status: 409 })
    const existing = await supabase.from('payments').select('id,razorpay_order_id,expected_amount_paise').eq('booking_id', bookingId).eq('expected_amount_paise', booking.amount_due_now_paise).neq('payment_status', 'failed').maybeSingle()
    if (existing.data?.razorpay_order_id) return NextResponse.json({ keyId: process.env.RAZORPAY_KEY_ID, orderId: existing.data.razorpay_order_id, amount: booking.amount_due_now_paise, currency: booking.currency, bookingReference: booking.booking_reference })
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return NextResponse.json({ error: 'Payment gateway is not configured' }, { status: 503 })
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    const order = await razorpay.orders.create({ amount: booking.amount_due_now_paise, currency: booking.currency, receipt: booking.booking_reference, notes: { bookingId } })
    await supabase.from('payments').insert({ booking_id: bookingId, razorpay_order_id: order.id, expected_amount_paise: booking.amount_due_now_paise, currency: booking.currency, payment_status: 'created' })
    return NextResponse.json({ keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: booking.amount_due_now_paise, currency: booking.currency, bookingReference: booking.booking_reference, prefill: { name: booking.guest_name, email: booking.guest_email, contact: booking.guest_phone } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create payment order' }, { status: 400 })
  }
}
