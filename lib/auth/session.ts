import { createClient } from '@/lib/supabase/server'
import { hasPublicSupabaseConfig } from '@/lib/env'
import { readAdminRole, type AdminRole } from '@/lib/auth/admin'

export async function getAdminSession(): Promise<{ user: { id: string; email?: string | null; app_metadata?: Record<string, unknown> }; role: AdminRole } | null> {
  if (!hasPublicSupabaseConfig()) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = readAdminRole(user)
  if (!user || !role) return null
  return { user, role }
}
