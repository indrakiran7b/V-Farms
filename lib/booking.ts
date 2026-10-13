import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

export const PROPERTY_ID = 'vfarms-estate'
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

export function adminSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase server configuration is missing')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round((Date.parse(`${checkOut}T00:00:00+05:30`) - Date.parse(`${checkIn}T00:00:00+05:30`)) / 86400000)
}

export async function quoteStay(checkIn: string, checkOut: string, guests: number) {
  const nights = nightsBetween(checkIn, checkOut)
  if (nights < 1 || nights > 30) throw new Error('Stay must be between 1 and 30 nights')
  if (guests < 1 || guests > 20) throw new Error('Guest count must be between 1 and 20')
  const db = adminSupabase()
  const { data: rules, error } = await db.from('pricing_rules').select('id,name,start_date,end_date,nightly_inr,minimum_nights').eq('active', true).order('start_date', { ascending: false, nullsFirst: true })
  if (error) throw new Error('Unable to load current pricing')
  const itemized = Array.from({ length: nights }, (_, index) => { const date = new Date(`${checkIn}T00:00:00+05:30`); date.setDate(date.getDate() + index); const stayDate = date.toISOString().slice(0, 10); const matches = (rules ?? []).filter(rule => (!rule.start_date || stayDate >= rule.start_date) && (!rule.end_date || stayDate <= rule.end_date)); const rule = matches.sort((a, b) => Number(Boolean(b.start_date || b.end_date)) - Number(Boolean(a.start_date || a.end_date)))[0]; if (!rule) throw new Error(`No active pricing rule covers ${stayDate}`); return { date: stayDate, nightlyRate: Number(rule.nightly_inr), pricingRuleId: rule.id, pricingRuleName: rule.name } })
  const minimumNights = Math.max(...(rules ?? []).filter(rule => itemized.some(item => item.pricingRuleId === rule.id)).map(rule => rule.minimum_nights), 1)
  if (nights < minimumNights) throw new Error(`This rate requires a minimum stay of ${minimumNights} nights`)
  const subtotal = itemized.reduce((sum, item) => sum + item.nightlyRate, 0)
  const tax = Math.round(subtotal * 0.12 * 100) / 100
  const total = Math.round((subtotal + tax) * 100) / 100
  return { nights, ratePerNight: Math.round((subtotal / nights) * 100) / 100, subtotal, tax, fees: 0, total, amountDueNow: total, balanceDue: 0, currency: 'INR', pricingRuleId: itemized[0].pricingRuleId, pricingRuleName: itemized[0].pricingRuleName, itemized }
}

export async function activeHoldConflict(checkIn: string, checkOut: string) {
  const supabase = adminSupabase()
  const { data, error } = await supabase.from('inventory_holds').select('check_in,check_out,expires_at').eq('property_id', PROPERTY_ID).eq('status', 'active').lt('check_in', checkOut).gt('check_out', checkIn).gt('expires_at', new Date().toISOString()).limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

export function bookingReference() {
  return `VF-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}
