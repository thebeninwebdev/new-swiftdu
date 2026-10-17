import assert from 'node:assert/strict'
import { test } from 'node:test'
import { areIndomieOrdersCompatible, getIndomieBatchWindow, isIndomieBatchingActive, splitIndomieBatchSizes } from './indomie-batching'

const at = (hour: number, minute: number) => new Date(Date.UTC(2026, 0, 1, hour - 1, minute)) // Lagos is UTC+1
test('Indomie batching uses Africa/Lagos boundaries', () => {
  assert.equal(isIndomieBatchingActive(at(17, 59)), false); assert.equal(isIndomieBatchingActive(at(18, 0)), true); assert.equal(isIndomieBatchingActive(at(20, 59)), true); assert.equal(isIndomieBatchingActive(at(21, 0)), false)
  assert.equal(getIndomieBatchWindow(at(18, 14))?.end.getTime(), at(18, 15).getTime()); assert.equal(getIndomieBatchWindow(at(18, 15))?.start.getTime(), at(18, 15).getTime())
})
test('batch sizes never exceed three and leave singles unbatched', () => { assert.deepEqual([2,3,4,5,6,7].map(splitIndomieBatchSizes), [[2],[3],[3,1],[3,2],[3,3],[3,3,1]]) })
test('compatibility preserves destination, gender and test mode', () => {
  const a = { taskType: 'indomie', status: 'pending', location: 'Amnesty Hostel B27', batchWindowStart: at(18,0), isTestOrder: false }
  assert.equal(areIndomieOrdersCompatible(a, { ...a, location: 'Amnesty Hostel A12' }), true)
  assert.equal(areIndomieOrdersCompatible(a, { ...a, location: 'Girls Hostel A12' }), false)
  assert.equal(areIndomieOrdersCompatible({ ...a, location: 'PLT' }, { ...a, location: 'Library' }), false)
  assert.equal(areIndomieOrdersCompatible(a, { ...a, isTestOrder: true }), false)
})
