import { adminSupabase } from '@/lib/booking'

export type RateLimitResult = { allowed: boolean; retryAfterMs: number }

let integrationRateLimit: ((key: string, limit: number, windowSeconds: number) => Promise<RateLimitResult>) | undefined

/** Test-only override for consumeRateLimit. */
export function __integrationTestSetRateLimit(
  fn: ((key: string, limit: number, windowSeconds: number) => Promise<RateLimitResult>) | undefined,
) {
  integrationRateLimit = fn
}

/**
 * Postgres-backed counters (Supabase). Shared across serverless instances.
 * Requires migration `20261021120000_ops_hardening` and service role credentials.
 */
export async function consumeRateLimit(
  bucketKey: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (integrationRateLimit) return integrationRateLimit(bucketKey, limit, windowSeconds)
  try {
    const supabase = adminSupabase()
    const { data, error } = await supabase.rpc('consume_rate_limit', {
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    if (error || !data || typeof data !== 'object') {
      return { allowed: true, retryAfterMs: 0 }
    }
    const payload = data as { allowed?: boolean; retry_after_seconds?: number }
    const allowed = payload.allowed !== false
    const retryAfterMs = Math.max(0, Number(payload.retry_after_seconds ?? 0) * 1000)
    return { allowed, retryAfterMs }
  } catch {
    return { allowed: true, retryAfterMs: 0 }
  }
}
