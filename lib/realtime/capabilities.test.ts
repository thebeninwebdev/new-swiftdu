import assert from 'node:assert/strict'
import test from 'node:test'
import { getRealtimeCapabilities } from './capabilities'
import { getOrderRealtimePublications } from '../socket'

test('customer receives only a subscribe-only private user channel', () => {
  assert.deepEqual(getRealtimeCapabilities({ userId: 'customer-a' }), {
    'user:customer-a': ['subscribe'],
  })
})

test('order events target customer, assigned tasker, and the correct discovery channel', () => {
  assert.deepEqual(getOrderRealtimePublications({ userId: 'customer-a', taskerId: 'tasker-a', isTestOrder: true }), [
    { channel: 'user:customer-a', event: 'order:updated' },
    { channel: 'tasker:tasker-a', event: 'order:updated' },
    { channel: 'tasks:training', event: 'tasks:updated' },
  ])
})

test('tasker receives only their private and server-selected discovery channels', () => {
  assert.deepEqual(getRealtimeCapabilities({ userId: 'tasker-user', taskerId: 'tasker-a', taskerMode: 'training' }), {
    'user:tasker-user': ['subscribe'],
    'tasker:tasker-a': ['subscribe'],
    'tasks:training': ['subscribe'],
  })
})
