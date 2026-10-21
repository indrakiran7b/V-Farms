import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOwnerApi } from '@/lib/auth/admin-api'
import { writeAdminAuditLog } from '@/lib/audit/write-admin-audit'
import { resolvePaymentException } from '@/lib/payments/admin-exception-queue'

const schema = z.object({
  action: z.enum(['refund_initiated', 'manual_complete', 'dismissed']),
  note: z.string().trim().min(3).max(2000),
})

export async function POST(request: Request, context: { params: Promise<{ paymentId: string }> }) {
  const owner = await requireOwnerApi()
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })
  try {
    const { paymentId } = await context.params
    z.string().uuid().parse(paymentId)
    const input = schema.parse(await request.json())
    await resolvePaymentException(owner.ctx.db, paymentId, input.action, input.note, owner.ctx.user.id)
    await writeAdminAuditLog(owner.ctx.db, {
      actorUserId: owner.ctx.user.id,
      actorRole: owner.ctx.role,
      action: 'payment_exception.resolve',
      targetType: 'payment',
      targetId: paymentId,
      details: { resolution: input.action },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? 'Invalid resolution request' : error instanceof Error ? error.message : 'Unable to resolve exception' },
      { status: 400 },
    )
  }
}
