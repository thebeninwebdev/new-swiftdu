import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { Order } from '../models/order'
import { User } from '../models/user'
import { WhatsAppRegistration } from '../models/whatsapp-registration'
import { calculateOrderPricing } from './pricing'
import { clearZeroFeeSettlement, firstOrderBonusAvailable, OrderChangedError, releaseCancelledBonus, saveNewOrderWithBonus, saveOrderLifecycle } from './first-order-bonus'
import { verifyAndMarkOrderSettlementPaid } from './settlement-payment'
import { getOutstandingSettlementOrders, syncTaskerSettlementStatus } from './tasker-settlement'

let database: MongoMemoryReplSet
before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  await mongoose.connect(database.getUri(), { dbName: 'first-order-bonus-tests' })
  await Promise.all([Order.init(), User.init(), WhatsAppRegistration.init()])
})
after(async () => { await mongoose.disconnect(); await database?.stop() })
beforeEach(async () => { await Promise.all([Order.deleteMany({}), User.deleteMany({}), WhatsAppRegistration.deleteMany({})]) })
const pricing = calculateOrderPricing({ taskType: 'restaurant', amount: 2000 })
async function customer() { return User.create({ email: 'test@example.invalid' }) }
function draft(userId: string, isTestOrder = false) {
  return new Order({ userId, taskType: 'restaurant', amount: pricing.amount, commission: pricing.serviceFee,
    serviceFee: pricing.serviceFee, totalAmount: pricing.totalAmount, location: 'Library', status: 'pending', isTestOrder })
}

test('simultaneous creations reserve exactly one bonus; transaction failure rolls back the claim', async () => {
  const user = await customer()
  const bad = draft(String(user._id)); bad.location = ''
  await assert.rejects(saveNewOrderWithBonus(bad, pricing))
  assert.equal(await firstOrderBonusAvailable(String(user._id)), true)
  const orders = Array.from({ length: 6 }, () => draft(String(user._id)))
  await Promise.all(orders.map(order => saveNewOrderWithBonus(order, pricing)))
  assert.equal(await Order.countDocuments({ firstOrderBonusApplied: true }), 1)
  const reserved = await User.findById(user._id)
  assert.equal(orders.find(order => order.firstOrderBonusApplied)!._id.toString(), reserved.firstOrderBonusOrderId)
  assert.equal(await firstOrderBonusAvailable(String(user._id)), false)
})

test('legacy completed live history excludes customers, while training history does not', async () => {
  const user = await customer()
  const training = draft(String(user._id), true); training.status = 'completed'; await training.save()
  assert.equal(await firstOrderBonusAvailable(String(user._id)), true)
  const live = draft(String(user._id)); live.status = 'completed'; await live.save()
  assert.equal(await firstOrderBonusAvailable(String(user._id)), false)
  const next = draft(String(user._id)); await saveNewOrderWithBonus(next, pricing)
  assert.equal(next.firstOrderBonusApplied, false)
})

test('completion consumes once and concurrent retries cannot overwrite its timestamp', async () => {
  const user = await customer(); const order = draft(String(user._id))
  await saveNewOrderWithBonus(order, pricing)
  const left = await Order.findById(order._id).orFail(); const right = await Order.findById(order._id).orFail()
  for (const [index, snapshot] of [left, right].entries()) {
    snapshot.status = 'completed'; snapshot.completedAt = new Date(1_800_000_000_000 + index * 1000)
    snapshot.hasPaid = true; snapshot.paymentStatus = 'paid'; clearZeroFeeSettlement(snapshot)
  }
  const results = await Promise.allSettled([saveOrderLifecycle(left), saveOrderLifecycle(right)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  const winner = results[0].status === 'fulfilled' ? left : right
  const saved = await Order.findById(order._id).orFail()
  assert.equal(saved.completedAt!.getTime(), winner.completedAt!.getTime())
  assert.ok(saved.firstOrderBonusConsumedAt)
  assert.equal(saved.settlementStatus, 'not_due')
  assert.equal(saved.settlementReference, undefined)
  assert.equal(saved.settlementPaidAt, undefined)
  assert.ok((await User.findById(user._id)).firstOrderBonusConsumedAt)
  assert.equal(await firstOrderBonusAvailable(String(user._id)), false)
  await assert.rejects(saveOrderLifecycle(saved), OrderChangedError)
})

test('unpaid cancellation and expiry release only their own reservation; paid/failed transfers retain it', async () => {
  const user = await customer(); const first = draft(String(user._id)); await saveNewOrderWithBonus(first, pricing)
  first.status = 'cancelled'; first.paymentStatus = 'cancelled'; await saveOrderLifecycle(first)
  assert.equal(await firstOrderBonusAvailable(String(user._id)), true)
  const next = draft(String(user._id)); await saveNewOrderWithBonus(next, pricing)
  await releaseCancelledBonus(first)
  assert.equal((await User.findById(user._id)).firstOrderBonusOrderId, String(next._id))
  // Same atomic terminal update used by expiry, followed by exact-ID release.
  next.status = 'cancelled'; next.paymentStatus = 'cancelled'; await next.save(); await releaseCancelledBonus(next)
  assert.equal(await firstOrderBonusAvailable(String(user._id)), true)
  const paid = draft(String(user._id)); await saveNewOrderWithBonus(paid, pricing)
  paid.customerTransferredAt = new Date(); paid.paymentStatus = 'failed'; paid.status = 'cancelled'
  await saveOrderLifecycle(paid)
  assert.equal((await User.findById(user._id)).firstOrderBonusOrderId, String(paid._id))
})

test('test orders neither claim nor consume and verified WhatsApp history shares the website entitlement', async () => {
  const user = await customer(); const training = draft(String(user._id), true)
  await saveNewOrderWithBonus(training, pricing)
  training.status = 'completed'; training.completedAt = new Date(); await saveOrderLifecycle(training)
  assert.equal(training.firstOrderBonusApplied, false)
  assert.equal(await firstOrderBonusAvailable(String(user._id)), true)
  await WhatsAppRegistration.create({ userId: String(user._id), phone: '2348012345678', status: 'linked', token: 'test-token' })
  const legacy = draft('external-whatsapp-id'); legacy.source = 'whatsapp'; legacy.customerPhone = '+2348012345678'; legacy.status = 'completed'; await legacy.save()
  assert.equal(await firstOrderBonusAvailable(String(user._id)), false)
})

test('zero-fee settlement cannot charge, become overdue, or reappear after a receipt report', async () => {
  const user = await customer(); const order = draft(String(user._id)); await saveNewOrderWithBonus(order, pricing)
  order.status = 'completed'; order.taskerId = new mongoose.Types.ObjectId().toString(); order.completedAt = new Date()
  clearZeroFeeSettlement(order); await saveOrderLifecycle(order)
  await assert.rejects(verifyAndMarkOrderSettlementPaid({ order, reference: 'must-not-call-paystack' }), /No platform settlement/)
  order.customerReceiptConfirmed = false; order.prematureCompletionReported = true; order.platformFeeWaivedForFastCompletion = false
  order.settlementStatus = 'pending'; order.settlementDueAt = new Date(0); clearZeroFeeSettlement(order); await order.save()
  assert.equal(order.platformFee, 0)
  assert.equal((await syncTaskerSettlementStatus(order.taskerId)).overdueCount, 0)
  assert.equal((await getOutstandingSettlementOrders(order.taskerId)).length, 0)
  assert.equal(order.settlementStatus, 'not_due')
})
