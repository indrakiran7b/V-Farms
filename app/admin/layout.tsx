import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminShell from '@/components/admin-shell'
import { getAdminSession } from '@/lib/auth/session'
import { hasPublicSupabaseConfig } from '@/lib/env'

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get('x-pathname') ?? ''
  const isLogin = pathname.endsWith('/admin/login') || pathname === '/admin/login'

  if (isLogin) {
    if (!hasPublicSupabaseConfig()) {
      return (
        <main className="admin-denied">
          <h1>Admin unavailable</h1>
          <p>Authentication is not configured for this environment.</p>
        </main>
      )
    }
    return <>{children}</>
  }

  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  return (
    <AdminShell email={session.user.email ?? ''} role={session.role}>
      {children}
    </AdminShell>
  )
}
