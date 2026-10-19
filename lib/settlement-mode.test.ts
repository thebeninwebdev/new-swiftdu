import assert from 'node:assert/strict'
import test from 'node:test'
import { isDevelopmentSettlementSimulation } from './settlement-mode'

test('only development permits a simulated live-order settlement', () => {
  assert.equal(isDevelopmentSettlementSimulation('development'), true)
  assert.equal(isDevelopmentSettlementSimulation('production'), false)
  assert.equal(isDevelopmentSettlementSimulation('test'), false)
  assert.equal(isDevelopmentSettlementSimulation(undefined), false)
})
