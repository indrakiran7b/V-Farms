import AdminPaymentExceptions from '@/components/admin-payment-exceptions'
import { listPaymentExceptions } from '@/lib/payments/admin-exception-queue'
import { adminSupabase } from '@/lib/booking'
import { getAdminSession } from '@/lib/auth/session'
import { isOwnerRole } from '@/lib/auth/admin'
import { redirect } from 'next/navigation'

export default async function Page() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  const items = await listPaymentExceptions(adminSupabase())
  return (
    <main className="admin-content">
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Payments</p>
          <h1>Payment exceptions</h1>
          <p className="admin-muted">Captured funds that could not confirm a booking (usually expired holds). Staff cannot mark captured without Razorpay gateway verification.</p>
        </div>
      </div>
      <AdminPaymentExceptions initialItems={items as never} isOwner={isOwnerRole(session.role)} />
    </main>
  )
}
