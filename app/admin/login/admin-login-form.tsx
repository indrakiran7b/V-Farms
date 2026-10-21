'use client'

import { useActionState } from 'react'
import { adminSignIn, type AdminSignInState } from '@/app/admin/login/actions'

const initialState: AdminSignInState = {}

export default function AdminLoginForm({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState(adminSignIn, initialState)
  const error =
    state.error ??
    (!configured
      ? 'Admin sign-in is not configured. Set NEXT_PUBLIC_SUPABASE_URL and your anon/publishable key in GoDaddy secrets, then restart preview.'
      : undefined)

  return (
    <main className="admin-login">
      <div className="admin-login-card">
        <p className="admin-kicker">V-Farms operations</p>
        <h1>Welcome back.</h1>
        <p className="admin-muted">Sign in with an authorized administrator account.</p>
        <form action={formAction}>
          <label>
            Email
            <input name="email" type="email" required autoComplete="username" disabled={pending} />
          </label>
          <label>
            Password
            <input name="password" type="password" required autoComplete="current-password" disabled={pending} />
          </label>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <button className="admin-primary" type="submit" disabled={pending || !configured}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <a className="admin-back" href="/">
          Return to website
        </a>
      </div>
    </main>
  )
}
