import { type NextRequest } from 'next/server'
import { enforceApiRateLimit } from '@/lib/security/enforce-api-rate-limit'
import { updateSession } from '@/lib/supabase/proxy'

export async function middleware(request: NextRequest) {
  const limited = await enforceApiRateLimit(request)
  if (limited) return limited
  return updateSession(request)
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/auth/:path*',
    '/api/bookings/:path*',
    '/api/payments/:path*',
    '/api/webhooks/razorpay',
  ],
}
