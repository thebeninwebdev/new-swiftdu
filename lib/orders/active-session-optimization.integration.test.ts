import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { Order } from '../../models/order'
import { User } from '../../models/user'
import { AcademicSession } from '../../models/academic-session'
import { FirstOrderBonusClaim } from '../../models/first-order-bonus-claim'
import {
  applyCurrentSessionOrderScope,
  buildCurrentSessionOrderFilter,
  getActiveAcademicSession,
  NoActiveOrderSessionError,
} from './order-session-scope'
import {
  CUSTOMER_ACTIVE_ORDER_FIELDS,
  CUSTOMER_ORDER_CARD_FIELDS,
  ORDER_NOTIFICATION_SUMMARY_FIELDS,
  TASKER_AVAILABLE_ORDER_FIELDS,
  TASKER_HISTORY_FIELDS,
} from './order-list-fields'
import { calculateOrderPricing } from '../pricing'
import { saveNewOrderWithBonus } from '../first-order-bonus'
import { resolveFinancePeriod, buildCreatedAtPeriodMatch } from '../finance-periods'
import { excludeCancelledOrders, excludeTestOrders } from '../order-finance'

let database: MongoMemoryReplSet
let activeSessionId: string
let previousSessionId: string

const ACTIVE_START = new Date('2026-10-25T23:00:00.000Z')
const ACTIVE_END = new Date('2027-06-17T22:59:59.999Z')
const PREVIOUS_START = new Date('2025-10-25T23:00:00.000Z')
const PREVIOUS_END = new Date('2026-06-17T22:59:59.999Z')

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  await mongoose.connect(database.getUri(), { dbName: 'session-optimization-tests' })
  await Promise.all([
    Order.init(),
    User.init(),
    AcademicSession.init(),
    FirstOrderBonusClaim.init(),
  ])
})

after(async () => {
  await mongoose.disconnect()
  await database?.stop()
})

beforeEach(async () => {
  await Promise.all([
    Order.deleteMany({}),
    User.deleteMany({}),
    AcademicSession.deleteMany({}),
    FirstOrderBonusClaim.deleteMany({}),
  ])

  const prevSession = await AcademicSession.create({
    name: '2025/2026',
    startDate: PREVIOUS_START,
    endDate: PREVIOUS_END,
    isActive: false,
  })
  previousSessionId = prevSession._id.toString()

  const currentSession = await AcademicSession.create({
    name: '2026/2027',
    startDate: ACTIVE_START,
    endDate: ACTIVE_END,
    isActive: true,
  })
  activeSessionId = currentSession._id.toString()
})

test('active session lookup returns current active session', async () => {
  const session = await getActiveAcademicSession()
  assert.equal(session.id, activeSessionId)
  assert.equal(session.name, '2026/2027')
})

test('throws NoActiveOrderSessionError when no active session configured', async () => {
  await AcademicSession.updateMany({}, { isActive: false })
  await assert.rejects(
    () => getActiveAcademicSession(),
    (err: unknown) => err instanceof NoActiveOrderSessionError && err.code === 'NO_ACTIVE_SESSION' && err.status === 409
  )
})

test('current-session orders appear in operational customer views while previous-session orders are excluded', async () => {
  const currentSession = await getActiveAcademicSession()
  const customer = await User.create({ email: 'student1@example.invalid', role: 'user' })
  const customerId = String(customer._id)

  // 1. Order in current session with sessionId
  const currentOrder = await Order.create({
    userId: customerId,
    sessionId: new Types.ObjectId(activeSessionId),
    sessionName: '2026/2027',
    taskType: 'restaurant',
    amount: 1500,
    commission: 150,
    serviceFee: 150,
    platformFee: 150,
    taskerFee: 150,
    totalAmount: 1800,
    location: 'Female Hostel Block A',
    status: 'pending',
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
  })

  // 2. Order in previous session with old sessionId
  await Order.create({
    userId: customerId,
    sessionId: new Types.ObjectId(previousSessionId),
    sessionName: '2025/2026',
    taskType: 'restaurant',
    amount: 1200,
    commission: 120,
    serviceFee: 120,
    platformFee: 120,
    taskerFee: 120,
    totalAmount: 1440,
    location: 'Female Hostel Block A',
    status: 'completed',
    createdAt: new Date('2026-02-01T10:00:00.000Z'),
  })

  // 3. Operational query with applyCurrentSessionOrderScope
  const operationalFilter = applyCurrentSessionOrderScope({ userId: customerId }, currentSession)
  const results = await Order.find(operationalFilter).lean()

  assert.equal(results.length, 1)
  assert.equal(results[0]._id.toString(), currentOrder._id.toString())
  assert.equal(results[0].sessionName, '2026/2027')
})

