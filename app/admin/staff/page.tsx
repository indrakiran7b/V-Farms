import { requireAdminPageSession } from '@/lib/auth/guard-server'

export default async function StaffPage() {
  const { user, role } = await requireAdminPageSession()
  return <main className="admin-content"><div className="admin-heading"><div><p className="admin-kicker">Access control</p><h1>Staff</h1><p className="admin-muted">Review the signed-in administrator and the role claim used by this portal.</p></div></div><section className="admin-panel"><div className="admin-staff-card"><div><p className="admin-kicker">Current operator</p><h2>{user?.email ?? 'Unknown operator'}</h2><p className="admin-muted">Supabase user ID: {user?.id ?? 'Unavailable'}</p></div><span className="admin-status confirmed">{role}</span></div><div className="admin-empty-panel"><h2>Role-based access is enabled</h2><p>Administrator access is read from Supabase app metadata. Add or change staff roles through your secured identity-management workflow; this page never exposes service credentials or allows client-side role escalation.</p></div></section></main>
}
