import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { z } from 'zod'
import { adminSupabase } from '@/lib/booking'

const schema = z.object({ bookingId: z.string().uuid(), razorpayOrderId: z.string().min(1), razorpayPaymentId: z.string().min(1), razorpaySignature: z.string().min(1) })
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json())
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '').update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`).digest('hex')
    if (!process.env.RAZORPAY_KEY_SECRET || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.razorpaySignature))) return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    const supabase = adminSupabase()
    const { data: payment } = await supabase.from('payments').select('id,booking_id,expected_amount_paise,currency,payment_status').eq('booking_id', input.bookingId).eq('razorpay_order_id', input.razorpayOrderId).single()
    if (!payment) return NextResponse.json({ error: 'Payment order not found' }, { status: 404 })
    await supabase.from('payments').update({ razorpay_payment_id: input.razorpayPaymentId, verification_status: 'verified', payment_status: 'pending' }).eq('id', payment.id)
    return NextResponse.json({ status: 'pending', message: 'Payment received and awaiting gateway capture confirmation.' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to verify payment' }, { status: 400 })
  }
}
