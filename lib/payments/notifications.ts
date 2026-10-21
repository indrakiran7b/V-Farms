export function bookingConfirmedNotificationRows(bookingId: string, channels: readonly string[] = ['email', 'sms']) {
  return channels.map((channel) => ({
    booking_id: bookingId,
    channel,
    idempotency_key: `booking-confirmed:${bookingId}:${channel}`,
  }))
}
