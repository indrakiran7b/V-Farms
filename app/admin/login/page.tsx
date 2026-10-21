import AdminLoginForm from '@/app/admin/login/admin-login-form'
import { getPublicSupabaseConfig } from '@/lib/supabase/public-config'

export default function AdminLoginPage() {
  const { url, anonKey, configured } = getPublicSupabaseConfig()
  return <AdminLoginForm supabaseUrl={url} supabaseAnonKey={anonKey} configured={configured} />
}
