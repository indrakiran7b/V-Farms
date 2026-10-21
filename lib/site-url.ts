/**
 * Canonical site origin for metadata, robots, sitemap, and JSON-LD.
 * Set NEXT_PUBLIC_SITE_URL on GoDaddy (staging/production) before build.
 */
export const DEFAULT_PRODUCTION_SITE_URL = 'https://v-farms.in'

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  return DEFAULT_PRODUCTION_SITE_URL
}
