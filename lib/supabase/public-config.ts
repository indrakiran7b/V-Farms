/** Public Supabase settings from server runtime env (works on GoDaddy after secrets, without rebuild). */
export function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    ''
  return { url, anonKey, configured: url.length > 0 && anonKey.length > 0 }
}
