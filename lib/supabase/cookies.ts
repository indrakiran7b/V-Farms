import type { CookieOptions } from '@supabase/ssr'

export function supabaseCookieOptions(): CookieOptions {
  return {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true,
    path: '/',
  }
}
