import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdminRole } from '@/lib/auth/admin'

export async function writeAdminAuditLog(
  db: SupabaseClient,
  input: {
    actorUserId: string
    actorRole: AdminRole
    action: string
    targetType: string
    targetId: string
    details?: Record<string, unknown>
  },
) {
  const { error } = await db.from('admin_audit_logs').insert({
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    details: input.details ?? {},
  })
  if (error) throw error
}
