import type { SupabaseClient } from '@supabase/supabase-js'
import { isHoldActive } from '@/lib/booking/dates'
import { razorpayAmountMatchesInr } from '@/lib/payments/money'
import { bookingConfirmedNotificationRows } from '@/lib/payments/notifications'
import { createRazorpayServerClient } from '@/lib/payments/razorpay-server'
import { paymentStatusFromGatewayStatus } from '@/lib/payments/status'
import { dispatchPendingBookingNotifications } from '@/lib/notifications/dispatch-booking-notifications'

export type ExceptionResolutionAction = 'refund_initiated' | 'manual_complete' | 'dismissed'

export async function listPaymentExceptions(db: SupabaseClient) {
  const { data, error } = await db
    .from('payments')
    .select(`
      id,
      booking_id,
      razorpay_order_id,
      razorpay_payment_id,
      expected_amount_inr,
      captured_amount_inr,
      payment_status,
      exception_resolution_status,
      exception_resolution_note,
      exception_resolved_at,
      created_at,
      stay_bookings ( booking_reference, guest_name, booking_status )
    `)
    .eq('payment_status', 'exception')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function resolvePaymentException(
  db: SupabaseClient,
  paymentId: string,
  action: ExceptionResolutionAction,
  note: string,
  actorUserId: string,
) {
  const { data: payment, error } = await db
    .from('payments')
    .select('id,payment_status,exception_resolution_status')
    .eq('id', paymentId)
    .single()
  if (error || !payment) throw new Error('Payment not found')
  if (payment.payment_status !== 'exception') throw new Error('Payment is not in exception state')

  const statusMap: Record<ExceptionResolutionAction, string> = {
    refund_initiated: 'refund_initiated',
    manual_complete: 'manual_complete',
    dismissed: 'dismissed',
  }

  const { error: updateError } = await db
    .from('payments')
    .update({
      exception_resolution_status: statusMap[action],
      exception_resolution_note: note.slice(0, 2000),
      exception_resolved_at: new Date().toISOString(),
      exception_resolved_by: actorUserId,
    })
    .eq('id', paymentId)
    .eq('payment_status', 'exception')
  if (updateError) throw updateError
}

/** Re-fetch Razorpay; confirm booking only when gateway captured and hold still active. Never manual capture. */
export async function reconcileExceptionPaymentWithGateway(db: SupabaseClient, paymentId: string) {
  const { data: payment, error } = await db
    .from('payments')
    .select('id,booking_id,razorpay_order_id,razorpay_payment_id,expected_amount_inr,currency,payment_status')
    .eq('id', paymentId)
    .single()
  if (error || !payment) throw new Error('Payment not found')
  if (!payment.razorpay_payment_id) throw new Error('No Razorpay payment id on record')

  const gatewayPayment = await createRazorpayServerClient().payments.fetch(payment.razorpay_payment_id)
  if (
    gatewayPayment.order_id !== payment.razorpay_order_id
    || !razorpayAmountMatchesInr(Number(gatewayPayment.amount), Number(payment.expected_amount_inr))
    || gatewayPayment.currency !== payment.currency
  ) {
    throw new Error('Gateway payment does not match booking order')
  }

  const gatewayStatus = paymentStatusFromGatewayStatus(gatewayPayment.status)
  if (gatewayStatus !== 'captured') {
    return { reconciled: false, gatewayStatus }
  }

  const { data: hold } = await db
    .from('inventory_holds')
    .select('expires_at,status')
    .eq('booking_id', payment.booking_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!hold || !isHoldActive(hold.expires_at)) {
    return { reconciled: false, reason: 'hold_expired' as const }
  }

  await db
    .from('payments')
    .update({ payment_status: 'captured', verification_status: 'verified' })
    .eq('id', payment.id)
    .eq('payment_status', 'exception')

  const { data: confirmedBooking } = await db
    .from('stay_bookings')
    .update({ booking_status: 'confirmed', payment_status: 'captured' })
    .eq('id', payment.booking_id)
    .eq('booking_status', 'held')
    .select('id')
    .maybeSingle()

  if (confirmedBooking) {
    await db
      .from('booking_notifications')
      .upsert(bookingConfirmedNotificationRows(confirmedBooking.id), { onConflict: 'idempotency_key', ignoreDuplicates: true })
    await dispatchPendingBookingNotifications(db, { bookingId: confirmedBooking.id, limit: 10 })
  }

  return { reconciled: true, confirmed: Boolean(confirmedBooking) }
}
