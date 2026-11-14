import assert from 'node:assert/strict'
import test from 'node:test'

import { hasVerifiedSettlement, isAutomaticSettlementOverdue, isOutstandingSettlement } from './settlement-eligibility'
import { clearNonPayableSettlement } from './settlement-state'

test('completion speed never changes outstanding settlement eligibility', () => {
  for (const completedBeforeTimer of [true, false]) {
    assert.equal(isOutstandingSettlement({
      status: 'completed',
      platformFee: 150,
      platformFeeWaivedForFastCompletion: false,
      taskerHasPaid: false,
      settlementStatus: 'pending',
      ...({ completedBeforeTimer } as object),
    }), true)
  }
})

test('paid, historical waiver, zero-fee and incomplete orders are not outstanding', () => {
  const base = { status: 'completed', platformFee: 150, settlementStatus: 'pending' }
  assert.equal(isOutstandingSettlement({ ...base, taskerHasPaid: true }), false)
  assert.equal(isOutstandingSettlement({ ...base, settlementStatus: 'paid' }), false)
  assert.equal(isOutstandingSettlement({ ...base, settlementPaidAt: new Date() }), false)
  assert.equal(isOutstandingSettlement({ ...base, platformFeeWaivedForFastCompletion: true }), false)
  assert.equal(isOutstandingSettlement({ ...base, platformFee: 0 }), false)
  assert.equal(isOutstandingSettlement({ ...base, status: 'in_progress' }), false)
  assert.equal(hasVerifiedSettlement({ settlementStatus: 'initialized' }), false)
})

test('automatic overdue policy requires a live completed payable past-due order', () => {
  const overdue = { status: 'completed', platformFee: 150, settlementDueAt: new Date('2026-01-01T00:00:00Z') }
  const now = new Date('2026-01-02T00:00:00Z')
  assert.equal(isAutomaticSettlementOverdue(overdue, now), true)
  assert.equal(isAutomaticSettlementOverdue({ ...overdue, isTestOrder: true }, now), false)
  assert.equal(isAutomaticSettlementOverdue({ ...overdue, status: 'cancelled' }, now), false)
  assert.equal(isAutomaticSettlementOverdue({ ...overdue, platformFee: 0 }, now), false)
  assert.equal(isAutomaticSettlementOverdue({ ...overdue, platformFeeWaivedForFastCompletion: true }, now), false)
  assert.equal(isAutomaticSettlementOverdue({ ...overdue, taskerHasPaid: true }, now), false)
  assert.equal(isAutomaticSettlementOverdue({ ...overdue, settlementDueAt: new Date('2026-01-03T00:00:00Z') }, now), false)
})

test('non-payable cleanup clears unpaid checkout state and preserves verified payment history', () => {
  const unpaid = {
    platformFee: 0,
    settlementStatus: 'overdue',
    settlementDueAt: new Date(),
    settlementReference: 'obsolete',
    settlementCheckoutUrl: 'https://checkout.invalid',
    settlementFailureReason: 'failed',
  }
  assert.equal(clearNonPayableSettlement(unpaid), true)
  assert.equal(unpaid.settlementStatus, 'not_due')
  assert.equal(unpaid.settlementDueAt, undefined)
  assert.equal(unpaid.settlementReference, undefined)

  const paid = {
    platformFee: 0,
    settlementStatus: 'paid',
    settlementPaidAt: new Date(),
    settlementReference: 'successful-reference',
  }
  assert.equal(clearNonPayableSettlement(paid), false)
  assert.equal(paid.settlementStatus, 'paid')
  assert.equal(paid.settlementReference, 'successful-reference')
})
