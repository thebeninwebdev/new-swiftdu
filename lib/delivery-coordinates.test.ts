
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire, Module } from 'node:module'
import { NextRequest } from 'next/server'
import { Order } from '../models/order'
import { validateDeliveryRoom, getRoomDestination } from './delivery-policy'
import { captureDeliveryPosition, validateDeliveryCoordinates } from './delivery-coordinates'

test('hostels require rooms, other destinations do not, and normalization preserves room separators', () => {
  for (const location of ['Amnesty', 'Amnesty Hostel', 'Girls Hostel']) {
    assert.equal(getRoomDestination(location)?.requiresRoomNumber, true)
    assert.throws(() => validateDeliveryRoom(location, undefined), /room number/)
  }
  assert.equal(validateDeliveryRoom('Library', undefined), undefined)
  assert.equal(validateDeliveryRoom('Amnesty', ' a12 '), 'A12')
  assert.equal(validateDeliveryRoom('Amnesty', ' a  12/b '), 'A 12/B')
  assert.throws(() => validateDeliveryRoom('Amnesty', 12))
})

test('coordinates validate finite ranges, accuracy and freshness', () => {
  const point = { latitude: 5.1, longitude: 5.2, accuracy: 10, capturedAt: new Date().toISOString() }
  assert.equal(validateDeliveryCoordinates(point)?.latitude, 5.1)
  assert.equal(validateDeliveryCoordinates(undefined), undefined)
  for (const bad of [null, [], {}, { ...point, latitude: '5' }, { ...point, latitude: 91 }, { ...point, longitude: -181 }, { ...point, accuracy: -1 }, { ...point, accuracy: Infinity }, { ...point, capturedAt: '2000-01-01' }]) assert.throws(() => validateDeliveryCoordinates(bad))
})

test('single position request uses fresh high accuracy GPS and errors never fabricate coordinates', async () => {
  let calls = 0
  const geo = { getCurrentPosition(success: PositionCallback, _error?: PositionErrorCallback | null, options?: PositionOptions) {
    calls++
    assert.deepEqual(options, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
    success({ coords: { latitude: 5, longitude: 6, accuracy: 12 }, timestamp: Date.now() } as GeolocationPosition)
  } }
  assert.equal((await captureDeliveryPosition(geo)).latitude, 5)
  assert.equal(calls, 1)
  for (const code of [1, 2, 3]) await assert.rejects(captureDeliveryPosition({ getCurrentPosition(_success, error) { error?.({ code } as GeolocationPositionError) } }))
  await assert.rejects(captureDeliveryPosition(undefined))
})

test('old orders remain valid; new room metadata persists and GPS is excluded from JSON and default queries', async () => {
  const order = new Order({ userId: 'customer', taskType: 'restaurant', location: 'Amnesty', amount: 1, commission: 1, totalAmount: 2 })
  await order.validate()
  assert.equal(order.roomNumber, undefined)
  order.roomNumber = 'A12'
  order.deliveryCoordinates = { latitude: 5, longitude: 6, accuracy: 10, capturedAt: new Date() }
  assert.equal(order.toObject().deliveryCoordinates?.latitude, 5)
  assert.equal(order.toJSON().deliveryCoordinates, undefined)
  assert.equal(Order.schema.path('deliveryCoordinates').options.select, false)
  assert.equal(order.deliveryDestinationKey, 'amnesty')
})

test('order APIs enforce room requirements and completion ownership, validity, privacy and retries', async t => {
  const require = createRequire(import.meta.url)
  let user = { id: 'customer', role: 'admin', taskerId: '' }
  let saves = 0
  let current = new Order({ userId: 'customer', taskerId: 'tasker', taskType: 'restaurant', location: 'Amnesty', roomNumber: 'A12', amount: 1, commission: 1, totalAmount: 2, hasPaid: true, status: 'in_progress', isTestOrder: true })
  const stubs: Record<string, unknown> = {
    './db': { connectDB: async () => {} },
    './auth': { auth: { api: { getSession: async () => ({ user }) } } },
    '../models/order': { Order: { findById: async () => current } },
    './first-order-bonus': { saveNewOrderWithBonus: async () => { saves++ }, saveOrderLifecycle: async () => { saves++ }, clearZeroFeeSettlement: () => {}, OrderChangedError: class extends Error {} },
    './socket': { emitOrderUpdated: () => {} },
    './tasker-stats': { syncTaskerStats: async () => {} },
    './tasker-settlement': { syncTaskerSettlementStatus: async () => {} },
    './order-alerts': { notifyAdminsOfOrderEvent: async () => {} },
    './push-notifications': { sendPushNotification: async () => ({}), formatPushTaskType: () => 'food' },
    './service-fee-discount': { consumeServiceFeeDiscountForCompletedOrder: async () => {}, getUserLookupConditions: () => [], hasActiveServiceFeeDiscountReservation: async () => false },
  }
  for (const [path, exports] of Object.entries(stubs)) {
    const id = require.resolve(path), previous = require.cache[id], stub = new Module(id)
    stub.exports = exports; stub.loaded = true; require.cache[id] = stub
    t.after(() => { if(previous) require.cache[id] = previous; else delete require.cache[id] })
  }
  const { POST } = require('../app/api/orders/route')
  const { PATCH } = require('../app/api/orders/[id]/route')
  const request = (body: unknown, method = 'PATCH') => new NextRequest('http://localhost/api/orders/order', { method, body: JSON.stringify(body) })
  for (const location of ['Amnesty', 'Girls Hostel']) assert.equal((await POST(request({ taskType: 'restaurant', location }, 'POST'))).status, 400)
  const point = { latitude: 5.1, longitude: 5.2, accuracy: 15, capturedAt: new Date().toISOString() }
  const patch = (body: unknown) => PATCH(request(body), { params: Promise.resolve({ id: 'order' }) })
  assert.equal((await patch({ status: 'completed', deliveryCoordinates: point })).status, 403)
  user = { id: 'worker', role: 'tasker', taskerId: 'tasker' }
  assert.equal((await patch({ status: 'completed', deliveryCoordinates: { ...point, latitude: 100 } })).status, 400)
  assert.equal(saves, 0)
  const completed = await patch({ status: 'completed', deliveryCoordinates: point })
  assert.equal(completed.status, 200)
  assert.equal(current.deliveryCoordinates?.latitude, 5.1)
  assert.equal((await completed.json()).deliveryCoordinates, undefined)
  assert.equal((await patch({ status: 'completed', deliveryCoordinates: { ...point, latitude: 4 } })).status, 200)
  assert.equal(current.deliveryCoordinates?.latitude, 5.1)
  assert.equal(saves, 1)
  current = new Order({ userId: 'customer', taskerId: 'tasker', taskType: 'restaurant', location: 'Library', amount: 1, commission: 1, totalAmount: 2, hasPaid: true, status: 'in_progress', isTestOrder: true })
  assert.equal((await patch({ status: 'completed' })).status, 200)
  assert.equal(current.deliveryCoordinates, undefined)
})

