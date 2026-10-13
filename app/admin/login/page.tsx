'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(''); const { error } = await createClient().auth.signInWithPassword({ email, password }); if (error) setError('Invalid email or password.'); else window.location.href = '/admin'; setLoading(false) }
  return <main className="admin-login"><div className="admin-login-card"><p className="admin-kicker">V-Farms operations</p><h1>Welcome back.</h1><p className="admin-muted">Sign in with an authorized administrator account.</p><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<input type="password" required value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p className="admin-error" role="alert">{error}</p>}<button className="admin-primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button></form><a className="admin-back" href="/">Return to website</a></div></main>
}
