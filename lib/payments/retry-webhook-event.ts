import type { SupabaseClient } from '@supabase/supabase-js'
import { processRazorpayWebhookPayload, type RazorpayWebhookPayload } from '@/lib/payments/process-webhook-event'

export async function retryWebhookEventProcessing(db: SupabaseClient, eventRowId: string) {
  const { data: event, error } = await db
    .from('payment_webhook_events')
    .select('id,provider_event_id,event_type,payload_json,processing_status,attempt_count')
    .eq('id', eventRowId)
    .single()
  if (error || !event) throw new Error('Webhook event not found')
  if (!event.payload_json) throw new Error('Webhook payload was not stored for retry')

  const payload = event.payload_json as RazorpayWebhookPayload
  const attempt = Number(event.attempt_count ?? 0) + 1

  const result = await processRazorpayWebhookPayload(db, event.provider_event_id, payload)
  if (!result.ok) {
    await db
      .from('payment_webhook_events')
      .update({
        processing_status: 'failed',
        attempt_count: attempt,
        last_error: result.error,
        next_retry_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .eq('id', eventRowId)
    throw new Error(result.error)
  }

  await db
    .from('payment_webhook_events')
    .update({
      processing_status: 'processed',
      attempt_count: attempt,
      last_error: null,
      processed_at: new Date().toISOString(),
      next_retry_at: null,
    })
    .eq('id', eventRowId)

  return result
}
