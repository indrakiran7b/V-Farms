'use client'

import { createBrowserClient } from '@supabase/ssr'
import { FormEvent, useState } from 'react'
import { readAdminRole } from '@/lib/auth/admin'
import { supabaseCookieOptions } from '@/lib/supabase/cookies'

const SIGN_IN_TIMEOUT_MS = 25_000

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

type Props = {
  supabaseUrl: string
  supabaseAnonKey: string
  configured: boolean
}

export default function AdminLoginForm({ supabaseUrl, supabaseAnonKey, configured }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    if (!configured) {
      setError(
        'Admin sign-in is not configured. Add NEXT_PUBLIC_SUPABASE_URL and your anon/publishable key in GoDaddy secrets, then restart or redeploy preview.',
      )
      setLoading(false)
      return
    }
    try {
      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
        cookieOptions: supabaseCookieOptions(),
      })
      const { data, error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        SIGN_IN_TIMEOUT_MS,
        'Sign-in timed out waiting for Supabase.',
      )
      if (signInError) {
        setError('Invalid email or password.')
        return
      }
      const role = readAdminRole(data.user)
      if (!role) {
        await withTimeout(
          supabase.auth.signOut(),
          SIGN_IN_TIMEOUT_MS,
          'Sign-out timed out after a non-admin sign-in.',
        )
        setError(
          'This account signed in but is not an administrator. In Supabase, set app_metadata.admin_role to owner, manager, or staff.',
        )
        return
      }
      window.location.assign('/admin')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed.'
      if (message.includes('timed out')) {
        setError(
          'Sign-in timed out reaching Supabase. Check GoDaddy secrets, Supabase project status, and the Network tab for requests to supabase.co.',
        )
      } else {
        setError('Sign-in failed unexpectedly. Try again or check runtime logs.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login">
      <div className="admin-login-card">
        <p className="admin-kicker">V-Farms operations</p>
        <h1>Welcome back.</h1>
        <p className="admin-muted">Sign in with an authorized administrator account.</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <button className="admin-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <a className="admin-back" href="/">
          Return to website
        </a>
      </div>
    </main>
  )
}
