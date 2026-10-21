import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/auth/session'
import { isOwnerRole } from '@/lib/auth/admin'

export async function requireAdminPageSession() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return session
}

export async function requireOwnerPageSession() {
  const session = await requireAdminPageSession()
  if (!isOwnerRole(session.role)) redirect('/admin?access=owner-only')
  return session
}
