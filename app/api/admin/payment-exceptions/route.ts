import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/admin-api'
import { listPaymentExceptions } from '@/lib/payments/admin-exception-queue'

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })
  try {
    const items = await listPaymentExceptions(admin.ctx.db)
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load exceptions' }, { status: 500 })
  }
}
