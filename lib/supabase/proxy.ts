import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { readAdminRole } from '@/lib/auth/admin'
import { hasPublicSupabaseConfig } from '@/lib/env'
import { clientIp, rateLimit } from '@/lib/security/rate-limit'
import { supabaseCookieOptions } from '@/lib/supabase/cookies'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin')) {
    const loginLimit = rateLimit(`admin-login:${clientIp(request)}`, 20, 15 * 60 * 1000)
    if (pathname.startsWith('/admin/login') && !loginLimit.allowed) {
      return new NextResponse('Too many login attempts. Try again later.', { status: 429 })
    }
    if (!hasPublicSupabaseConfig()) {
      return new NextResponse('Admin authentication is not configured.', { status: 503 })
    }
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  let response = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isLogin = pathname.startsWith('/admin/login')

  if (pathname.startsWith('/admin') && !isLogin) {
    const role = readAdminRole(user)
    if (!user || !role) {
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}
