import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOwnerApi } from '@/lib/auth/admin-api'
import { writeAdminAuditLog } from '@/lib/audit/write-admin-audit'
import { retryWebhookEventProcessing } from '@/lib/payments/retry-webhook-event'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await requireOwnerApi()
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })
  try {
    const { id } = await context.params
    z.string().uuid().parse(id)
    const result = await retryWebhookEventProcessing(owner.ctx.db, id)
    await writeAdminAuditLog(owner.ctx.db, {
      actorUserId: owner.ctx.user.id,
      actorRole: owner.ctx.role,
      action: 'webhook_event.retry',
      targetType: 'payment_webhook_event',
      targetId: id,
      details: result,
    })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Retry failed' }, { status: 400 })
  }
}
