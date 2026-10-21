export type HoldSnapshot = { status: string; expires_at: string }

/**
 * Mirrors release_expired_inventory_holds booking transition (app/tests only).
 * Do not expire while no hold row exists yet (booking insert before hold insert).
 */
export function shouldExpireUnpaidHeldBooking(
  booking: { booking_status: string; payment_status: string },
  holds: HoldSnapshot[],
  nowIso: string,
): boolean {
  if (booking.booking_status !== 'held' || booking.payment_status !== 'unpaid') return false
  if (holds.length === 0) return false
  const now = Date.parse(nowIso)
  return !holds.some((hold) => hold.status === 'active' && Date.parse(hold.expires_at) > now)
}

export function isPayableHeldBooking(bookingStatus: string): boolean {
  return bookingStatus === 'held'
}

function hasActiveUnexpiredHold(hold: HoldSnapshot | null | undefined, nowIso: string): boolean {
  if (!hold || hold.status !== 'active') return false
  return Date.parse(hold.expires_at) > Date.parse(nowIso)
}

/** Data inconsistency: booking expired while an active unexpired hold still exists. */
export function isExpiredBookingWithActiveHold(
  bookingStatus: string,
  hold: HoldSnapshot | null | undefined,
  nowIso: string,
): boolean {
  if (bookingStatus !== 'expired') return false
  return hasActiveUnexpiredHold(hold, nowIso)
}

/**
 * Safe payment heal: only unpaid + prematurely expired + valid active hold.
 * Never applies to confirmed, captured, or expired-without-hold states.
 */
export function canHealPrematureExpiredBooking(
  booking: { booking_status: string; payment_status: string },
  hold: HoldSnapshot | null | undefined,
  nowIso: string,
): boolean {
  if (booking.booking_status !== 'expired' || booking.payment_status !== 'unpaid') return false
  return hasActiveUnexpiredHold(hold, nowIso)
}

/** Staging v1 release_expired (no "hold rows must exist" guard) — used for regression tests only. */
export function legacyReleaseWouldExpireHeldWithoutActiveHold(
  booking: { booking_status: string; payment_status: string },
  holds: HoldSnapshot[],
  nowIso: string,
): boolean {
  if (booking.booking_status !== 'held' || booking.payment_status !== 'unpaid') return false
  const now = Date.parse(nowIso)
  return !holds.some((hold) => hold.status === 'active' && Date.parse(hold.expires_at) > now)
}
