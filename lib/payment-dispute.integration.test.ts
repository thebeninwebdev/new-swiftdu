import assert from 'node:assert/strict'
import { test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Order } from '../models/order'
import { resolvePaymentDispute } from './payment-dispute'
import { canTaskerCancelOrder, isCustomerPaymentConfirmed } from './order-status'
import { ensureCompletionTimer } from './completion-timer'
import { toOrderSocketPayload } from './socket'
import { getTrackingStage } from './order-tracking'
import { mergeOrderUpdate } from './order-sync'

test('dispute resolution is atomic, preserves history and assignment, and leaves newer work intact', { timeout: 120000 }, async () => {
  const database = await MongoMemoryServer.create()
  try {
    await mongoose.connect(database.getUri(), { dbName: 'payment-dispute-test' })
    const declinedAt = new Date('2026-09-01T12:00:00Z')
    const transferredAt = new Date('2026-09-01T11:55:00Z')
    const base = { userId: 'customer', taskerId: 'tasker', taskType: 'restaurant', location: 'Library', amount: 1000, commission: 200, totalAmount: 1200, status: 'in_progress' }
    const newer = await Order.create({ ...base, hasPaid: true, paymentStatus: 'paid' })
    const newerBefore = newer.toObject()
    for (const status of ['in_progress', 'paid'] as const) {
      const order = await Order.create({ ...base, status, isDeclinedTask: true, hasPaid: false, paymentStatus: 'failed', declinedAt, declinedByTaskerAt: declinedAt, declinedReason: 'transaction_not_found', declinedMessage: 'Missing transfer', customerTransferredAt: transferredAt })
      assert.equal(canTaskerCancelOrder(order), false)
      assert.equal(ensureCompletionTimer(order), false)
      assert.equal(await resolvePaymentDispute(order, 'other-tasker'), null)
      const results = await Promise.all([resolvePaymentDispute(order, 'tasker'), resolvePaymentDispute(order, 'tasker')])
      assert.equal(results.filter(Boolean).length, 1)
      const resolved = results.find(Boolean)!
      assert.equal(resolved.status, status)
      assert.equal(resolved.taskerId, 'tasker')
      assert.equal(resolved.isDeclinedTask, false)
      assert.equal(resolved.hasPaid, true)
      assert.equal(resolved.paymentStatus, 'paid')
      assert.equal(resolved.declinedAt?.toISOString(), declinedAt.toISOString())
      assert.equal(resolved.declinedByTaskerAt?.toISOString(), declinedAt.toISOString())
      assert.equal(resolved.declinedReason, 'transaction_not_found')
      assert.equal(resolved.declinedMessage, 'Missing transfer')
      assert.equal(resolved.customerTransferredAt?.toISOString(), transferredAt.toISOString())
      assert.equal(resolved.paymentDisputeResolution, 'tasker_confirmed_received')
      assert.equal(resolved.paidAt?.getTime(), resolved.paymentEventuallyReceivedAt?.getTime())
      assert.equal(resolved.paymentDisputeResolvedAt?.getTime(), resolved.paymentVerifiedAt?.getTime())
      assert.equal(resolved.completionDueAt!.getTime() - resolved.paymentEventuallyReceivedAt!.getTime(), 25 * 60_000)
      assert.equal(await resolvePaymentDispute(resolved, 'tasker'), null)
      const payload = toOrderSocketPayload(resolved)
      assert.equal(payload.paymentDisputeResolution, 'tasker_confirmed_received')
      assert.equal(getTrackingStage(payload).label, 'Payment confirmed')
      assert.match(getTrackingStage(payload).detail, /Tasker has confirmed/)
      const merged = mergeOrderUpdate(payload, toOrderSocketPayload(order))
      assert.equal(merged.isDeclinedTask, false)
      assert.equal(isCustomerPaymentConfirmed(merged), true)
    }
    for (const status of ['completed', 'cancelled'] as const) {
      const order = await Order.create({ ...base, status, isDeclinedTask: true })
      assert.equal(await resolvePaymentDispute(order, 'tasker'), null)
    }
    const stale = await Order.create({ ...base, isDeclinedTask: true })
    await Order.updateOne({ _id: stale._id }, { $set: { status: 'cancelled' } })
    assert.equal(await resolvePaymentDispute(stale, 'tasker'), null)
    assert.deepEqual((await Order.findById(newer._id))!.toObject(), newerBefore)
    assert.equal(await Order.countDocuments({ taskerId: 'tasker', status: { $in: ['in_progress', 'paid'] } }), 3)
  } finally { await mongoose.disconnect(); await database.stop() }
})
