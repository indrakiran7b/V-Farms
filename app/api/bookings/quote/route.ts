import { NextResponse } from 'next/server'
import { z } from 'zod'
import { activeHoldConflict, quoteStay } from '@/lib/booking'

const schema = z.object({ checkIn: z.string().date(), checkOut: z.string().date(), adults: z.number().int().min(1).max(20), children: z.number().int().min(0).max(20).default(0) })

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json())
    const guests = input.adults + input.children
    const conflict = await activeHoldConflict(input.checkIn, input.checkOut)
    if (conflict) return NextResponse.json({ available: false, conflict }, { status: 409 })
    return NextResponse.json({ available: true, quote: await quoteStay(input.checkIn, input.checkOut, guests) })
  } catch (error) {
    const message = error instanceof z.ZodError ? 'Invalid booking dates or guest count' : error instanceof Error ? error.message : 'Unable to calculate quote'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
