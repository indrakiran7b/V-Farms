import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const checks: Array<{ id: string; label: string; ready: boolean }> = [
    { id: 'supabase', label: 'Supabase database', ready: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    { id: 'razorpay', label: 'Razorpay payments', ready: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) },
    { id: 'session', label: 'Authenticated session', ready: Boolean(user) },
  ]
  return <main className="admin-content"><div className="admin-heading"><div><p className="admin-kicker">Operations</p><h1>Settings</h1><p className="admin-muted">Review the production services connected to this V-Farms workspace.</p></div></div><section className="admin-panel"><div className="admin-section-title"><div><p className="admin-kicker">Connection health</p><h2>Configured services</h2></div></div><div className="admin-health-list">{checks.map(({ id, label, ready }) => <div className="admin-health-row" key={id}><span>{label}</span><span className={`admin-status ${ready ? 'confirmed' : 'failed'}`}>{ready ? 'Connected' : 'Not configured'}</span></div>)}</div></section></main>
}
