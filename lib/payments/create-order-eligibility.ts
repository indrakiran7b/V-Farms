import { isHoldActive } from '../booking/dates'
import { canHealPrematureExpiredBooking, isPayableHeldBooking } from '../booking/release-eligibility'

export type CreateOrderBookingRow = {
  booking_status: string
  payment_status: string
}

export type CreateOrderHoldRow = {
  expires_at: string
  status: string
} | null

export type CreateOrderEligibility =
  | { ok: true; needsStatusHeal: boolean }
  | { ok: false; status: 409; error: string; code: 'not_payable' | 'hold_expired' }

export function evaluateCreateOrderEligibility(
  booking: CreateOrderBookingRow | null,
  hold: CreateOrderHoldRow,
  lookupFailed: boolean,
  nowMs: number = Date.now(),
): CreateOrderEligibility {
  if (lookupFailed || !booking) {
    return { ok: false, status: 409, error: 'Booking is not payable', code: 'not_payable' }
  }

  const nowIso = new Date(nowMs).toISOString()
  if (isPayableHeldBooking(booking.booking_status)) {
    if (!hold || !isHoldActive(hold.expires_at, nowMs)) {
      return { ok: false, status: 409, error: 'Booking hold has expired', code: 'hold_expired' }
    }
    return { ok: true, needsStatusHeal: false }
  }

  if (canHealPrematureExpiredBooking(booking, hold ?? undefined, nowIso)) {
    return { ok: true, needsStatusHeal: true }
  }

  return { ok: false, status: 409, error: 'Booking is not payable', code: 'not_payable' }
}
