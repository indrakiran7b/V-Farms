/**
 * Canonical site origin for metadata, robots, sitemap, and JSON-LD.
 * Set NEXT_PUBLIC_SITE_URL in Render (and other hosts) before build — it is inlined at build time.
 */
export const DEFAULT_PRODUCTION_SITE_URL = 'https://vfarms.in'

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  return DEFAULT_PRODUCTION_SITE_URL
}
