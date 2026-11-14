import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { Order } from '../models/order'
import { User } from '../models/user'
import { WhatsAppRegistration } from '../models/whatsapp-registration'
import { AcademicSession } from '../models/academic-session'
import { FirstOrderBonusClaim } from '../models/first-order-bonus-claim'
import { calculateOrderPricing } from './pricing'
import { priceWithOrderDiscounts } from './first-order-pricing'
import {
  firstOrderBonusEligibility,
  NoActiveAcademicSessionError,
  OrderChangedError,
  saveNewOrderWithBonus,
  saveOrderLifecycle,
} from './first-order-bonus'

let database: MongoMemoryReplSet
before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  await mongoose.connect(database.getUri(), { dbName: 'first-order-bonus-tests' })
  await Promise.all([Order.init(), User.init(), WhatsAppRegistration.init(), AcademicSession.init(), FirstOrderBonusClaim.init()])
})
after(async () => { await mongoose.disconnect(); await database?.stop() })
beforeEach(async () => {
  await Promise.all([Order.deleteMany({}), User.deleteMany({}), WhatsAppRegistration.deleteMany({}), AcademicSession.deleteMany({}), FirstOrderBonusClaim.deleteMany({})])
  await AcademicSession.create({ name: '2026/2027', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isActive: true })
})

const pricing = calculateOrderPricing({ taskType: 'restaurant', amount: 2000, serviceFee: 600, restaurantPeopleCount: 3 })
async function customer() { return User.create({ email: `test-${crypto.randomUUID()}@example.invalid` }) }
function draft(userId: string, isTestOrder = false, idempotencyKey?: string) {
  return new Order({
    userId, taskType: 'restaurant', amount: pricing.amount, commission: pricing.serviceFee,
    serviceFee: pricing.serviceFee, totalAmount: pricing.totalAmount, location: 'Library',
    status: 'pending', isTestOrder, idempotencyKey,
  })
}

test('automatic first-order promotion is disabled for every new live order', async () => {
  const user = await customer()
  const orders = [draft(String(user._id)), draft(String(user._id)), draft(String(user._id))]

  for (const order of orders) await saveNewOrderWithBonus(order, pricing)

  assert.deepEqual(orders.map(order => order.firstOrderBonusApplied), [false, false, false])
  for (const order of orders) {
    assert.equal(order.serviceFee, 1000)
    assert.equal(order.platformFee, 166)
    assert.equal(order.taskerFee, 834)
    assert.equal(order.totalAmount, 3000)
    assert.equal(order.sessionName, '2026/2027')
  }
  assert.equal(await FirstOrderBonusClaim.countDocuments({ userId: String(user._id) }), 0)
})

test('eligibility reports the promotion disabled without creating a claim', async () => {
  const user = await customer()
  const eligibility = await firstOrderBonusEligibility(String(user._id))
  assert.equal(eligibility.enabled, false)
  assert.equal(eligibility.eligible, false)
  assert.equal(eligibility.sessionName, '2026/2027')
  assert.equal(await FirstOrderBonusClaim.countDocuments(), 0)
})

test('duplicate submissions with one idempotency key return the committed order', async () => {
  const user = await customer()
  const key = 'sammy-confirmation-12345'
  const first = draft(String(user._id), false, key)
  const retry = draft(String(user._id), false, key)

  await Promise.all([saveNewOrderWithBonus(first, pricing), saveNewOrderWithBonus(retry, pricing)])

  assert.equal(first._id.toString(), retry._id.toString())
  assert.equal(await Order.countDocuments({ userId: String(user._id), idempotencyKey: key }), 1)
  assert.equal(await FirstOrderBonusClaim.countDocuments(), 0)
})

test('simultaneous new orders never reserve or receive an automatic bonus', async () => {
  const user = await customer()
  const orders = Array.from({ length: 6 }, () => draft(String(user._id)))

  await Promise.all(orders.map(order => saveNewOrderWithBonus(order, pricing)))

  assert.equal(await Order.countDocuments({ userId: String(user._id) }), 6)
  assert.equal(await Order.countDocuments({ firstOrderBonusApplied: true }), 0)
  assert.equal(await FirstOrderBonusClaim.countDocuments({ userId: String(user._id) }), 0)
  assert.ok(orders.every(order => order.serviceFee === 1000 && order.platformFee === 166 && order.taskerFee === 834))
})

test('transient transaction errors retry and still commit one normally priced order', async () => {
  const user = await customer()
  const order = draft(String(user._id))
  const originalSave = Order.prototype.save
  let saveAttempts = 0
  Order.prototype.save = (async function (this: InstanceType<typeof Order>, ...args: Parameters<typeof originalSave>) {
    saveAttempts++
    if (saveAttempts === 1) throw Object.assign(new Error('transient write conflict'), { code: 112 })
    return originalSave.apply(this, args)
  }) as typeof Order.prototype.save

  try {
    await saveNewOrderWithBonus(order, pricing)
  } finally {
    Order.prototype.save = originalSave
  }

  assert.equal(saveAttempts, 2)
  assert.equal(await Order.countDocuments({ _id: order._id }), 1)
  assert.equal(order.serviceFee, 1000)
  assert.equal(order.firstOrderBonusApplied, false)
  assert.equal(await FirstOrderBonusClaim.countDocuments(), 0)
})

