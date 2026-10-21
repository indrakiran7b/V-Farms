import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  findStayAvailabilityConflict,
  inventoryHoldBlocksStay,
  shouldExpireInventoryHold,
  stayBookingBlocksStay,
} from '../lib/booking/availability.ts'
import { dateRangesOverlap } from '../lib/booking/dates.ts'

const NOW = '2026-05-01T12:00:00.000Z'
const PAST = '2026-05-01T11:00:00.000Z'
const FUTURE = '2026-05-01T12:30:00.000Z'

describe('shouldExpireInventoryHold', () => {
  it('marks active holds at or past expires_at for expiry transition', () => {
    assert.equal(shouldExpireInventoryHold('active', PAST, NOW), true)
    assert.equal(shouldExpireInventoryHold('active', NOW, NOW), true)
    assert.equal(shouldExpireInventoryHold('active', FUTURE, NOW), false)
    assert.equal(shouldExpireInventoryHold('expired', PAST, NOW), false)
  })
})

describe('inventoryHoldBlocksStay', () => {
  it('does not block when hold is active but expired (post-transition read path)', () => {
    const hold = { check_in: '2026-05-01', check_out: '2026-05-03', expires_at: PAST, status: 'active' }
    assert.equal(inventoryHoldBlocksStay(hold, '2026-05-02', '2026-05-04', NOW), false)
  })

  it('does not block when hold was transitioned to expired', () => {
    const hold = { check_in: '2026-05-01', check_out: '2026-05-03', expires_at: PAST, status: 'expired' }
    assert.equal(inventoryHoldBlocksStay(hold, '2026-05-02', '2026-05-04', NOW), false)
  })

  it('blocks overlapping active unexpired holds', () => {
    const hold = { check_in: '2026-05-01', check_out: '2026-05-05', expires_at: FUTURE, status: 'active' }
    assert.equal(inventoryHoldBlocksStay(hold, '2026-05-03', '2026-05-07', NOW), true)
  })
})

describe('stayBookingBlocksStay', () => {
  it('blocks held and confirmed overlaps', () => {
    assert.equal(
      stayBookingBlocksStay({ check_in: '2026-05-01', check_out: '2026-05-04', booking_status: 'confirmed' }, '2026-05-03', '2026-05-06'),
      true,
    )
    assert.equal(
      stayBookingBlocksStay({ check_in: '2026-05-01', check_out: '2026-05-04', booking_status: 'held' }, '2026-05-03', '2026-05-06'),
      true,
    )
  })

  it('does not block when booking_status is expired', () => {
    assert.equal(
      stayBookingBlocksStay({ check_in: '2026-05-01', check_out: '2026-05-04', booking_status: 'expired' }, '2026-05-02', '2026-05-03'),
      false,
    )
  })

  it('allows back-to-back stays', () => {
    assert.equal(
      stayBookingBlocksStay({ check_in: '2026-05-01', check_out: '2026-05-03', booking_status: 'confirmed' }, '2026-05-03', '2026-05-05'),
      false,
    )
    assert.equal(dateRangesOverlap('2026-05-01', '2026-05-03', '2026-05-03', '2026-05-05'), false)
  })
})

describe('findStayAvailabilityConflict', () => {
  it('prefers hold conflicts before booking rows', () => {
    const conflict = findStayAvailabilityConflict(
      '2026-05-02',
      '2026-05-04',
      [{ check_in: '2026-05-01', check_out: '2026-05-05', expires_at: FUTURE, status: 'active' }],
      [{ check_in: '2026-05-01', check_out: '2026-05-05', booking_status: 'confirmed' }],
      NOW,
    )
    assert.ok(conflict && 'expires_at' in conflict)
  })

  it('detects confirmed stay when no active hold applies', () => {
    const conflict = findStayAvailabilityConflict(
      '2026-05-02',
      '2026-05-04',
      [{ check_in: '2026-05-01', check_out: '2026-05-05', expires_at: PAST, status: 'expired' }],
      [{ check_in: '2026-05-01', check_out: '2026-05-05', booking_status: 'confirmed' }],
      NOW,
    )
    assert.ok(conflict && 'booking_status' in conflict)
  })

  it('returns null when expired holds and no booking overlap', () => {
    const conflict = findStayAvailabilityConflict(
      '2026-05-10',
      '2026-05-12',
      [{ check_in: '2026-05-01', check_out: '2026-05-05', expires_at: PAST, status: 'active' }],
      [],
      NOW,
    )
    assert.equal(conflict, null)
  })
})
