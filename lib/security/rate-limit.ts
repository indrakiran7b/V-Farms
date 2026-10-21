type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** Best-effort in-memory limiter (per runtime instance). */
export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now }
  }
  bucket.count += 1
  return { allowed: true, retryAfterMs: 0 }
}

export function clientIp(request: Request | { headers: Headers }): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}
