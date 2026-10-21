import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { bookingInputSchema, bookingReference } from './booking/schemas'

export const PROPERTY_ID = 'vfarms-estate'
export { bookingInputSchema, bookingReference }

let integrationAdminSupabase: (() => SupabaseClient) | undefined

/** In-memory Supabase for HTTP integration tests only (never set in production). */
export function __integrationTestSetAdminSupabase(factory: (() => SupabaseClient) | undefined) {
  integrationAdminSupabase = factory
}

export function adminSupabase() {
  if (integrationAdminSupabase) return integrationAdminSupabase()
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase server configuration is missing')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export { nightsBetween } from './booking/dates'

export async function quoteStay(checkIn: string, checkOut: string, guests: number) {
  const db = adminSupabase()
  const { data: rules, error } = await db.from('pricing_rules').select('id,name,start_date,end_date,nightly_inr,minimum_nights').eq('active', true).order('start_date', { ascending: false, nullsFirst: true })
  if (error) throw new Error('Unable to load current pricing')
  const { calculateStayQuote } = await import('./booking/quote-calc')
  return calculateStayQuote(rules ?? [], checkIn, checkOut, guests)
}

export { findStayAvailabilityConflict, inventoryHoldBlocksStay, shouldExpireInventoryHold } from './booking/availability'

/** Expire stale holds in DB, then check active holds and held/confirmed bookings (matches availability API). */
export async function stayAvailabilityConflict(checkIn: string, checkOut: string) {
  const supabase = adminSupabase()
  await supabase.rpc('release_expired_inventory_holds', { p_property_id: PROPERTY_ID })
  const nowIso = new Date().toISOString()
  const [holdsResult, bookingsResult] = await Promise.all([
    supabase
      .from('inventory_holds')
      .select('check_in,check_out,expires_at,status')
      .eq('property_id', PROPERTY_ID)
      .eq('status', 'active')
      .lt('check_in', checkOut)
      .gt('check_out', checkIn),
    supabase
      .from('stay_bookings')
      .select('check_in,check_out,booking_status')
      .eq('property_id', PROPERTY_ID)
      .in('booking_status', ['held', 'confirmed'])
      .lt('check_in', checkOut)
      .gt('check_out', checkIn),
  ])
  if (holdsResult.error) throw holdsResult.error
  if (bookingsResult.error) throw bookingsResult.error
  const { findStayAvailabilityConflict } = await import('./booking/availability')
  return findStayAvailabilityConflict(checkIn, checkOut, holdsResult.data ?? [], bookingsResult.data ?? [], nowIso)
}

/** @deprecated Use stayAvailabilityConflict — kept for imports that only checked holds. */
export async function activeHoldConflict(checkIn: string, checkOut: string) {
  return stayAvailabilityConflict(checkIn, checkOut)
}

