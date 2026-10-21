import type { SupabaseClient } from '@supabase/supabase-js'
import { hasTransactionalEmailConfig } from '@/lib/env'
import { sendTransactionalEmail } from '@/lib/notifications/resend-email'

const MAX_ATTEMPTS = 5

export async function dispatchPendingBookingNotifications(
  supabase: SupabaseClient,
  options: { bookingId?: string; limit?: number } = {},
): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  const limit = options.limit ?? 25
  let query = supabase
    .from('booking_notifications')
    .select('id,booking_id,channel,status,attempt_count,idempotency_key')
    .in('status', ['pending', 'failed'])
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (options.bookingId) query = query.eq('booking_id', options.bookingId)

  const { data: rows, error } = await query
  if (error || !rows?.length) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 }
  }

  let sent = 0
  let failed = 0
  let skipped = 0

  const list = Array.isArray(rows) ? rows : [rows]
  for (const row of list) {
    if (row.channel === 'sms') {
      skipped += 1
      await supabase
        .from('booking_notifications')
        .update({ status: 'pending', last_error: 'SMS delivery is not configured' })
        .eq('id', row.id)
      continue
    }

    if (row.channel !== 'email') {
      skipped += 1
      continue
    }

    if (!hasTransactionalEmailConfig()) {
      skipped += 1
      continue
    }

    const { data: booking } = await supabase
      .from('stay_bookings')
      .select('booking_reference,guest_email,guest_name,check_in,check_out')
      .eq('id', row.booking_id)
      .single()

    if (!booking?.guest_email) {
      failed += 1
      await supabase
        .from('booking_notifications')
        .update({
          status: 'failed',
          attempt_count: row.attempt_count + 1,
          last_error: 'Guest email missing',
        })
        .eq('id', row.id)
      continue
    }

    const result = await sendTransactionalEmail({
      to: booking.guest_email,
      subject: `V-Farms booking confirmed · ${booking.booking_reference}`,
      html: `<p>Dear ${booking.guest_name},</p><p>Your stay is confirmed. Reference <strong>${booking.booking_reference}</strong>.</p><p>Check-in ${booking.check_in} · Check-out ${booking.check_out}.</p>`,
    })

    if (result.ok) {
      sent += 1
      await supabase
        .from('booking_notifications')
        .update({
          status: 'sent',
          provider_message_id: result.providerMessageId,
          attempt_count: row.attempt_count + 1,
          last_error: null,
        })
        .eq('id', row.id)
    } else {
      const attempts = row.attempt_count + 1
      failed += 1
      await supabase
        .from('booking_notifications')
        .update({
          status: attempts >= MAX_ATTEMPTS || !result.retryable ? 'dead_letter' : 'failed',
          attempt_count: attempts,
          last_error: result.error,
        })
        .eq('id', row.id)
    }
  }

  return { processed: rows.length, sent, failed, skipped }
}