test('legacy orders without sessionId within current session date range remain visible in operational views', async () => {
  const currentSession = await getActiveAcademicSession()
  const customer = await User.create({ email: 'student2@example.invalid', role: 'user' })
  const customerId = String(customer._id)

  // Legacy order without sessionId but created within the active session dates
  const legacyInWindow = await Order.create({
    userId: customerId,
    taskType: 'shopping',
    amount: 2000,
    commission: 200,
    serviceFee: 200,
    platformFee: 200,
    taskerFee: 200,
    totalAmount: 2400,
    location: 'Library',
    status: 'completed',
    createdAt: new Date('2026-10-30T14:00:00.000Z'),
  })

  // Legacy order created before the active session dates
  await Order.create({
    userId: customerId,
    taskType: 'shopping',
    amount: 2000,
    commission: 200,
    serviceFee: 200,
    platformFee: 200,
    taskerFee: 200,
    totalAmount: 2400,
    location: 'Library',
    status: 'completed',
    createdAt: new Date('2026-05-15T14:00:00.000Z'),
  })

  const operationalFilter = applyCurrentSessionOrderScope({ userId: customerId }, currentSession)
  const results = await Order.find(operationalFilter).lean()

  assert.equal(results.length, 1)
  assert.equal(results[0]._id.toString(), legacyInWindow._id.toString())
})

test('historical reports remain accurate when requesting all-time or specific historical periods', async () => {
  const customer = await User.create({ email: 'student3@example.invalid', role: 'user' })
  const customerId = String(customer._id)

  // Create an order in previous session
  await Order.create({
    userId: customerId,
    sessionId: new Types.ObjectId(previousSessionId),
    sessionName: '2025/2026',
    taskType: 'restaurant',
    amount: 3000,
    commission: 300,
    serviceFee: 300,
    platformFee: 300,
    taskerFee: 300,
    totalAmount: 3600,
    location: 'Staff Quarters',
    status: 'completed',
    createdAt: new Date('2026-01-10T12:00:00.000Z'),
  })

  // Create an order in current session
  await Order.create({
    userId: customerId,
    sessionId: new Types.ObjectId(activeSessionId),
    sessionName: '2026/2027',
    taskType: 'restaurant',
    amount: 5000,
    commission: 500,
    serviceFee: 500,
    platformFee: 500,
    taskerFee: 500,
    totalAmount: 6000,
    location: 'Staff Quarters',
    status: 'completed',
    createdAt: new Date('2026-11-05T12:00:00.000Z'),
  })

  // 1. All-time finance report includes all orders
  const allTimePeriod = await resolveFinancePeriod({ allTime: true })
  assert.equal(allTimePeriod.mode, 'all-time')
  const allTimeMatch = excludeCancelledOrders(buildCreatedAtPeriodMatch(allTimePeriod))
  const allTimeCount = await Order.countDocuments(allTimeMatch)
  assert.equal(allTimeCount, 2)

  // 2. Specific historical session finance report includes only that session
  const prevPeriod = await resolveFinancePeriod({ sessionId: previousSessionId })
  assert.equal(prevPeriod.sessionId, previousSessionId)
  const prevMatch = excludeCancelledOrders(buildCreatedAtPeriodMatch(prevPeriod))
  const prevCount = await Order.countDocuments(prevMatch)
  assert.equal(prevCount, 1)
})

