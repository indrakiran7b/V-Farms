'use client'

import { useState } from 'react'

type ExceptionItem = {
  id: string
  booking_id: string
  razorpay_order_id: string
  razorpay_payment_id: string | null
  expected_amount_inr: number
  captured_amount_inr: number | null
  exception_resolution_status: string | null
  created_at: string
  stay_bookings: { booking_reference: string; guest_name: string; booking_status: string } | null
}

export default function AdminPaymentExceptions({ initialItems, isOwner }: { initialItems: ExceptionItem[]; isOwner: boolean }) {
  const [items, setItems] = useState(initialItems)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  async function resolve(paymentId: string, action: 'refund_initiated' | 'manual_complete' | 'dismissed') {
    const note = window.prompt('Resolution note (required for audit trail):')
    if (!note || note.trim().length < 3) return
    setBusy(paymentId)
    setMessage('')
    try {
      const response = await fetch(`/api/admin/payment-exceptions/${paymentId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: note.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Unable to resolve')
      setItems((prev) => prev.filter((item) => item.id !== paymentId))
      setMessage('Exception updated and audit entry recorded.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to resolve exception')
    } finally {
      setBusy(null)
    }
  }

  async function reconcile(paymentId: string) {
    setBusy(paymentId)
    setMessage('')
    try {
      const response = await fetch(`/api/admin/payment-exceptions/${paymentId}/reconcile`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Reconciliation failed')
      setMessage(data.reconciled ? 'Gateway reconciliation completed.' : `No confirm: ${data.reason ?? data.gatewayStatus ?? 'check hold and gateway status'}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Reconciliation failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="admin-panel">
      {message && <div className="admin-alert">{message}</div>}
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Booking ref</th>
              <th>Amount (INR)</th>
              <th>Razorpay order</th>
              <th>Razorpay payment</th>
              <th>Resolution</th>
              <th>Created</th>
              {isOwner && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.stay_bookings?.booking_reference ?? item.booking_id}</td>
                <td>{Number(item.captured_amount_inr ?? item.expected_amount_inr).toLocaleString('en-IN')}</td>
                <td><code>{item.razorpay_order_id}</code></td>
                <td><code>{item.razorpay_payment_id ?? '—'}</code></td>
                <td>{item.exception_resolution_status ?? 'open'}</td>
                <td>{new Date(item.created_at).toLocaleString('en-IN')}</td>
                {isOwner && (
                  <td>
                    <button type="button" disabled={busy === item.id} onClick={() => reconcile(item.id)}>Reconcile via gateway</button>
                    {' '}
                    <button type="button" disabled={busy === item.id} onClick={() => resolve(item.id, 'refund_initiated')}>Refund initiated</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length && <div className="admin-empty">No payment exceptions require attention.</div>}
      {!isOwner && <p className="admin-muted">Owner role required to resolve or reconcile exceptions.</p>}
    </section>
  )
}
