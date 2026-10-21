import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/admin-api'

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })
  const { data, error } = await admin.ctx.db
    .from('payment_webhook_events')
    .select('id,provider_event_id,event_type,processing_status,attempt_count,last_error,next_retry_at,processed_at,created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: 'Unable to load webhook events' }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}
