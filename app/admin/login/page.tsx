import AdminLoginForm from '@/app/admin/login/admin-login-form'
import { getPublicSupabaseConfig } from '@/lib/supabase/public-config'

export default function AdminLoginPage() {
  const { configured } = getPublicSupabaseConfig()
  return <AdminLoginForm configured={configured} />
}