test('idempotency key prevents duplicate order creation under retries or race conditions', async () => {
  const customer = await User.create({ email: 'student4@example.invalid', role: 'user' })
  const customerId = String(customer._id)
  const idempotencyKey = 'retry-key-test-001'

  const pricing = calculateOrderPricing({ taskType: 'restaurant', amount: 2500 })
  const orderA = new Order({
    userId: customerId,
    taskType: 'restaurant',
    amount: pricing.amount,
    commission: pricing.serviceFee,
    serviceFee: pricing.serviceFee,
    totalAmount: pricing.totalAmount,
    location: 'Senate Building',
    status: 'pending',
    idempotencyKey,
  })

  const orderB = new Order({
    userId: customerId,
    taskType: 'restaurant',
    amount: pricing.amount,
    commission: pricing.serviceFee,
    serviceFee: pricing.serviceFee,
    totalAmount: pricing.totalAmount,
    location: 'Senate Building',
    status: 'pending',
    idempotencyKey,
  })

  // First save succeeds
  const savedA = await saveNewOrderWithBonus(orderA, pricing)
  // Second save with same idempotencyKey returns original order
  const savedB = await saveNewOrderWithBonus(orderB, pricing)

  assert.equal(savedA._id.toString(), savedB._id.toString())
  assert.equal(await Order.countDocuments({ userId: customerId, idempotencyKey }), 1)
})

test('training orders and live orders remain strictly isolated', async () => {
  const currentSession = await getActiveAcademicSession()
  const customer = await User.create({ email: 'student5@example.invalid', role: 'user' })
  const customerId = String(customer._id)

  // Live order
  await Order.create({
    userId: customerId,
    sessionId: new Types.ObjectId(activeSessionId),
    taskType: 'water',
    amount: 800,
    commission: 100,
    serviceFee: 100,
    platformFee: 100,
    taskerFee: 100,
    totalAmount: 1000,
    location: 'Hostel B',
    status: 'pending',
    isTestOrder: false,
    createdInMode: 'live',
  })

  // Training order
  await Order.create({
    userId: customerId,
    sessionId: new Types.ObjectId(activeSessionId),
    taskType: 'water',
    amount: 800,
    commission: 100,
    serviceFee: 100,
    platformFee: 100,
    taskerFee: 100,
    totalAmount: 1000,
    location: 'Hostel B',
    status: 'pending',
    isTestOrder: true,
    createdInMode: 'test',
  })

  // Live query excludes test orders
  const liveFilter = applyCurrentSessionOrderScope(
    excludeTestOrders({ userId: customerId, status: 'pending' }),
    currentSession
  )
  const liveResults = await Order.find(liveFilter).lean()
  assert.equal(liveResults.length, 1)
  assert.equal(liveResults[0].isTestOrder, false)

  // Training query specifically requests training orders
  const trainingFilter = applyCurrentSessionOrderScope(
    { userId: customerId, isTestOrder: true, status: 'pending' },
    currentSession
  )
  const trainingResults = await Order.find(trainingFilter).lean()
  assert.equal(trainingResults.length, 1)
  assert.equal(trainingResults[0].isTestOrder, true)
})

test('field projections ensure lightweight API responses without document bloat', async () => {
  const customer = await User.create({ email: 'student6@example.invalid', role: 'user' })
  const customerId = String(customer._id)

  const created = await Order.create({
    userId: customerId,
    sessionId: new Types.ObjectId(activeSessionId),
    taskType: 'restaurant',
    description: 'Jollof rice and chicken',
    amount: 3000,
    commission: 300,
    serviceFee: 300,
    platformFee: 300,
    taskerFee: 300,
    totalAmount: 3600,
    location: 'Cafeteria 1',
    roomNumber: 'Room 101',
    store: 'Buka Delight',
    status: 'pending',
    isDeclinedTask: false,
    hasPaid: false,
    deliveryCoordinates: { latitude: 6.5244, longitude: 3.3792, capturedAt: new Date() },
  })

  // Customer active order projected fields
  const activeDoc = await Order.findById(created._id).select(CUSTOMER_ACTIVE_ORDER_FIELDS).lean()
  assert.ok(activeDoc)
  assert.equal(activeDoc.taskType, 'restaurant')
  assert.equal(activeDoc.location, 'Cafeteria 1')
  // Coordinates are private and excluded
  assert.equal((activeDoc as { deliveryCoordinates?: unknown }).deliveryCoordinates, undefined)

  // Notification summary fields
  const notificationDoc = await Order.findById(created._id).select(ORDER_NOTIFICATION_SUMMARY_FIELDS).lean()
  assert.ok(notificationDoc)
  assert.equal(notificationDoc.status, 'pending')
  assert.equal((notificationDoc as { description?: unknown }).description, undefined)
  assert.equal((notificationDoc as { totalAmount?: unknown }).totalAmount, undefined)
})
