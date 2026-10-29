import assert from 'node:assert/strict'
import test from 'node:test'

import { validateOrderAgainstCommercePolicy } from './commerce-policy'

test('allows ordinary campus requests', () => {
  for (const description of ['Jollof rice and chicken', '2 bottles of Coke', 'A4 paper and pen', 'Indomie and egg', 'Print 20 pages']) {
    assert.equal(validateOrderAgainstCommercePolicy({ taskType: 'shopping', description }).allowed, true)
  }
})

test('rejects regulated and restricted requests', () => {
  for (const description of ['Buy me cigarettes', 'Get me a vape', 'Buy two bottles of whisky', 'Get prescription tramadol', 'Buy ammunition']) {
    const result = validateOrderAgainstCommercePolicy({ taskType: 'shopping', description })
    assert.equal(result.allowed, false)
    assert.ok(result.category)
  }
})
