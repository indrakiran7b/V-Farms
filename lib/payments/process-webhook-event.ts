import type { SupabaseClient } from '@supabase/supabase-js'
import { isHoldActive } from '@/lib/booking/dates'
import { razorpayAmountMatchesInr, razorpayPaiseToInr } from '@/lib/payments/money'
import { bookingConfirmedNotificationRows } from '@/lib/payments/notifications'
import { recordCapturedPaymentNeedsReconciliation } from '@/lib/payments/capture-reconciliation'
import { paymentStatusFromRazorpayEvent } from '@/lib/payments/status'
import { dispatchPendingBookingNotifications } from '@/lib/notifications/dispatch-booking-notifications'

export type RazorpayWebhookPayload = {
  event?: string
  payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string } } }
}

export type WebhookProcessResult =
  | { ok: true; holdExpired?: boolean; paymentRecorded?: boolean; confirmed?: boolean }
  | { ok: false; error: string }

export async function processRazorpayWebhookPayload(
  supabase: SupabaseClient,
  providerEventId: string,
  payload: RazorpayWebhookPayload,
): Promise<WebhookProcessResult> {
  const entity = payload.payload?.payment?.entity
  if (!entity?.order_id || entity.amount == null || !entity.currency) {
    return { ok: true }
  }

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id,booking_id,expected_amount_inr,currency,payment_status')
    .eq('razorpay_order_id', entity.order_id)
    .single()
  if (paymentError || !payment) {
    return { ok: true }
  }

  if (!razorpayAmountMatchesInr(entity.amount, Number(payment.expected_amount_inr)) || entity.currency !== payment.currency) {
    return { ok: true }
  }

  const status = paymentStatusFromRazorpayEvent(payload.event)
  if (status !== 'captured') {
    await supabase
      .from('payments')
      .update({
        razorpay_payment_id: entity.id,
        captured_amount_inr: razorpayPaiseToInr(entity.amount),
        payment_status: status,
        verification_status: 'verified',
      })
      .eq('id', payment.id)
      .neq('payment_status', 'captured')
    return { ok: true }
  }

  const { data: hold } = await supabase
    .from('inventory_holds')
    .select('expires_at,status')
    .eq('booking_id', payment.booking_id)
    .eq('status', 'active')
    .maybeSingle()

  if (!hold || !isHoldActive(hold.expires_at)) {
    if (entity.id) {
      await recordCapturedPaymentNeedsReconciliation(supabase, payment.id, entity.id, entity.amount)
    }
    return { ok: true, holdExpired: true, paymentRecorded: true }
  }

  await supabase
    .from('payments')
    .update({
      razorpay_payment_id: entity.id,
      captured_amount_inr: razorpayPaiseToInr(entity.amount),
      payment_status: 'captured',
      verification_status: 'verified',
    })
    .eq('id', payment.id)
    .neq('payment_status', 'captured')

  const { data: confirmedBooking, error: bookingError } = await supabase
    .from('stay_bookings')
    .update({ booking_status: 'confirmed', payment_status: 'captured' })
    .eq('id', payment.booking_id)
    .eq('booking_status', 'held')
    .select('id')
    .maybeSingle()
  if (bookingError) return { ok: false, error: bookingError.message }

  if (confirmedBooking) {
    const { error: notificationError } = await supabase
      .from('booking_notifications')
      .upsert(bookingConfirmedNotificationRows(confirmedBooking.id), { onConflict: 'idempotency_key', ignoreDuplicates: true })
    if (notificationError) return { ok: false, error: notificationError.message }
    await dispatchPendingBookingNotifications(supabase, { bookingId: confirmedBooking.id, limit: 10 })
  }

  return { ok: true, confirmed: Boolean(confirmedBooking) }
}
