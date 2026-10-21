export type BookingLifecycleStatus = 'held' | 'confirmed'

export type PaymentRecordStatus = 'created' | 'pending' | 'captured' | 'failed' | 'exception'

export function paymentStatusFromRazorpayEvent(event: string | undefined): PaymentRecordStatus {
  if (event === 'payment.captured') return 'captured'
  if (event === 'payment.failed') return 'failed'
  return 'pending'
}

export function paymentStatusFromGatewayStatus(gatewayStatus: string): PaymentRecordStatus {
  if (gatewayStatus === 'captured') return 'captured'
  if (gatewayStatus === 'failed') return 'failed'
  return 'pending'
}

/** Booking may move to confirmed only from held with verified capture and an active hold window. */
export function canConfirmHeldBooking(input: {
  bookingStatus: BookingLifecycleStatus | string
  holdActive: boolean
  paymentCaptured: boolean
}): boolean {
  return input.bookingStatus === 'held' && input.holdActive && input.paymentCaptured
}

export function isPostgresUniqueViolation(code: string | undefined): boolean {
  return code === '23505'
}

/** PostgreSQL exclusion_violation — inventory hold overlap in hold route. */
export function isPostgresExclusionViolation(code: string | undefined): boolean {
  return code === '23P01'
}
