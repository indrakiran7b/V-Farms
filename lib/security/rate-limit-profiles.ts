export type ApiRateLimitProfile = {
  name: string
  limit: number
  windowSeconds: number
}

export const API_RATE_LIMIT_PROFILES = {
  bookings: { name: 'bookings', limit: 40, windowSeconds: 15 * 60 },
  payments: { name: 'payments', limit: 30, windowSeconds: 15 * 60 },
  webhooks: { name: 'webhooks', limit: 200, windowSeconds: 60 },
} as const satisfies Record<string, ApiRateLimitProfile>

export function apiRateLimitBucketKey(profile: ApiRateLimitProfile, ip: string, suffix?: string): string {
  return `api:${profile.name}:${ip}${suffix ? `:${suffix}` : ''}`
}
