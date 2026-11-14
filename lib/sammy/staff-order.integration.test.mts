import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'

test('authorized Telegram staff can create an order for an unverified provisional customer', { timeout: 120_000 }, async (t) => {
  const database = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  process.env.MONGODB_URI = database.getUri('staff-order')
  process.env.SAMMY_SWIFTDU_INTERNAL_SECRET = 'staff-order-test-secret'
  process.env.OPERATIONS_ENABLED = 'true'
  process.env.SWIFTDU_BASE_URL = 'https://swiftdu.test'
  const serviceCleanup: { close?: () => Promise<void> } = {}
  t.after(async () => {
    await serviceCleanup.close?.()
    await mongoose.disconnect()
    await database.stop()
    delete process.env.OPERATIONS_ENABLED
    delete process.env.SAMMY_SWIFTDU_INTERNAL_SECRET
    delete process.env.SWIFTDU_BASE_URL
    delete process.env.MONGODB_URI
  })

  const { User } = await import('@/models/user')
  const { Order } = await import('@/models/order')
  const { AcademicSession } = await import('@/models/academic-session')
  const { OperationsSettings } = await import('@/models/operations-settings')
  const { default: CampusLocation } = await import('@/models/campus-location')
  const { Vendor } = await import('@/models/vendor')
  const { VendorDeliveryRule } = await import('@/models/vendor-delivery-rule')
  const { FirstOrderBonusClaim } = await import('@/models/first-order-bonus-claim')
  const { startOrderApiServer } = await import('../../services/order-api/server.mts')
  const service = await startOrderApiServer(0)
  serviceCleanup.close = () => service.close()
  const address = service.server.address() as AddressInfo
  const endpoint = `http://127.0.0.1:${address.port}/api/internal/sammy/staff/orders`
  const sendOrder = (body: unknown, secret = 'staff-order-test-secret') => fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  await Promise.all([
    User.init(), Order.init(), AcademicSession.init(), OperationsSettings.init(),
    CampusLocation.init(), Vendor.init(), VendorDeliveryRule.init(), FirstOrderBonusClaim.init(),
  ])

  const health = await fetch(`http://127.0.0.1:${address.port}/health`)
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { status: 'ok' })

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
    isExco: true,
    excoRole: 'CFO',
    testOrderMode: true,
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

  const orderBody = {
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
  }

  const invalidCredentials = await sendOrder(orderBody, 'wrong-secret')
  assert.equal(invalidCredentials.status, 401)
  assert.equal((await invalidCredentials.json()).code, 'UNAUTHORIZED')

  const unlinkedStaff = await sendOrder({ ...orderBody, telegram: { id: '987654321' } })
  assert.equal(unlinkedStaff.status, 403)
  assert.equal((await unlinkedStaff.json()).code, 'TELEGRAM_NOT_LINKED')

  await User.create({ email: 'not-staff@example.com', role: 'user', telegramUserId: '54321', telegramEnabled: true })
  const unauthorizedStaff = await sendOrder({ ...orderBody, telegram: { id: '54321' } })
  assert.equal(unauthorizedStaff.status, 403)
  assert.equal((await unauthorizedStaff.json()).code, 'STAFF_INSUFFICIENT_PRIVILEGES')

  const response = await sendOrder(orderBody)
  const createdResponse = await response.json() as { _id: string; totalAmount: number; trackingUrl: string }
  assert.equal(response.status, 201, JSON.stringify(createdResponse))
  assert.ok(createdResponse._id)
  assert.ok(createdResponse.trackingUrl.startsWith('https://swiftdu.test/'))

  const order = await Order.findOne({
    userId: String(customer._id),
    idempotencyKey: 'staff-order-provisional-0001',
  }).lean()
  assert.ok(order)
  assert.equal(order.source, 'telegram_staff')
  assert.equal(order.firstOrderBonusApplied, false)
  assert.equal(order.totalAmount, createdResponse.totalAmount)
  assert.equal(order.customerName, 'Ada Nwosu')
  assert.equal(order.createdByStaffId, String(staff._id))
  assert.equal(order.createdByStaffTelegramId, '12345')

  const stillProvisional = await User.findById(customer._id).lean()
  assert.equal(stillProvisional?.emailVerified, false)
  assert.equal(stillProvisional?.phones?.[0]?.verified, false)
  assert.equal(stillProvisional?.password, undefined)

  // The same confirmation key must be a read-after-timeout recovery, not a
  // second order. This mimics a caller retrying after persistence completed.
  const retry = await sendOrder(orderBody)
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
  const inquiry = await sendOrder({
      telegram: { id: '12345', firstName: 'Authorized' }, customerId: String(customer._id),
      idempotencyKey: 'staff-cafe-inquiry-0001', contactMethod: 'whatsapp',
      order: {
        taskType: 'restaurant', cafeInquiry: true, store: cafe.name, vendorId: String(cafe._id),
        location: hostel.name, parentLocationId: String(hostel._id), roomNumber: 'B12', restaurantPeopleCount: 2,
      },
  })
  assert.equal(inquiry.status, 201, await inquiry.text())
  const inquiryOrder = await Order.findOne({ userId: String(customer._id), idempotencyKey: 'staff-cafe-inquiry-0001' }).lean()
  assert.ok(inquiryOrder)
  assert.equal(inquiryOrder.cafeInquiry, true)
  assert.equal(inquiryOrder.amount, 0)
  assert.equal(inquiryOrder.restaurantPeopleCount, 2)
  assert.equal(inquiryOrder.serviceFee, 900)
  assert.equal(inquiryOrder.totalAmount, 900)
  assert.equal(inquiryOrder.firstOrderBonusApplied, false)
  assert.equal(inquiryOrder.paymentStatus, 'unpaid')
  assert.equal(inquiryOrder.paymentProvider, 'manual_transfer')
  assert.equal(inquiryOrder.source, 'telegram_staff')

  // Validation tests
  const missingCustomer = await sendOrder({ ...orderBody, customerId: '' })
  assert.equal(missingCustomer.status, 400)
  assert.equal((await missingCustomer.json()).code, 'INVALID_DRAFT')

  const shortKey = await sendOrder({ ...orderBody, idempotencyKey: 'short' })
  assert.equal(shortKey.status, 400)
  assert.equal((await shortKey.json()).code, 'INVALID_IDEMPOTENCY_KEY')

  const forgedPricing = await sendOrder({
    ...orderBody,
    idempotencyKey: 'staff-order-forged-0001',
    order: { ...orderBody.order, serviceFee: 10, totalAmount: 10 },
  })
  assert.equal(forgedPricing.status, 400)
  assert.equal((await forgedPricing.json()).code, 'SERVER_OWNED_FIELD')

  // Concurrent confirmations with same idempotency key
  const concurrentKey = 'staff-order-concurrent-0001'
  const concurrentBody = {
    ...orderBody,
    idempotencyKey: concurrentKey,
  }
  const [res1, res2] = await Promise.all([
    sendOrder(concurrentBody),
    sendOrder(concurrentBody),
  ])
  assert.ok([200, 201].includes(res1.status))
  assert.ok([200, 201].includes(res2.status))
  assert.equal(
    await Order.countDocuments({ userId: String(customer._id), idempotencyKey: concurrentKey }),
    1,
  )

  // Verify website / Vercel order creation parity
  await User.findByIdAndUpdate(customer._id, { gender: 'female' })
  const { createOrderResponse } = await import('@/lib/orders/order-route-service')
  const { NextRequest } = await import('next/server')
  const vercelReq = new NextRequest('https://swiftdu.test/api/orders', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': 'vercel-order-0001',
    },
    body: JSON.stringify({
      taskType: 'water',
      description: 'Deliver one bag via website',
      location: hostel.name,
      parentLocationId: String(hostel._id),
      roomNumber: 'B12',
      waterBags: 1,
    }),
  })
  const vercelRes = await createOrderResponse(vercelReq, {
    principal: {
      id: String(customer._id),
      name: customer.name,
      email: customer.email,
      role: customer.role,
    },
    source: 'website',
  })
  assert.equal(vercelRes.status, 201)
  const vercelOrder = await Order.findOne({ userId: String(customer._id), idempotencyKey: 'vercel-order-0001' }).lean()
  assert.ok(vercelOrder)
  assert.equal(vercelOrder.source, 'website')
})
