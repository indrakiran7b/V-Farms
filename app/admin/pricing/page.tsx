import { adminSupabase } from '@/lib/booking'
import PricingManager from '@/components/pricing-manager'

export default async function Page() {
  const { data, error } = await adminSupabase().from('pricing_rules').select('id, name, start_date, end_date, nightly_inr, minimum_nights, active, updated_at').order('active', { ascending: false }).order('start_date')
  if (error) return <main className="admin-content"><div className="admin-alert">Unable to load pricing rules. {error.message}</div></main>
  return <main className="admin-content"><PricingManager initialRules={data ?? []} /></main>
}