test('an uncertain commit is resolved from the committed order without duplication', async () => {
  const user = await customer()
  const order = draft(String(user._id))
  const originalStartSession = mongoose.connection.startSession
  let commitAttempts = 0
  mongoose.connection.startSession = (async (...args: Parameters<typeof mongoose.connection.startSession>) => {
    const session = await originalStartSession.apply(mongoose.connection, args)
    const commit = session.commitTransaction.bind(session)
    session.commitTransaction = (async () => {
      const result = await commit()
      commitAttempts++
      if (commitAttempts === 1) {
        throw Object.assign(new Error('commit reply was lost'), {
          hasErrorLabel: (label: string) => label === 'UnknownTransactionCommitResult',
        })
      }
      return result
    }) as typeof session.commitTransaction
    return session
  }) as typeof mongoose.connection.startSession

  try {
    await saveNewOrderWithBonus(order, pricing)
  } finally {
    mongoose.connection.startSession = originalStartSession
  }

  assert.equal(commitAttempts, 1)
  assert.equal(await Order.countDocuments({ _id: order._id }), 1)
  assert.equal(order.firstOrderBonusApplied, false)
  assert.equal(await FirstOrderBonusClaim.countDocuments(), 0)
})

test('manual service-fee discounts remain separate from the discontinued promotion', async () => {
  const user = await customer()
  const order = draft(String(user._id))
  order.serviceFeeDiscountApplied = true
  await saveNewOrderWithBonus(order, pricing)

  assert.equal(order.firstOrderBonusApplied, false)
  assert.equal(order.serviceFee, 0)
  assert.equal(order.platformFee, 0)
  assert.equal(order.taskerFee, 0)
  assert.equal(order.totalAmount, pricing.amount)
  assert.equal(await FirstOrderBonusClaim.countDocuments(), 0)
})

test('cafe inquiry pricing retains its tasker-only inquiry fee', async () => {
  const user = await customer()
  const cafePricing = calculateOrderPricing({ taskType: 'restaurant', amount: 0, serviceFee: 600, cafeInquiry: true })
  const order = new Order({
    userId: String(user._id), taskType: 'restaurant', cafeInquiry: true, amount: cafePricing.amount,
    commission: cafePricing.serviceFee, serviceFee: cafePricing.serviceFee,
    totalAmount: cafePricing.totalAmount, location: 'Library', status: 'pending',
  })

  await saveNewOrderWithBonus(order, cafePricing)

  assert.equal(order.serviceFee, 650)
  assert.equal(order.taskerFee, 550)
  assert.equal(order.platformFee, 100)
  assert.equal(order.firstOrderBonusApplied, false)
  assert.equal(order.totalAmount, 650)
})

test('test orders use configured pricing and never create bonus claims', async () => {
  const user = await customer()
  const training = draft(String(user._id), true)
  await saveNewOrderWithBonus(training, pricing)
  assert.equal(training.serviceFee, 1000)
  assert.equal(training.platformFee, 166)
  assert.equal(training.taskerFee, 834)
  assert.equal(training.firstOrderBonusApplied, false)
  assert.equal(await FirstOrderBonusClaim.countDocuments(), 0)
})

test('a live order still fails safely when there is no active academic session', async () => {
  const user = await customer()
  await AcademicSession.updateMany({}, { $set: { isActive: false } })
  await assert.rejects(saveNewOrderWithBonus(draft(String(user._id)), pricing), NoActiveAcademicSessionError)
})

test('historical bonus orders still consume their existing claim on completion', async () => {
  const user = await customer()
  const activeSession = await AcademicSession.findOne({ isActive: true }).orFail()
  const legacyFees = priceWithOrderDiscounts(pricing, { firstOrderBonus: true })
  const order = await Order.create({
    userId: String(user._id), sessionId: activeSession._id, sessionName: activeSession.name,
    firstOrderBonusSessionId: activeSession._id, ...legacyFees,
    amount: pricing.amount, taskType: 'restaurant', location: 'Library', status: 'pending',
  })
  await FirstOrderBonusClaim.create({
    userId: String(user._id), sessionId: activeSession._id, orderId: String(order._id), claimedAt: new Date(),
  })

  const left = await Order.findById(order._id).orFail()
  const right = await Order.findById(order._id).orFail()
  for (const [index, snapshot] of [left, right].entries()) {
    snapshot.status = 'completed'
    snapshot.completedAt = new Date(1_800_000_000_000 + index * 1000)
    snapshot.hasPaid = true
    snapshot.paymentStatus = 'paid'
  }
  const results = await Promise.allSettled([saveOrderLifecycle(left), saveOrderLifecycle(right)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  const saved = await Order.findById(order._id).orFail()
  assert.equal(saved.firstOrderBonusApplied, true)
  assert.ok(saved.firstOrderBonusConsumedAt)
  assert.ok(await FirstOrderBonusClaim.findOne({ orderId: String(order._id), consumedAt: { $exists: true } }))
  await assert.rejects(saveOrderLifecycle(saved), OrderChangedError)
})
