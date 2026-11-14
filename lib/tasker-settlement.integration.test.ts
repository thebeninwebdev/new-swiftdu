import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Order } from '@/models/order'
import Tasker from '@/models/tasker'
import { normalizeNonPayableSettlementOrders, syncTaskerSettlementStatus } from './tasker-settlement'
import { verifyAndMarkOrderSettlementPaid } from './settlement-payment'

let database: MongoMemoryServer

before(async () => {
  database = await MongoMemoryServer.create()
  await mongoose.connect(database.getUri(), { dbName: 'tasker-settlement-tests' })
  await Promise.all([Order.init(), Tasker.init()])
})
after(async () => { await mongoose.disconnect(); await database?.stop() })
beforeEach(async () => { await Promise.all([Order.deleteMany({}), Tasker.deleteMany({})]) })

async function tasker(overrides: Record<string, unknown> = {}) {
  return Tasker.create({
    phone: '08000000000', location: 'Campus', studentId: crypto.randomUUID(), isVerified: true, ...overrides,
  })
}

async function completedOrder(taskerId: string, overrides: Record<string, unknown> = {}) {
  return Order.create({
    userId: 'customer', taskType: 'restaurant', description: 'Settlement regression order',
    amount: 1000, commission: 600, serviceFee: 600, totalAmount: 1600, location: 'Library',
    status: 'completed', completedAt: new Date('2026-01-01T00:00:00Z'), taskerId,
    platformFee: 100, settlementStatus: 'pending', settlementDueAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  })
}

test('zero, waived, test, paid, future, and cancelled orders never create live suspension', async () => {
  const owner = await tasker({ isSettlementSuspended: true })
  const taskerId = String(owner._id)
  await Promise.all([
    completedOrder(taskerId, { platformFee: 0, settlementStatus: 'overdue', settlementReference: 'obsolete' }),
    completedOrder(taskerId, { platformFeeWaivedForFastCompletion: true, settlementStatus: 'overdue' }),
    completedOrder(taskerId, { isTestOrder: true, settlementStatus: 'overdue' }),
    completedOrder(taskerId, { taskerHasPaid: true, settlementStatus: 'paid', settlementPaidAt: new Date(), settlementReference: 'paid-ref' }),
    completedOrder(taskerId, { settlementDueAt: new Date('2099-01-01T00:00:00Z') }),
    completedOrder(taskerId, { status: 'cancelled', settlementStatus: 'overdue' }),
  ])

  const result = await syncTaskerSettlementStatus(taskerId)
  assert.equal(result.isSettlementSuspended, false)
  const zero = await Order.findOne({ taskerId, platformFee: 0 }).lean()
  assert.equal(zero?.settlementStatus, 'not_due')
  assert.equal(zero?.settlementDueAt, undefined)
  assert.equal(zero?.settlementReference, undefined)
  const paid = await Order.findOne({ taskerId, settlementReference: 'paid-ref' }).lean()
  assert.equal(paid?.settlementStatus, 'paid')
  assert.ok(paid?.settlementPaidAt)
})

test('an unpaid live order suspends only after its deadline and clearing it reinstates', async () => {
  const owner = await tasker()
  const taskerId = String(owner._id)
  const order = await completedOrder(taskerId)
  const overdue = await syncTaskerSettlementStatus(taskerId)
  assert.equal(overdue.overdueCount, 1)
  assert.equal(overdue.isAutomaticSettlementSuspended, true)
  assert.equal(overdue.isSettlementSuspended, true)

  order.taskerHasPaid = true
  order.settlementStatus = 'paid'
  order.settlementPaidAt = new Date()
  await order.save()
  const cleared = await syncTaskerSettlementStatus(taskerId)
  assert.equal(cleared.overdueCount, 0)
  assert.equal(cleared.isSettlementSuspended, false)
})

test('administrative suspension survives reconciliation with no overdue balance', async () => {
  const owner = await tasker({
    isSettlementSuspended: true, isSettlementAdminSuspended: true, settlementAdminSuspendedAt: new Date(),
  })
  const result = await syncTaskerSettlementStatus(String(owner._id))
  assert.equal(result.isAutomaticSettlementSuspended, false)
  assert.equal(result.isSettlementAdminSuspended, true)
  assert.equal(result.isSettlementSuspended, true)
})

test('reconciliation is idempotent under repeats and concurrent requests', async () => {
  const owner = await tasker({ isSettlementSuspended: true })
  const taskerId = String(owner._id)
  await completedOrder(taskerId, { platformFee: 0, settlementStatus: 'overdue', settlementDueAt: new Date() })
  const results = await Promise.all(Array.from({ length: 5 }, () => syncTaskerSettlementStatus(taskerId)))
  assert.ok(results.every(result => result.isSettlementSuspended === false))
  assert.equal((await normalizeNonPayableSettlementOrders(taskerId)).modifiedCount, 0)
  assert.equal((await Tasker.findById(taskerId).lean())?.isSettlementSuspended, false)
})

test('verified settlement webhook retries are idempotent and preserve payment history', async () => {
  const owner = await tasker()
  const paidAt = new Date('2026-01-03T00:00:00Z')
  const order = await completedOrder(String(owner._id), {
    taskerHasPaid: true,
    settlementStatus: 'paid',
    settlementPaidAt: paidAt,
    settlementReference: 'verified-paystack-reference',
    settlementTransactionId: 'verified-transaction',
  })

  const [first, retry] = await Promise.all([
    verifyAndMarkOrderSettlementPaid({ order, reference: 'verified-paystack-reference' }),
    verifyAndMarkOrderSettlementPaid({ order, reference: 'verified-paystack-reference' }),
  ])
  assert.equal(first.settlementStatus, 'paid')
  assert.equal(retry.settlementStatus, 'paid')
  const persisted = await Order.findById(order._id).lean()
  assert.equal(persisted?.settlementReference, 'verified-paystack-reference')
  assert.equal(persisted?.settlementTransactionId, 'verified-transaction')
  assert.equal(persisted?.settlementPaidAt?.toISOString(), paidAt.toISOString())
})
