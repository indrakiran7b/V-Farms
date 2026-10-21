import { z } from 'zod'

export const bookingInputSchema = z.object({
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  adults: z.number().int().min(1).max(20),
  children: z.number().int().min(0).max(20).default(0),
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.string().email().max(254),
  guestPhone: z.string().trim().min(7).max(30),
  notes: z.string().trim().max(1000).optional(),
  termsAccepted: z.literal(true),
})

export function bookingReference() {
  return `VF-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}
