export type EnvVarTiming = 'build' | 'runtime' | 'build-and-runtime'

export type EnvVarGroup = {
  name: string
  requiredFor: string
  variables: string[]
  /** When the host must provide the variable (Render: rebuild after changing `build` vars). */
  timing?: EnvVarTiming
}

/** Documented environment variables (names only — never log values). */
export const ENV_CATALOG: EnvVarGroup[] = [
  {
    name: 'Public site origin (metadata, SEO)',
    requiredFor: 'Canonical URLs on Render/GoDaddy production builds',
    timing: 'build',
    variables: ['NEXT_PUBLIC_SITE_URL'],
  },
  {
    name: 'Public Supabase (browser + middleware)',
    requiredFor: 'Admin auth session and client-side Supabase',
    timing: 'build',
    variables: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  },
  {
    name: 'Server Supabase (API routes, booking)',
    requiredFor: 'Quotes, holds, payments, admin data',
    timing: 'runtime',
    variables: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'],
  },
  {
    name: 'Razorpay checkout',
    requiredFor: 'Create order and verify payment on site',
    timing: 'runtime',
    variables: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
  },
  {
    name: 'Razorpay webhooks',
    requiredFor: 'Async payment capture confirmation',
    timing: 'runtime',
    variables: ['RAZORPAY_WEBHOOK_SECRET'],
  },
  {
    name: 'Transactional email (optional)',
    requiredFor: 'Booking confirmation email delivery via Resend',
    timing: 'runtime',
    variables: ['RESEND_API_KEY', 'EMAIL_FROM'],
  },
]

export type EnvCheck = { name: string; present: boolean }

function isSet(name: string): boolean {
  const value = process.env[name]
  return typeof value === 'string' && value.trim().length > 0
}

/** Returns presence flags only — safe for logs and admin UI. */
export function checkRequiredEnv(): EnvCheck[] {
  const unique = [...new Set(ENV_CATALOG.flatMap((group) => group.variables))]
  return unique.map((name) => ({ name, present: isSet(name) }))
}

/** At least one Supabase URL and one anon/publishable key must be set for the app to function. */
export function hasPublicSupabaseConfig(): boolean {
  return isSet('NEXT_PUBLIC_SUPABASE_URL') && (isSet('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || isSet('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
}

/** Server routes that mutate bookings need service credentials. */
export function hasServerSupabaseConfig(): boolean {
  const url = isSet('SUPABASE_URL') || isSet('NEXT_PUBLIC_SUPABASE_URL')
  const key = isSet('SUPABASE_SERVICE_ROLE_KEY') || isSet('SUPABASE_SECRET_KEY')
  return url && key
}

export function hasRazorpayCheckoutConfig(): boolean {
  return isSet('RAZORPAY_KEY_ID') && isSet('RAZORPAY_KEY_SECRET')
}

export function hasTransactionalEmailConfig(): boolean {
  return isSet('RESEND_API_KEY') && isSet('EMAIL_FROM')
}

const PUBLIC_ENV = Object.keys(process.env).filter((name) => name.startsWith('NEXT_PUBLIC_'))

/** Service credentials must never be exposed via NEXT_PUBLIC_* names. */
export function publicEnvExposesPrivilegedKeys(): string[] {
  const forbidden = ['SERVICE_ROLE', 'SECRET_KEY', 'RAZORPAY_KEY_SECRET', 'WEBHOOK_SECRET', 'SUPABASE_SECRET']
  return PUBLIC_ENV.filter((name) => forbidden.some((fragment) => name.toUpperCase().includes(fragment)))
}
