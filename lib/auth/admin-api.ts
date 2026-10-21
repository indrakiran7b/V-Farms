import { createClient } from '@/lib/supabase/server'
import { adminSupabase } from '@/lib/booking'
import { hasPublicSupabaseConfig } from '@/lib/env'
import { isOwnerRole, readAdminRole, type AdminRole } from '@/lib/auth/admin'

export type AdminApiContext = {
  user: { id: string; email?: string | null; app_metadata?: Record<string, unknown> }
  role: AdminRole
  db: ReturnType<typeof adminSupabase>
}

export async function requireAdminApi(): Promise<
  | { ok: true; ctx: AdminApiContext }
  | { ok: false; status: 401 | 403; error: string }
> {
  if (!hasPublicSupabaseConfig()) {
    return { ok: false, status: 401, error: 'Admin authentication is not configured' }
  }
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' }
  const role = readAdminRole(user)
  if (!role) return { ok: false, status: 403, error: 'Forbidden' }
  return { ok: true, ctx: { user, role, db: adminSupabase() } }
}

export async function requireOwnerApi(): Promise<
  | { ok: true; ctx: AdminApiContext }
  | { ok: false; status: 401 | 403; error: string }
> {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin
  if (!isOwnerRole(admin.ctx.role)) return { ok: false, status: 403, error: 'Owner access required' }
  return admin
}
