import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminShell from '@/components/admin-shell'

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) { const pathname = (await headers()).get('x-pathname') ?? (await headers()).get('next-url') ?? ''; const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (pathname.endsWith('/admin/login')) return <>{children}</>; if (!user) redirect('/admin/login'); const role = String(user.app_metadata?.admin_role ?? user.app_metadata?.role ?? 'staff'); if (!['owner', 'manager', 'staff'].includes(role)) return <main className="admin-denied"><h1>Access denied</h1><p>Your account is not authorized for V-Farms administration.</p></main>; return <AdminShell email={user.email ?? ''} role={role}>{children}</AdminShell> }
