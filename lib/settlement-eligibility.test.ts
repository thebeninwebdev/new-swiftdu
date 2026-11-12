import assert from 'node:assert/strict'
import test from 'node:test'

import { hasVerifiedSettlement, isOutstandingSettlement } from './settlement-eligibility'

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
