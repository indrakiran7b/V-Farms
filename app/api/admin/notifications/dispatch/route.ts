import { NextResponse } from 'next/server'
import { requireOwnerApi } from '@/lib/auth/admin-api'
import { writeAdminAuditLog } from '@/lib/audit/write-admin-audit'
import { dispatchPendingBookingNotifications } from '@/lib/notifications/dispatch-booking-notifications'
import { hasTransactionalEmailConfig } from '@/lib/env'

export async function POST() {
  const owner = await requireOwnerApi()
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })
  if (!hasTransactionalEmailConfig()) {
    return NextResponse.json(
      { error: 'Transactional email is not configured (RESEND_API_KEY and EMAIL_FROM required). Queue remains visible in admin.' },
      { status: 503 },
    )
  }
  try {
    const summary = await dispatchPendingBookingNotifications(owner.ctx.db, { limit: 50 })
    await writeAdminAuditLog(owner.ctx.db, {
      actorUserId: owner.ctx.user.id,
      actorRole: owner.ctx.role,
      action: 'booking_notifications.dispatch',
      targetType: 'booking_notifications',
      targetId: 'batch',
      details: summary,
    })
    return NextResponse.json(summary)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Dispatch failed' }, { status: 500 })
  }
}
