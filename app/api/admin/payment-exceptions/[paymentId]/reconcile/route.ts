import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOwnerApi } from '@/lib/auth/admin-api'
import { writeAdminAuditLog } from '@/lib/audit/write-admin-audit'
import { reconcileExceptionPaymentWithGateway } from '@/lib/payments/admin-exception-queue'

export async function POST(_request: Request, context: { params: Promise<{ paymentId: string }> }) {
  const owner = await requireOwnerApi()
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })
  try {
    const { paymentId } = await context.params
    z.string().uuid().parse(paymentId)
    const result = await reconcileExceptionPaymentWithGateway(owner.ctx.db, paymentId)
    await writeAdminAuditLog(owner.ctx.db, {
      actorUserId: owner.ctx.user.id,
      actorRole: owner.ctx.role,
      action: 'payment_exception.reconcile_gateway',
      targetType: 'payment',
      targetId: paymentId,
      details: result,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Reconciliation failed' }, { status: 400 })
  }
}
