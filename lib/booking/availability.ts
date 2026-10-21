import { dateRangesOverlap } from './dates'

export type InventoryHoldRow = {
  check_in: string
  check_out: string
  expires_at: string
  status?: string
}

export type StayBookingRow = {
  check_in: string
  check_out: string
  booking_status: string
}

/** Matches DB transition: active + past expires_at → expired (see release_expired_inventory_holds). */
export function shouldExpireInventoryHold(status: string, expiresAt: string, nowIso: string): boolean {
  return status === 'active' && Date.parse(expiresAt) <= Date.parse(nowIso)
}

export function isActiveUnexpiredHold(hold: { status: string; expires_at: string }, nowIso: string): boolean {
  return hold.status === 'active' && Date.parse(hold.expires_at) > Date.parse(nowIso)
}

export function inventoryHoldBlocksStay(
  hold: InventoryHoldRow,
  checkIn: string,
  checkOut: string,
  nowIso: string,
): boolean {
  const status = hold.status ?? 'active'
  if (!isActiveUnexpiredHold({ status, expires_at: hold.expires_at }, nowIso)) return false
  return dateRangesOverlap(hold.check_in, hold.check_out, checkIn, checkOut)
}

/** Confirmed stays always block; held stays block only while still held (expired releases inventory). */
export function stayBookingBlocksStay(booking: StayBookingRow, checkIn: string, checkOut: string): boolean {
  if (booking.booking_status === 'expired') return false
  if (booking.booking_status !== 'held' && booking.booking_status !== 'confirmed') return false
  return dateRangesOverlap(booking.check_in, booking.check_out, checkIn, checkOut)
}

export function findStayAvailabilityConflict(
  checkIn: string,
  checkOut: string,
  holds: InventoryHoldRow[],
  bookings: StayBookingRow[],
  nowIso: string,
): InventoryHoldRow | StayBookingRow | null {
  for (const hold of holds) {
    if (inventoryHoldBlocksStay(hold, checkIn, checkOut, nowIso)) return hold
  }
  for (const booking of bookings) {
    if (stayBookingBlocksStay(booking, checkIn, checkOut)) return booking
  }
  return null
}
