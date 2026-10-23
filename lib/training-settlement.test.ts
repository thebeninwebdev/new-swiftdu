import assert from 'node:assert/strict'
import test from 'node:test'

import { completeTrainingSettlement } from './training-settlement'

function order(overrides: Record<string, unknown> = {}) {
  return {
    isTestOrder: true,
    status: 'completed',
    platformFee: 150,
    taskerHasPaid: false,
    settlementStatus: 'pending',
    ...overrides,
  } as never
}

test('a completed test order is settled internally with no provider or reference', () => {
  const paidAt = new Date('2026-10-23T10:00:00.000Z')
  const settled = completeTrainingSettlement(order(), paidAt)
  assert.equal(settled.taskerHasPaid, true)
  assert.equal(settled.settlementStatus, 'paid')
  assert.equal(settled.settlementSimulation, true)
  assert.equal(settled.settlementSimulationAt, paidAt)
  assert.equal(settled.settlementProvider, undefined)
  assert.equal(settled.settlementReference, undefined)
})

test('a live order cannot use the training simulation', () => {
  assert.throws(() => completeTrainingSettlement(order({ isTestOrder: false })), /only available for test orders/)
})

test('training settlement still requires task completion', () => {
  assert.throws(() => completeTrainingSettlement(order({ status: 'in_progress' })), /after the task is completed/)
})
