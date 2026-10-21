import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readAdminRole, safeAdminRedirectPath, ADMIN_ROLES } from '../lib/auth/admin.ts'
import { publicEnvExposesPrivilegedKeys } from '../lib/env.ts'
import { rateLimit } from '../lib/security/rate-limit.ts'
import { verifyWebhookSignature } from '../lib/payments/signatures.ts'

describe('readAdminRole', () => {
  it('rejects missing or unknown roles', () => {
    assert.equal(readAdminRole(null), null)
    assert.equal(readAdminRole({ app_metadata: {} }), null)
    assert.equal(readAdminRole({ app_metadata: { role: 'guest' } }), null)
  })

  it('accepts owner, manager, and staff from app metadata', () => {
    for (const role of ADMIN_ROLES) {
      assert.equal(readAdminRole({ app_metadata: { admin_role: role } }), role)
    }
  })

  it('does not default authenticated users to staff', () => {
    assert.equal(readAdminRole({ app_metadata: { role: undefined, admin_role: undefined } }), null)
  })
})

describe('safeAdminRedirectPath', () => {
  it('allows internal admin paths only', () => {
    assert.equal(safeAdminRedirectPath('/admin/bookings'), '/admin/bookings')
    assert.equal(safeAdminRedirectPath('/admin'), '/admin')
  })

  it('blocks external and protocol-relative redirects', () => {
    assert.equal(safeAdminRedirectPath('https://evil.example'), '/admin')
    assert.equal(safeAdminRedirectPath('//evil.example'), '/admin')
    assert.equal(safeAdminRedirectPath('/public'), '/admin')
  })
})

describe('rateLimit', () => {
  it('blocks after the configured threshold', () => {
    const key = `test-${Date.now()}`
    assert.equal(rateLimit(key, 2, 60_000).allowed, true)
    assert.equal(rateLimit(key, 2, 60_000).allowed, true)
    assert.equal(rateLimit(key, 2, 60_000).allowed, false)
  })
})

describe('privileged env exposure', () => {
  it('reports no NEXT_PUBLIC privileged key names in this runtime', () => {
    assert.deepEqual(publicEnvExposesPrivilegedKeys(), [])
  })
})

describe('public webhook verification (unit)', () => {
  it('still rejects invalid webhook signatures without admin session', () => {
    const body = '{"event":"payment.captured"}'
    assert.equal(verifyWebhookSignature(body, 'test-secret', 'invalid'), false)
  })
})
