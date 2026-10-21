import type { SupabaseClient } from '@supabase/supabase-js'
import { razorpayPaiseToInr } from './money'

/** Gateway captured funds but inventory hold no longer allows booking confirmation (manual reconciliation). */
export async function recordCapturedPaymentNeedsReconciliation(
  supabase: SupabaseClient,
  paymentId: string,
  razorpayPaymentId: string,
  amountPaise: number,
) {
  await supabase
    .from('payments')
    .update({
      razorpay_payment_id: razorpayPaymentId,
      captured_amount_inr: razorpayPaiseToInr(amountPaise),
      verification_status: 'verified',
      payment_status: 'exception',
      exception_resolution_status: 'open',
    })
    .eq('id', paymentId)
    .neq('payment_status', 'captured')
}
