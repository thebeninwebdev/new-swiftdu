import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import Module from 'node:module'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

test('authorized Telegram staff can create an order for an unverified provisional customer', { timeout: 120_000 }, async (t) => {
  const database = await MongoMemoryServer.create()
  process.env.MONGODB_URI = database.getUri('staff-order')
  process.env.SAMMY_SWIFTDU_INTERNAL_SECRET = 'staff-order-test-secret'
  process.env.OPERATIONS_ENABLED = 'true'

  let closeDatabaseClient: (() => Promise<void>) | undefined
  let restoreTransaction: (() => void) | undefined
  t.after(async () => {
    delete process.env.OPERATIONS_ENABLED
    delete process.env.SAMMY_SWIFTDU_INTERNAL_SECRET
    restoreTransaction?.()
    await mongoose.disconnect()
    await closeDatabaseClient?.()
    await database.stop()
  })

  type ModuleLoader = (request: string, parent: unknown, isMain: boolean) => unknown
  const moduleInternals = Module as unknown as { _load: ModuleLoader }
  const originalLoad = moduleInternals._load
  moduleInternals._load = (request, parent, isMain) => {
    if (request === 'server-only') return {}
    if (request.endsWith('tasker-push-subscriptions')) {
      return { toWebPushSubscription: (subscription: unknown) => subscription }
    }
    return originalLoad(request, parent, isMain)
  }
  t.after(() => { moduleInternals._load = originalLoad })

  await mongoose.connect(process.env.MONGODB_URI)
  const originalTransaction = mongoose.connection.transaction
  type TransactionRunner = typeof mongoose.connection.transaction
  mongoose.connection.transaction = (async (callback: Parameters<TransactionRunner>[0]) =>
    callback(undefined as never)) as TransactionRunner
  restoreTransaction = () => { mongoose.connection.transaction = originalTransaction }

  const { User } = await import('@/models/user')
  const { Order } = await import('@/models/order')
  const { AcademicSession } = await import('@/models/academic-session')
  const { OperationsSettings } = await import('@/models/operations-settings')
  const { default: CampusLocation } = await import('@/models/campus-location')
  const { Vendor } = await import('@/models/vendor')
  const { VendorDeliveryRule } = await import('@/models/vendor-delivery-rule')
  const { POST } = await import('@/app/api/internal/sammy/staff/orders/route')
  const { default: clientPromise } = await import('@/lib/db')
  closeDatabaseClient = async () => { await (await clientPromise).close() }

  const now = new Date()
  await AcademicSession.create({
    name: '2026/2027',
    startDate: new Date(now.getTime() - 86_400_000),
    endDate: new Date(now.getTime() + 86_400_000),
    semesters: [],
    isActive: true,
  })
  await OperationsSettings.create({ key: 'default', openMinute: 0, closeMinute: 1440 })

  const staff = await User.create({
    name: 'Authorized Staff',
    email: 'staff-order@example.com',
    emailVerified: true,
    role: 'admin',
    telegramUserId: '12345',
    telegramEnabled: true,
  })
  const hostel = await CampusLocation.create({
    name: 'Unity Hostel',
    normalizedName: 'unity hostel',
    type: 'hostel',
    active: true,
    coordinates: { latitude: 6.1, longitude: 7.2, capturedAt: now },
    deliveryPolicy: { enabled: true, requiresRoomNumber: true },
    createdBy: String(staff._id),
  })
  const customer = await User.create({
    name: 'Ada Nwosu',
    email: 'ada.provisional@example.com',
    emailVerified: false,
    role: 'user',
    phone: '2348012345678',
    phones: [{ number: '2348012345678', normalizedNumber: '2348012345678', type: 'primary', verified: false }],
    customerSource: 'staff_telegram',
    createdByStaffId: String(staff._id),
    defaultLocation: hostel.name,
    defaultLocationId: String(hostel._id),
    defaultRoomNumber: 'B12',
  })

  assert.equal(customer.emailVerified, false)
  assert.equal(customer.password, undefined)
  assert.equal(customer.phones?.[0]?.verified, false)

  const request = new NextRequest('https://swiftdu.test/api/internal/sammy/staff/orders', {
    method: 'POST',
    headers: {
      authorization: 'Bearer staff-order-test-secret',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      telegram: { id: '12345', firstName: 'Authorized' },
      customerId: String(customer._id),
      idempotencyKey: 'staff-order-provisional-0001',
      contactMethod: 'whatsapp',
      order: {
        taskType: 'water',
        description: 'Deliver one bag',
        location: hostel.name,
        parentLocationId: String(hostel._id),
        roomNumber: 'B12',
        waterBags: 1,
      },
    }),
  })

  const response = await POST(request)
  assert.equal(response.status, 201, await response.text())

  const order = await Order.findOne({
    userId: String(customer._id),
    idempotencyKey: 'staff-order-provisional-0001',
  }).lean()
  assert.ok(order)
  assert.equal(order.source, 'telegram_staff')
  assert.equal(order.customerName, 'Ada Nwosu')
  assert.equal(order.createdByStaffId, String(staff._id))
  assert.equal(order.createdByStaffTelegramId, '12345')

  const stillProvisional = await User.findById(customer._id).lean()
  assert.equal(stillProvisional?.emailVerified, false)
  assert.equal(stillProvisional?.phones?.[0]?.verified, false)
  assert.equal(stillProvisional?.password, undefined)

  // The same confirmation key must be a read-after-timeout recovery, not a
  // second order. This mimics a caller retrying after persistence completed.
  const retry = await POST(new NextRequest('https://swiftdu.test/api/internal/sammy/staff/orders', {
    method: 'POST', headers: { authorization: 'Bearer staff-order-test-secret', 'content-type': 'application/json' },
    body: JSON.stringify({
      telegram: { id: '12345', firstName: 'Authorized' }, customerId: String(customer._id),
      idempotencyKey: 'staff-order-provisional-0001', contactMethod: 'whatsapp',
      order: { taskType: 'water', description: 'Deliver one bag', location: hostel.name, parentLocationId: String(hostel._id), roomNumber: 'B12', waterBags: 1 },
    }),
  }))
  assert.equal(retry.status, 200, await retry.text())
  assert.equal(await Order.countDocuments({ userId: String(customer._id), idempotencyKey: 'staff-order-provisional-0001' }), 1)

  const pickup = await CampusLocation.create({
    name: 'Campus Cafe', normalizedName: 'campus cafe', type: 'cafeteria', active: true,
    coordinates: { latitude: 6.11, longitude: 7.21, capturedAt: now }, createdBy: String(staff._id),
  })
  const cafe = await Vendor.create({
    name: 'Campus Cafe', normalizedName: 'campus-cafe-vendor', serviceType: 'restaurant',
    active: true, pickupParentLocationId: pickup._id, createdBy: String(staff._id),
  })
  await VendorDeliveryRule.create({ vendorId: cafe._id, dropoffParentLocationId: hostel._id, serviceFee: 650, enabled: true })
  const inquiry = await POST(new NextRequest('https://swiftdu.test/api/internal/sammy/staff/orders', {
    method: 'POST', headers: { authorization: 'Bearer staff-order-test-secret', 'content-type': 'application/json' },
    body: JSON.stringify({
      telegram: { id: '12345', firstName: 'Authorized' }, customerId: String(customer._id),
      idempotencyKey: 'staff-cafe-inquiry-0001', contactMethod: 'whatsapp',
      order: {
        taskType: 'restaurant', cafeInquiry: true, store: cafe.name, vendorId: String(cafe._id),
        location: hostel.name, parentLocationId: String(hostel._id), roomNumber: 'B12', restaurantPeopleCount: 2,
      },
    }),
  }))
  assert.equal(inquiry.status, 201, await inquiry.text())
  const inquiryOrder = await Order.findOne({ userId: String(customer._id), idempotencyKey: 'staff-cafe-inquiry-0001' }).lean()
  assert.ok(inquiryOrder)
  assert.equal(inquiryOrder.cafeInquiry, true)
  assert.equal(inquiryOrder.amount, 0)
  assert.equal(inquiryOrder.restaurantPeopleCount, 2)
})