export const HOLD_DURATION_MS = 15 * 60 * 1000

export function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round((Date.parse(`${checkOut}T00:00:00+05:30`) - Date.parse(`${checkIn}T00:00:00+05:30`)) / 86400000)
}

export function validateStayDates(checkIn: string, checkOut: string): { ok: true } | { ok: false; reason: string } {
  if (checkOut <= checkIn) return { ok: false, reason: 'Check-out must be after check-in' }
  return { ok: true }
}

/** Half-open interval [start, end) — checkout morning ends the stay. */
export function dateRangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA
}

export function holdExpiresAt(fromMs: number = Date.now()): string {
  return new Date(fromMs + HOLD_DURATION_MS).toISOString()
}

export function isHoldActive(expiresAt: string, nowMs: number = Date.now()): boolean {
  return Date.parse(expiresAt) > nowMs
}
