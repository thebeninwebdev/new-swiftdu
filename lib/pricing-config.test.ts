import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveConfiguredServiceFee } from './pricing-config'

test('location overrides win over the default pricing rule', () => {
  const result = resolveConfiguredServiceFee('restaurant', 'girls-hostel', [
    { taskType: 'restaurant', locationId: 'default', serviceFee: 600 },
    { taskType: 'restaurant', locationId: 'girls-hostel', serviceFee: 800 },
  ])
  assert.deepEqual(result, { taskType: 'restaurant', locationId: 'girls-hostel', serviceFee: 800, source: 'location_override' })
})

test('resolver falls back to stored defaults, then launch defaults', () => {
  assert.equal(resolveConfiguredServiceFee('printing', 'plt', [{ taskType: 'printing', locationId: 'default', serviceFee: 950 }]).serviceFee, 950)
  const fallback = resolveConfiguredServiceFee('indomie', 'library', [])
  assert.equal(fallback.serviceFee, 600)
  assert.equal(fallback.source, 'launch_default')
})
