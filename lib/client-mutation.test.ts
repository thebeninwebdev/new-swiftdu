import assert from 'node:assert/strict'
import test from 'node:test'
import { ClientMutationCoordinator, mergeUniqueById } from './client-mutation'

test('deduplicates an in-flight mutation and permits a later retry', () => {
  const mutations = new ClientMutationCoordinator()
  const first = mutations.begin('accept:order-1')
  assert.ok(first)
  assert.equal(mutations.begin('accept:order-1'), null)
  mutations.finish(first)
  assert.ok(mutations.begin('accept:order-1'))
})

test('invalidated responses cannot reconcile over newer authoritative state', () => {
  const mutations = new ClientMutationCoordinator()
  const request = mutations.begin('availability')
  assert.ok(request)
  mutations.invalidate('availability')
  assert.equal(mutations.isCurrent(request), false)
})

test('a replacement request makes an out-of-order response stale', () => {
  const mutations = new ClientMutationCoordinator()
  const slow = mutations.begin('orders:completed')
  const latest = mutations.begin('orders:completed', { replace: true })
  assert.ok(slow)
  assert.ok(latest)
  assert.equal(mutations.isCurrent(slow), false)
  assert.equal(mutations.isCurrent(latest), true)
  mutations.finish(slow)
  assert.equal(mutations.isPending('orders:completed'), true)
  mutations.finish(latest)
  assert.equal(mutations.isPending('orders:completed'), false)
})
test('merges paginated or realtime lists without duplicate cards', () => {
  const merged = mergeUniqueById(
    [{ _id: 'one', value: 1 }, { _id: 'two', value: 1 }],
    [{ _id: 'two', value: 2 }, { _id: 'three', value: 3 }],
  )
  assert.deepEqual(merged, [
    { _id: 'one', value: 1 },
    { _id: 'two', value: 2 },
    { _id: 'three', value: 3 },
  ])
})
