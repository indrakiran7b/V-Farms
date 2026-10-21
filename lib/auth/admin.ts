export const ADMIN_ROLES = ['owner', 'manager', 'staff'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

type UserLike = {
  app_metadata?: Record<string, unknown>
} | null | undefined

export function readAdminRole(user: UserLike): AdminRole | null {
  if (!user) return null
  const raw = user.app_metadata?.admin_role ?? user.app_metadata?.role
  if (typeof raw !== 'string') return null
  return (ADMIN_ROLES as readonly string[]).includes(raw) ? (raw as AdminRole) : null
}

export function isOwnerRole(role: AdminRole | null): boolean {
  return role === 'owner'
}

/** Reject open redirects; allow same-site relative paths only. */
export function safeAdminRedirectPath(candidate: string | null | undefined, fallback = '/admin'): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('://')) return fallback
  if (!candidate.startsWith('/admin')) return fallback
  return candidate
}
