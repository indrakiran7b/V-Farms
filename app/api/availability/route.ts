import { NextResponse } from 'next/server'
import { z } from 'zod'
import { stayAvailabilityConflict } from '@/lib/booking'

const schema = z.object({ checkIn: z.string().date(), checkOut: z.string().date() })

export async function GET(request: Request) {
  try {
    const input = schema.parse(Object.fromEntries(new URL(request.url).searchParams))
    const conflict = await stayAvailabilityConflict(input.checkIn, input.checkOut)
    return NextResponse.json({ available: !conflict, conflict })
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? 'Invalid dates' : 'Unable to check availability' }, { status: 400 })
  }
}
