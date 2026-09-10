import assert from 'node:assert/strict'
import { test } from 'node:test'
import { areOperationsEnabled, canCreateOrder } from './operations'
import { shouldCreateTestOrder } from './test-orders'

test('operations configuration preserves existing test authorization', (t) => {
  const original = process.env.OPERATIONS_ENABLED
  t.after(() => {
    if (original === undefined) delete process.env.OPERATIONS_ENABLED
    else process.env.OPERATIONS_ENABLED = original
  })
  const normal = shouldCreateTestOrder({ testOrderMode: false })
  const authorized = shouldCreateTestOrder({ isExco: true, testOrderMode: true })
  const forgedMode = shouldCreateTestOrder({ testOrderMode: true })
  const excoLive = shouldCreateTestOrder({ excoRole: 'CTO', testOrderMode: false })
  for (const value of [undefined, '', 'false', 'TRUE', '1', ' true ']) {
    if (value === undefined) delete process.env.OPERATIONS_ENABLED
    else process.env.OPERATIONS_ENABLED = value
    assert.equal(areOperationsEnabled(), false)
    assert.equal(canCreateOrder(normal), false)
    assert.equal(canCreateOrder(authorized), true)
    assert.equal(canCreateOrder(forgedMode), false)
    assert.equal(canCreateOrder(excoLive), false)
    assert.equal(canCreateOrder(shouldCreateTestOrder(undefined)), false)
  }
  process.env.OPERATIONS_ENABLED = 'true'
  assert.equal(areOperationsEnabled(), true)
  assert.equal(canCreateOrder(normal), true)
  assert.equal(canCreateOrder(authorized), true)
  assert.equal(shouldCreateTestOrder({ testOrderMode: true }), false)
})
