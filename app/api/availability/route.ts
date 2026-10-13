import { NextResponse } from 'next/server'
import { z } from 'zod'
import { activeHoldConflict, adminSupabase, PROPERTY_ID } from '@/lib/booking'

const schema = z.object({ checkIn: z.string().date(), checkOut: z.string().date() })

export async function GET(request: Request) {
  try {
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams))
    const supabase = adminSupabase()
    const [holds, bookings] = await Promise.all([
      activeHoldConflict(input.checkIn, input.checkOut),
      supabase.from('stay_bookings').select('check_in,check_out,booking_status').eq('property_id', PROPERTY_ID).in('booking_status', ['held', 'confirmed']).lt('check_in', input.checkOut).gt('check_out', input.checkIn).limit(1),
    ])
    if (bookings.error) throw bookings.error
    const conflict = holds ?? bookings.data?.[0] ?? null
    return NextResponse.json({ available: !conflict, conflict })
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? 'Invalid dates' : 'Unable to check availability' }, { status: 400 })
  }
}
