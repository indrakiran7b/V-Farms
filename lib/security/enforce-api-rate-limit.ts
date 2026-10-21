import { NextResponse, type NextRequest } from 'next/server'
import { API_RATE_LIMIT_PROFILES, apiRateLimitBucketKey } from '@/lib/security/rate-limit-profiles'
import { clientIp } from '@/lib/security/rate-limit'
import { consumeRateLimit } from '@/lib/security/distributed-rate-limit'

function tooMany(retryAfterMs: number) {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000))
  return new NextResponse(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSec),
    },
  })
}

export async function enforceApiRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  const ip = clientIp(request)

  if (pathname.startsWith('/api/webhooks/razorpay')) {
    const profile = API_RATE_LIMIT_PROFILES.webhooks
    const eventId = request.headers.get('x-razorpay-event-id')
    const key = apiRateLimitBucketKey(profile, ip, eventId ? `evt:${eventId.slice(0, 64)}` : undefined)
    const result = await consumeRateLimit(key, profile.limit, profile.windowSeconds)
    return result.allowed ? null : tooMany(result.retryAfterMs)
  }

  if (pathname.startsWith('/api/bookings/')) {
    const profile = API_RATE_LIMIT_PROFILES.bookings
    const key = apiRateLimitBucketKey(profile, ip)
    const result = await consumeRateLimit(key, profile.limit, profile.windowSeconds)
    return result.allowed ? null : tooMany(result.retryAfterMs)
  }

  if (pathname.startsWith('/api/payments/')) {
    const profile = API_RATE_LIMIT_PROFILES.payments
    const key = apiRateLimitBucketKey(profile, ip)
    const result = await consumeRateLimit(key, profile.limit, profile.windowSeconds)
    return result.allowed ? null : tooMany(result.retryAfterMs)
  }

  return null
}
