import { NextResponse } from 'next/server'
import { bookingInputSchema, adminSupabase, bookingReference, activeHoldConflict, quoteStay, PROPERTY_ID } from '@/lib/booking'

export async function POST(request: Request) {
  try {
    const input = bookingInputSchema.parse(await request.json())
    if (input.checkOut <= input.checkIn) return NextResponse.json({ error: 'Check-out must be after check-in' }, { status: 400 })
    const guests = input.adults + input.children
    const conflict = await activeHoldConflict(input.checkIn, input.checkOut)
    if (conflict) return NextResponse.json({ error: 'Those dates are no longer available', conflict }, { status: 409 })
    const quote = await quoteStay(input.checkIn, input.checkOut, guests)
    const supabase = adminSupabase()
    const { data: booking, error } = await supabase.from('stay_bookings').insert({ booking_reference: bookingReference(), property_id: PROPERTY_ID, guest_name: input.guestName, guest_email: input.guestEmail, guest_phone: input.guestPhone, check_in: input.checkIn, check_out: input.checkOut, guest_count: guests, booking_status: 'held', payment_status: 'unpaid', subtotal_inr: quote.subtotal, tax_inr: quote.tax, fees_inr: quote.fees, total_inr: quote.total, amount_due_now_inr: quote.amountDueNow, balance_due_inr: quote.balanceDue, price_snapshot: quote }).select('id,booking_reference,check_in,check_out,guest_count,total_inr,amount_due_now_inr,price_snapshot').single()
    if (error || !booking) throw error ?? new Error('Unable to create booking')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const { data: hold, error: holdError } = await supabase.from('inventory_holds').insert({ property_id: PROPERTY_ID, booking_id: booking.id, check_in: input.checkIn, check_out: input.checkOut, expires_at: expiresAt, status: 'active' }).select('id,expires_at').single()
    if (holdError) {
      await supabase.from('stay_bookings').delete().eq('id', booking.id)
      if (holdError.code === '23P01') return NextResponse.json({ error: 'Those dates are no longer available' }, { status: 409 })
      throw holdError
    }
    return NextResponse.json({ booking, hold })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to hold dates' }, { status: 400 })
  }
}
