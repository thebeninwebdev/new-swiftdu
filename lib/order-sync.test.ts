import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeOrderUpdate } from './order-sync'
import { getTrackingStage, needsOrderPayment } from './order-tracking'
import { toOrderSocketPayload, type OrderSocketPayload } from './socket'
import { getTaskerOrderModeFilter, shouldSendOrderNotification } from './test-orders'
import type { CafeInquiryStatus } from './cafe-inquiry'

const order = {
  _id: 'order', userId: 'customer', status: 'pending', updatedAt: '2026-09-18T10:00:00.000Z',
  cafeInquiry: true, cafeInquiryStatus: 'waiting_for_tasker' as CafeInquiryStatus, cafeOptionsVersion: 0,
}

test('a late fetch cannot revert tasker acceptance or arrival; duplicate and older socket patches are harmless', async () => {
  let release!: (value: OrderSocketPayload) => void
  const pendingFetch = new Promise<OrderSocketPayload>(resolve => { release = resolve })
  let current = mergeOrderUpdate<OrderSocketPayload>(order, { ...order, status: 'in_progress', taskerId: 'tasker', updatedAt: '2026-09-18T10:01:00Z', cafeInquiryStatus: 'tasker_assigned' })
  const accepted = current
  current = mergeOrderUpdate<OrderSocketPayload>(current, { ...current, updatedAt: '2026-09-18T10:02:00Z', cafeOptionsVersion: 1, cafeInquiryStatus: 'checking_cafe' })
  release(order)
  current = mergeOrderUpdate<OrderSocketPayload>(current, await pendingFetch)
  assert.equal(current.cafeInquiryStatus, 'checking_cafe')
  current = mergeOrderUpdate<OrderSocketPayload>(current, accepted)
  assert.equal(current.cafeInquiryStatus, 'checking_cafe')
  assert.deepEqual(mergeOrderUpdate<OrderSocketPayload>(current, current), current)
  assert.equal(getTrackingStage(current).detail, 'Your Tasker is at the cafe.')
})

test('stale HTTP snapshots cannot visually regress accepted or cancelled orders', () => {
  for (const isTestOrder of [false, true]) {
    const pending = { _id: 'normal-order', status: 'pending', taskerId: undefined as string | undefined, isTestOrder, updatedAt: '2026-09-18T10:00:00.000Z' }
    const accepted = mergeOrderUpdate(pending, { ...pending, status: 'in_progress', taskerId: 'tasker-1', updatedAt: '2026-09-18T10:01:00.000Z' })
    assert.equal(mergeOrderUpdate(accepted, pending), accepted)
    const cancelled = mergeOrderUpdate(accepted, { ...accepted, status: 'cancelled', updatedAt: '2026-09-18T10:02:00.000Z' })
    assert.equal(mergeOrderUpdate(cancelled, accepted), cancelled)
  }
})

test('same timestamp cafe revisions are ordered; full snapshots hydrate omitted fields', () => {
  const current = { ...order, cafeOptionsVersion: 2, cafeInquiryStatus: 'awaiting_customer_choice' as const }
  assert.equal(mergeOrderUpdate<OrderSocketPayload>(current, order), current)
  const hydrated = mergeOrderUpdate<OrderSocketPayload>(current, { ...current, description: 'Lunch' })
  assert.equal(hydrated.description, 'Lunch')
  assert.equal(mergeOrderUpdate<OrderSocketPayload>(order, current).cafeOptionsVersion, 2)
  assert.equal(mergeOrderUpdate<OrderSocketPayload>(order, { ...order, updatedAt: undefined }), order)
})

test('nothing suitable can be rechecked, and cancellation cannot be undone by stale availability', () => {
  const unavailable = { ...order, status: 'in_progress', cafeInquiryStatus: 'unavailable' as const, cafeOptionsVersion: 2, updatedAt: '2026-09-18T10:02:00Z' }
  const rechecked = mergeOrderUpdate<OrderSocketPayload>(unavailable, { ...unavailable, cafeInquiryStatus: 'checking_cafe', cafeOptionsVersion: 3, updatedAt: '2026-09-18T10:03:00Z' })
  assert.equal(rechecked.cafeInquiryStatus, 'checking_cafe')
  const cancelled = mergeOrderUpdate<OrderSocketPayload>(rechecked, { ...rechecked, status: 'cancelled', updatedAt: '2026-09-18T10:04:00Z' })
  assert.equal(mergeOrderUpdate<OrderSocketPayload>(cancelled, unavailable), cancelled)
  assert.equal(getTrackingStage(cancelled).label, 'Cancelled')
  assert.equal(needsOrderPayment(cancelled), false)
})

test('both restaurant flows retain newer completion and payment state for test and live orders', () => {
  for (const isTestOrder of [false, true]) for (const cafeInquiry of [false, true]) {
    const pending = { ...order, isTestOrder, cafeInquiry, cafeInquiryStatus: cafeInquiry ? order.cafeInquiryStatus : undefined }
    const complete = { ...pending, status: 'completed', hasPaid: true, updatedAt: '2026-09-18T10:05:00Z' }
    assert.equal(mergeOrderUpdate<OrderSocketPayload>(complete, pending), complete)
    assert.equal(needsOrderPayment(complete), false)
  }
  assert.deepEqual(getTaskerOrderModeFilter({ taskerMode: 'training' }), { isTestOrder: true })
  assert.notDeepEqual(getTaskerOrderModeFilter({ taskerMode: 'live' }), { isTestOrder: true })
  assert.equal(shouldSendOrderNotification({ isTestOrder: true }), false)
})

test('socket snapshots carry the persisted database timestamp', () => {
  assert.equal(toOrderSocketPayload({ ...order, updatedAt: new Date(order.updatedAt) }).updatedAt, order.updatedAt)
})
