import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveConfiguredServiceFee } from './pricing-config'

test('parent overrides win over the task default', () => {
  const parentId = '507f1f77bcf86cd799439011'
  const result = resolveConfiguredServiceFee('restaurant', parentId, [
    { taskType: 'restaurant', parentLocationId: null, serviceFee: 600 },
    { taskType: 'restaurant', parentLocationId: parentId, serviceFee: 800 },
  ])
  assert.deepEqual(result, { taskType: 'restaurant', parentLocationId: parentId, serviceFee: 800, source: 'parent_override' })
})

test('resolver falls back to stored defaults, then launch defaults', () => {
  assert.equal(resolveConfiguredServiceFee('printing', '507f1f77bcf86cd799439011', [{ taskType: 'printing', parentLocationId: null, serviceFee: 950 }]).serviceFee, 950)
  const fallback = resolveConfiguredServiceFee('indomie', '507f1f77bcf86cd799439011', [])
  assert.equal(fallback.serviceFee, 600)
  assert.equal(fallback.source, 'launch_default')
})

test('an exact location is never a pricing identity', () => {
  const parentId = '507f1f77bcf86cd799439011'
  assert.equal(resolveConfiguredServiceFee('restaurant', parentId, [
    { taskType: 'restaurant', parentLocationId: null, serviceFee: 600 },
    { taskType: 'restaurant', parentLocationId: parentId, serviceFee: 700 },
  ]).serviceFee, 700)
})
