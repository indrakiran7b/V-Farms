import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { ENV_CATALOG, publicEnvExposesPrivilegedKeys } from '../lib/env.ts'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), 'utf8')
}

describe('API route security (static audit)', () => {
  it('protects payment exception admin APIs with admin/owner guards', () => {
    assert.match(read('app/api/admin/payment-exceptions/route.ts'), /requireAdminApi/)
    assert.match(read('app/api/admin/payment-exceptions/[paymentId]/resolve/route.ts'), /requireOwnerApi/)
    assert.match(read('app/api/admin/webhook-events/[id]/retry/route.ts'), /requireOwnerApi/)
  })

  it('protects admin pricing mutations with requireOwnerApi', () => {
    const source = read('app/api/admin/pricing/route.ts')
    assert.match(source, /requireOwnerApi/)
    assert.doesNotMatch(source, /export async function POST[\s\S]*?adminSupabase\(\)/)
  })

  it('verifies Razorpay webhook signatures before parsing side effects', () => {
    const source = read('app/api/webhooks/razorpay/route.ts')
    const sigIndex = source.indexOf('verifyWebhookSignature')
    const insertIndex = source.indexOf('payment_webhook_events')
    assert.ok(sigIndex >= 0 && insertIndex > sigIndex)
    assert.match(source, /\.insert\(/)
  })

  it('verifies checkout signatures before Razorpay fetch or DB capture updates', () => {
    const source = read('app/api/payments/verify/route.ts')
    const sigIndex = source.indexOf('verifyCheckoutSignature')
    const fetchIndex = source.indexOf('payments.fetch')
    assert.ok(sigIndex >= 0 && fetchIndex > sigIndex)
  })

  it('documents required env names without embedding secrets in repo templates', () => {
    const example = read('.env.example')
    assert.doesNotMatch(example, /=.+[a-zA-Z0-9]{20,}/)
    for (const group of ENV_CATALOG) {
      for (const name of group.variables) {
        assert.match(example, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      }
    }
  })

  it('flags forbidden NEXT_PUBLIC privileged key names in test runtime', () => {
    assert.deepEqual(publicEnvExposesPrivilegedKeys(), [])
  })
})
