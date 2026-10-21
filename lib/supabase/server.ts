import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { hasPublicSupabaseConfig } from '@/lib/env'
import { supabaseCookieOptions } from '@/lib/supabase/cookies'

export async function createClient() {
  if (!hasPublicSupabaseConfig()) {
    throw new Error('Supabase public configuration is missing')
  }
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions(),
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component that cannot set cookies.
          }
        },
      },
    },
  )
}
