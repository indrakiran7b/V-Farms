'use server'

import { readAdminRole } from '@/lib/auth/admin'
import { hasPublicSupabaseConfig } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type AdminSignInState = {
  error?: string
}

export async function adminSignIn(
  _previous: AdminSignInState,
  formData: FormData,
): Promise<AdminSignInState> {
  if (!hasPublicSupabaseConfig()) {
    return {
      error:
        'Admin sign-in is not configured. Set NEXT_PUBLIC_SUPABASE_URL and your anon/publishable key in GoDaddy secrets, then restart preview.',
    }
  }

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: 'Invalid email or password.' }
  }

  const role = readAdminRole(data.user)
  if (!role) {
    await supabase.auth.signOut()
    return {
      error:
        'This account is not an administrator. In Supabase, set app_metadata.admin_role to owner, manager, or staff.',
    }
  }

  redirect('/admin')
}
