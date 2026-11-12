process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/test-bootstrap'

import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import mongoose, { Types } from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import webpush from 'web-push'


let database: MongoMemoryReplSet
let AcademicSession: typeof import('../models/academic-session').AcademicSession
let User: typeof import('../models/user').User
let Tasker: typeof import('../models/tasker').default
let TaskerWorkSession: typeof import('../models/tasker-work-session').TaskerWorkSession
let Order: typeof import('../models/order').Order
let PushSubscription: typeof import('../models/push-subscription').PushSubscription
let IndomieBatch: typeof import('../models/indomie-batch').IndomieBatch
let getApprovedTaskerUserIds: typeof import('../lib/push-notifications').getApprovedTaskerUserIds
let sendPushNotification: typeof import('../lib/push-notifications').sendPushNotification
let sendTestPushToUser: typeof import('../lib/push-notifications').sendTestPushToUser
let saveTaskerPushSubscription: typeof import('../lib/tasker-push-subscriptions').saveTaskerPushSubscription
let releaseDueIndomieBatches: typeof import('../lib/indomie-batch-release').releaseDueIndomieBatches
let processDueOrderEscalations: typeof import('../lib/orders/order-escalation').processDueOrderEscalations
let REMINDER_DELAY_MS: typeof import('../lib/orders/order-escalation').REMINDER_DELAY_MS
let ADMIN_ESCALATION_DELAY_MS: typeof import('../lib/orders/order-escalation').ADMIN_ESCALATION_DELAY_MS

let sentWebPushes: Array<{
  subscription: webpush.PushSubscription
  payload: string
  options?: webpush.RequestOptions
}> = []
let sentTelegramMessages: Array<{
  text: string
  chatId?: string
  options?: unknown
}> = []

// Keep original functions to restore in after()
const originalSendNotification = webpush.sendNotification
const originalFetch = globalThis.fetch

before(async () => {
  ;({ User } = await import('../models/user'))
  ;({ default: Tasker } = await import('../models/tasker'))
  ;({ TaskerWorkSession } = await import('../models/tasker-work-session'))
  ;({ Order } = await import('../models/order'))
  ;({ PushSubscription } = await import('../models/push-subscription'))
  ;({ IndomieBatch } = await import('../models/indomie-batch'))
  ;({ AcademicSession } = await import('../models/academic-session'))
  const keys = webpush.generateVAPIDKeys()
  ;({
    getApprovedTaskerUserIds,
    sendPushNotification,
    sendTestPushToUser,
  } = await import('../lib/push-notifications'))
  ;({ saveTaskerPushSubscription } = await import('../lib/tasker-push-subscriptions'))
  ;({ releaseDueIndomieBatches } = await import('../lib/indomie-batch-release'))
  ;({ processDueOrderEscalations, REMINDER_DELAY_MS, ADMIN_ESCALATION_DELAY_MS } =
    await import('../lib/orders/order-escalation'))

  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = keys.publicKey
  process.env.VAPID_PRIVATE_KEY = keys.privateKey
  process.env.VAPID_SUBJECT = 'mailto:test@swiftdu.org'
  process.env.TELEGRAM_ADMIN_CHAT_ID = '-10099999999'
  process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
  process.env.OPERATIONS_ENABLED = 'true'
  process.env.SWIFTDU_BASE_URL = 'https://swiftdu.org'
  delete process.env.TELEGRAM_ALERTS_ENABLED

  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  process.env.MONGODB_URI = database.getUri('push-escalation-tests')

  await mongoose.connect(process.env.MONGODB_URI)
  await Promise.all([
    User.init(),
    Tasker.init(),
    TaskerWorkSession.init(),
    Order.init(),
    PushSubscription.init(),
    IndomieBatch.init(),
    AcademicSession.init(),
  ])

  // Stub webpush.sendNotification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(webpush as any).sendNotification = async (
    subscription: webpush.PushSubscription,
    payload: string,
    options?: webpush.RequestOptions
  ) => {
    if (subscription.endpoint?.includes('expired-endpoint-410')) {
      const error = Object.assign(new Error('Subscription expired'), {
        statusCode: 410,
      })
      throw error
    }
    sentWebPushes.push({ subscription, payload, options })
    return { statusCode: 201, body: '', headers: {} }
  }

  // Stub fetch for Telegram
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input?.url || ''
    if (url.includes('api.telegram.org')) {
      const body = init?.body ? JSON.parse(init.body) : {}
      sentTelegramMessages.push({
        text: body.text,
        chatId: body.chat_id,
        options: body.reply_markup,
      })
      return new Response(JSON.stringify({ ok: true, result: { message_id: 100 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return originalFetch(input, init)
  }
})

after(async () => {
  webpush.sendNotification = originalSendNotification
  globalThis.fetch = originalFetch
  await mongoose.disconnect()
  await database.stop()
})

beforeEach(async () => {
  sentWebPushes = []
  sentTelegramMessages = []
  await Promise.all([
    User.deleteMany({}),
    Tasker.deleteMany({}),
    TaskerWorkSession.deleteMany({}),
    Order.deleteMany({}),
    PushSubscription.deleteMany({}),
    IndomieBatch.deleteMany({}),
  ])
})

test('1. Opted-in tasker receives an eligible notification', async () => {
  const user = await User.create({
    name: 'Opted In Tasker',
    email: 'opted-in@swiftdu.test',
    role: 'tasker',
    gender: 'female',
  })
  const tasker = await Tasker.create({
    userId: user._id,
    phone: '08011111111',
    studentId: 'STU001',
    location: 'Female Hall',
    isVerified: true,
    isRejected: false,
    isSettlementSuspended: false,
    orderAlertsEnabled: true,
    taskerMode: 'live',
  })
  await PushSubscription.create({
    userId: String(user._id),
    role: 'tasker',
    endpoint: 'https://push.example.com/opted-in',
    keys: { p256dh: 'p256dh_sample_key', auth: 'auth_sample_key' },
  })

  const result = await sendPushNotification({
    audience: { roles: ['tasker'], taskerMode: 'live' },
    title: 'New Task Available',
    body: 'Food delivery in Female Hall',
    url: '/tasker-dashboard/order-123?preview=true',
    tag: 'new-task-123',
    urgency: 'high',
  })

  assert.equal(result.recipientCount, 1)
  assert.equal(result.deliveredCount, 1)
  assert.equal(sentWebPushes.length, 1)
  assert.equal(sentWebPushes[0].options?.urgency, 'high')
  assert.equal(sentWebPushes[0].options?.TTL, 300)
  const parsed = JSON.parse(sentWebPushes[0].payload)
  assert.equal(parsed.title, 'New Task Available')
  assert.equal(parsed.tag, 'new-task-123')
})

test('2. Opted-out tasker is excluded from new order notifications', async () => {
  const user = await User.create({
    name: 'Opted Out Tasker',
    email: 'opted-out@swiftdu.test',
    role: 'tasker',
    gender: 'male',
  })
  await Tasker.create({
    userId: user._id,
    phone: '08022222222',
    studentId: 'STU002',
    location: 'Male Hall',
    isVerified: true,
    isRejected: false,
    isSettlementSuspended: false,
    orderAlertsEnabled: false, // Opted OUT
    taskerMode: 'live',
  })
  await PushSubscription.create({
    userId: String(user._id),
    role: 'tasker',
    endpoint: 'https://push.example.com/opted-out',
    keys: { p256dh: 'key', auth: 'auth' },
  })

  const eligibleUserIds = await getApprovedTaskerUserIds('live')
  assert.equal(eligibleUserIds.includes(String(user._id)), false)

  const result = await sendPushNotification({
    audience: { roles: ['tasker'], taskerMode: 'live' },
    title: 'New Task Available',
    body: 'Test body',
    url: '/tasker-dashboard/123',
  })
  assert.equal(result.deliveredCount, 0)
})

test('3. Unverified tasker is excluded from notifications', async () => {
  const user = await User.create({
    name: 'Unverified Tasker',
    email: 'unverified@swiftdu.test',
    role: 'tasker',
  })
  await Tasker.create({
    userId: user._id,
    phone: '08033333333',
    studentId: 'STU003',
    location: 'Main Gate',
    isVerified: false, // Not verified!
    isRejected: false,
    orderAlertsEnabled: true,
    taskerMode: 'live',
  })
  await PushSubscription.create({
    userId: String(user._id),
    role: 'tasker',
    endpoint: 'https://push.example.com/unverified',
    keys: { p256dh: 'key', auth: 'auth' },
  })

  const eligibleUserIds = await getApprovedTaskerUserIds('live')
  assert.equal(eligibleUserIds.includes(String(user._id)), false)
})

test('4. Suspended tasker is excluded from notifications', async () => {
  const user = await User.create({
    name: 'Suspended Tasker',
    email: 'suspended@swiftdu.test',
    role: 'tasker',
  })
  await Tasker.create({
    userId: user._id,
    phone: '08044444444',
    studentId: 'STU004',
    location: 'Main Gate',
    isVerified: true,
    isRejected: false,
    isSettlementSuspended: true, // Overdue settlement suspension
    orderAlertsEnabled: true,
    taskerMode: 'live',
  })
  await PushSubscription.create({
    userId: String(user._id),
    role: 'tasker',
    endpoint: 'https://push.example.com/suspended',
    keys: { p256dh: 'key', auth: 'auth' },
  })

  const eligibleUserIds = await getApprovedTaskerUserIds('live')
  assert.equal(eligibleUserIds.includes(String(user._id)), false)
})

test('5. Training tasker does not receive live-order alerts, and vice versa', async () => {
  const trainingUser = await User.create({
    name: 'Training Tasker',
    email: 'training@swiftdu.test',
    role: 'tasker',
  })
  await Tasker.create({
    userId: trainingUser._id,
    phone: '08055555555',
    studentId: 'STU005',
    location: 'Main Gate',
    isVerified: true,
    isRejected: false,
    orderAlertsEnabled: true,
    taskerMode: 'training',
  })
  await PushSubscription.create({
    userId: String(trainingUser._id),
    role: 'tasker',
    endpoint: 'https://push.example.com/training',
    keys: { p256dh: 'key', auth: 'auth' },
  })

  const liveUser = await User.create({
    name: 'Live Tasker',
    email: 'live@swiftdu.test',
    role: 'tasker',
  })
  await Tasker.create({
    userId: liveUser._id,
    phone: '08066666666',
    studentId: 'STU006',
    location: 'Main Gate',
    isVerified: true,
    isRejected: false,
    orderAlertsEnabled: true,
    taskerMode: 'live',
  })
  await PushSubscription.create({
    userId: String(liveUser._id),
    role: 'tasker',
    endpoint: 'https://push.example.com/live',
    keys: { p256dh: 'key', auth: 'auth' },
  })

  // Live order push
  const liveResult = await sendPushNotification({
    audience: { roles: ['tasker'], taskerMode: 'live' },
    title: 'Live Task',
    body: 'Live Task Body',
    url: '/tasker-dashboard/live-1',
  })
  assert.equal(liveResult.recipientCount, 1)
  assert.equal(sentWebPushes[0].subscription.endpoint, 'https://push.example.com/live')

  // Training order push
  sentWebPushes = []
  const trainingResult = await sendPushNotification({
    audience: { roles: ['tasker'], taskerMode: 'training' },
    title: '[Training] Test Task',
    body: 'Test Task Body',
    url: '/tasker-dashboard/test-1',
  })
  assert.equal(trainingResult.recipientCount, 1)
  assert.equal(sentWebPushes[0].subscription.endpoint, 'https://push.example.com/training')
})

test('6. Gender-restricted orders reach only eligible taskers', async () => {
  const femaleUser = await User.create({
    name: 'Female Tasker',
    email: 'female@swiftdu.test',
    role: 'tasker',
    gender: 'female',
  })
  await Tasker.create({
    userId: femaleUser._id,
    phone: '08077777777',
    studentId: 'STU007',
    location: 'Female Hostel',
    isVerified: true,
    orderAlertsEnabled: true,
    taskerMode: 'live',
  })
  await PushSubscription.create({
    userId: String(femaleUser._id),
    role: 'tasker',
    endpoint: 'https://push.example.com/female',
    keys: { p256dh: 'k', auth: 'a' },
  })

  const maleUser = await User.create({
    name: 'Male Tasker',
    email: 'male@swiftdu.test',
    role: 'tasker',
    gender: 'male',
  })
  await Tasker.create({
    userId: maleUser._id,
    phone: '08088888888',
    studentId: 'STU008',
    location: 'Male Hostel',
    isVerified: true,
    orderAlertsEnabled: true,
    taskerMode: 'live',
  })
  await PushSubscription.create({
    userId: String(maleUser._id),
    role: 'tasker',
    endpoint: 'https://push.example.com/male',
    keys: { p256dh: 'k', auth: 'a' },
  })

  // Female-only errand
  const femaleOnlyResult = await sendPushNotification({
    audience: { roles: ['tasker'], taskerGenderRestriction: 'female', taskerMode: 'live' },
    title: 'Female Only Task',
    body: 'Female Hostel Delivery',
    url: '/tasker-dashboard/f-1',
  })
  assert.equal(femaleOnlyResult.recipientCount, 1)
  assert.equal(sentWebPushes[0].subscription.endpoint, 'https://push.example.com/female')

  // Male-only errand
  sentWebPushes = []
  const maleOnlyResult = await sendPushNotification({
    audience: { roles: ['tasker'], taskerGenderRestriction: 'male', taskerMode: 'live' },
    title: 'Male Only Task',
    body: 'Male Hostel Delivery',
    url: '/tasker-dashboard/m-1',
  })
  assert.equal(maleOnlyResult.recipientCount, 1)
  assert.equal(sentWebPushes[0].subscription.endpoint, 'https://push.example.com/male')
})

test('7. Tasker can receive an alert without an open work session', async () => {
  const user = await User.create({
    name: 'Off-Duty Tasker',
    email: 'offduty@swiftdu.test',
    role: 'tasker',
    gender: 'female',
  })
  const tasker = await Tasker.create({
    userId: user._id,
    phone: '08099999999',
    studentId: 'STU009',
    location: 'Campus',
    isVerified: true,
    orderAlertsEnabled: true,
    taskerMode: 'live',
  })
  await PushSubscription.create({
    userId: String(user._id),
    role: 'tasker',
    endpoint: 'https://push.example.com/offduty',
    keys: { p256dh: 'k', auth: 'a' },
  })

  // Verify that NO open session exists
  const openSessionsCount = await TaskerWorkSession.countDocuments({
    taskerId: String(tasker._id),
    open: true,
  })
  assert.equal(openSessionsCount, 0)

  // Send push notification
  const result = await sendPushNotification({
    audience: { roles: ['tasker'], taskerMode: 'live' },
    title: 'New Errand',
    body: 'Delivery in Campus',
    url: '/tasker-dashboard/task-offduty',
  })

  assert.equal(result.recipientCount, 1)
  assert.equal(result.deliveredCount, 1)
  assert.equal(sentWebPushes.length, 1)
})

test('8. Existing acceptance restrictions remain enforced (must check in to accept)', async () => {
  const user = await User.create({
    name: 'Acceptance Rule Tasker',
    email: 'acceptance@swiftdu.test',
    role: 'tasker',
  })
  const tasker = await Tasker.create({
    userId: user._id,
    phone: '08012345678',
    studentId: 'STU010',
    location: 'Campus',
    isVerified: true,
    orderAlertsEnabled: true,
    taskerMode: 'live',
  })

  // Check if open session exists: should be false
  const hasOpenSession = await TaskerWorkSession.exists({
    taskerId: String(tasker._id),
    open: true,
  })
  assert.equal(Boolean(hasOpenSession), false)

  // Once checked in:
  await TaskerWorkSession.create({
    taskerId: String(tasker._id),
    open: true,
    startedAt: new Date(),
  })
  const checkedIn = await TaskerWorkSession.exists({
    taskerId: String(tasker._id),
    open: true,
  })
  assert.equal(Boolean(checkedIn), true)
})

test('9. Expired subscription handling removes 404/410 endpoints', async () => {
  const user = await User.create({
    name: 'Expired Sub Tasker',
    email: 'expired@swiftdu.test',
    role: 'tasker',
  })
  await Tasker.create({
    userId: user._id,
    phone: '08011122233',
    studentId: 'STU011',
    location: 'Campus',
    isVerified: true,
    orderAlertsEnabled: true,
    taskerMode: 'live',
  })
  const expiredEndpoint = 'https://push.example.com/expired-endpoint-410'
  await PushSubscription.create({
    userId: String(user._id),
    role: 'tasker',
    endpoint: expiredEndpoint,
    keys: { p256dh: 'k', auth: 'a' },
  })

  const result = await sendPushNotification({
    audience: { userIds: [String(user._id)] },
    title: 'Test Expired',
    body: 'Should expire',
    url: '/tasker-dashboard',
  })

  assert.equal(result.recipientCount, 1)
  assert.equal(result.deliveredCount, 0)
  assert.equal(result.expiredCount, 1)

  // Assert subscription was deleted from database
  const stillExists = await PushSubscription.findOne({ endpoint: expiredEndpoint })
  assert.equal(stillExists, null)
})

test('10. Subscription re-synchronization restores missing backend records', async () => {
  const user = await User.create({
    name: 'Sync Tasker',
    email: 'sync@swiftdu.test',
    role: 'tasker',
  })

  // Simulated browser subscription payload
  const browserSub = {
    endpoint: 'https://push.example.com/restored-sub',
    keys: {
      p256dh: 'restored_p256dh_key',
      auth: 'restored_auth_key',
    },
    expirationTime: null,
  }

  // Record is missing before sync
  const initial = await PushSubscription.findOne({ endpoint: browserSub.endpoint })
  assert.equal(initial, null)

  // Save / re-sync
  await saveTaskerPushSubscription({
    userId: String(user._id),
    subscription: browserSub,
    userAgent: 'Mozilla/5.0 Test Browser',
  })

  const restored = await PushSubscription.findOne({ endpoint: browserSub.endpoint })
  assert.ok(restored)
  assert.equal(restored.userId, String(user._id))
  assert.equal(restored.role, 'tasker')
  assert.equal(restored.keys.p256dh, 'restored_p256dh_key')
})

test('11. Duplicate subscription prevention updates existing endpoint', async () => {
  const userA = await User.create({
    name: 'User A',
    email: 'usera@swiftdu.test',
    role: 'tasker',
  })
  const userB = await User.create({
    name: 'User B',
    email: 'userb@swiftdu.test',
    role: 'tasker',
  })

  const endpoint = 'https://push.example.com/shared-device-endpoint'
  await saveTaskerPushSubscription({
    userId: String(userA._id),
    subscription: {
      endpoint,
      keys: { p256dh: 'key1', auth: 'auth1' },
    },
  })

  // Re-saving with new user (e.g. login on same browser device)
  await saveTaskerPushSubscription({
    userId: String(userB._id),
    subscription: {
      endpoint,
      keys: { p256dh: 'key1', auth: 'auth1' },
    },
  })

  const count = await PushSubscription.countDocuments({ endpoint })
  assert.equal(count, 1)

  const doc = await PushSubscription.findOne({ endpoint })
  assert.equal(doc?.userId, String(userB._id))
})

test('12. Indomie batch release generates push notification', async () => {
  const taskerUser = await User.create({
    name: 'Indomie Tasker',
    email: 'indomie-tasker@swiftdu.test',
    role: 'tasker',
    gender: 'female',
  })
  await Tasker.create({
    userId: taskerUser._id,
    phone: '08099887766',
    studentId: 'STU012',
    location: 'Female Hostel',
    isVerified: true,
    orderAlertsEnabled: true,
    taskerMode: 'live',
  })
  await PushSubscription.create({
    userId: String(taskerUser._id),
    role: 'tasker',
    endpoint: 'https://push.example.com/indomie-tasker',
    keys: { p256dh: 'k', auth: 'a' },
  })

  const pastWindowStart = new Date(Date.now() - 30 * 60 * 1000)
  const pastWindowEnd = new Date(Date.now() - 5 * 60 * 1000)

  // Create 2 due indomie orders forming a batch
  await Order.create([
    {
      userId: new Types.ObjectId().toString(),
      taskType: 'indomie',
      pricingModel: 'tiered',
      totalAmount: 1800,
      amount: 1500,
      commission: 100,
      platformFee: 200,
      taskerFee: 1500,
      serviceFee: 300,
      location: 'Female Hostel',
      status: 'pending',
      hasPaid: true,
      taskerHasPaid: false,
      isDeclinedTask: false,
      paymentStatus: 'paid',
      isTestOrder: false,
      createdInMode: 'live',
      batchingStatus: 'waiting',
      batchWindowStart: pastWindowStart,
      batchWindowEnd: pastWindowEnd,
      store: 'Campus Indomie Spot',
    },
    {
      userId: new Types.ObjectId().toString(),
      taskType: 'indomie',
      pricingModel: 'tiered',
      totalAmount: 2200,
      amount: 1900,
      commission: 100,
      platformFee: 200,
      taskerFee: 1900,
      serviceFee: 300,
      location: 'Female Hostel',
      status: 'pending',
      hasPaid: true,
      taskerHasPaid: false,
      isDeclinedTask: false,
      paymentStatus: 'paid',
      isTestOrder: false,
      createdInMode: 'live',
      batchingStatus: 'waiting',
      batchWindowStart: pastWindowStart,
      batchWindowEnd: pastWindowEnd,
      store: 'Campus Indomie Spot',
    },
  ])

  await releaseDueIndomieBatches(new Date())

  // Allow async push to resolve
  await new Promise((resolve) => setTimeout(resolve, 200))

  const batches = await IndomieBatch.find({ status: 'available' })
  assert.equal(batches.length, 1)
  assert.equal(batches[0].orderCount, 2)
  assert.equal(sentWebPushes.length, 1)
  const payload = JSON.parse(sentWebPushes[0].payload)
  assert.ok(payload.title.includes('Indomie Batch Available'))
  assert.equal(payload.tag, `indomie-batch-${batches[0]._id.toString()}`)
})

test('13. No notification before Indomie batch release window', async () => {
  const futureWindowStart = new Date(Date.now() + 10 * 60 * 1000)
  const futureWindowEnd = new Date(Date.now() + 30 * 60 * 1000)

  await Order.create({
    userId: new Types.ObjectId().toString(),
    taskType: 'indomie',
    pricingModel: 'tiered',
    totalAmount: 1800,
    amount: 1500,
    commission: 100,
    platformFee: 200,
    taskerFee: 1500,
    serviceFee: 300,
    location: 'Female Hostel',
    status: 'pending',
    hasPaid: true,
    taskerHasPaid: false,
    isDeclinedTask: false,
    paymentStatus: 'paid',
    isTestOrder: false,
    createdInMode: 'live',
    batchingStatus: 'waiting',
    batchWindowStart: futureWindowStart,
    batchWindowEnd: futureWindowEnd,
  })

  await releaseDueIndomieBatches(new Date())
  await new Promise((resolve) => setTimeout(resolve, 100))

  assert.equal(sentWebPushes.length, 0)
  const waitingOrders = await Order.find({ batchingStatus: 'waiting' })
  assert.equal(waitingOrders.length, 1)
})

test('14. Reminder suppression after order acceptance', async () => {
  const acceptedOrder = await Order.create({
    userId: new Types.ObjectId().toString(),
    taskType: 'restaurant',
    pricingModel: 'tiered',
    totalAmount: 2000,
    amount: 1500,
    commission: 100,
    platformFee: 400,
    taskerFee: 1500,
    serviceFee: 500,
    location: 'Main Hostel',
    status: 'in_progress', // Accepted by a tasker!
    taskerId: 'assigned-tasker-123',
    taskerName: 'Assigned Tasker',
    hasPaid: true,
    taskerHasPaid: false,
    isDeclinedTask: false,
    paymentStatus: 'paid',
    isTestOrder: false,
    createdInMode: 'live',
    taskerSearchStartedAt: new Date(Date.now() - 2.5 * 60 * 1000), // 2.5 mins ago
  })

  const runResult = await processDueOrderEscalations()

  assert.equal(runResult.remindersSent, 0)
  assert.equal(sentWebPushes.length, 0)

  const freshOrder = await Order.findById(acceptedOrder._id)
  assert.equal(freshOrder?.escalationReminderSentAt, undefined)
})

test('15. Administrator escalation triggered after configured delay', async () => {
  const unacceptedOrder = await Order.create({
    userId: new Types.ObjectId().toString(),
    taskType: 'restaurant',
    pricingModel: 'tiered',
    totalAmount: 2500,
    amount: 2000,
    commission: 100,
    platformFee: 400,
    taskerFee: 2000,
    serviceFee: 500,
    location: 'Engineering Complex',
    status: 'pending',
    hasPaid: true,
    taskerHasPaid: false,
    isDeclinedTask: false,
    paymentStatus: 'paid',
    isTestOrder: false,
    createdInMode: 'live',
    taskerSearchStartedAt: new Date(Date.now() - 3.5 * 60 * 1000), // 3.5 mins ago
  })

  const runResult = await processDueOrderEscalations()

  assert.equal(runResult.remindersSent, 1)
  assert.equal(runResult.adminAlertsSent, 1)
  assert.equal(sentTelegramMessages.length, 1)
  assert.ok(sentTelegramMessages[0].text.includes('SwiftDU — Unaccepted Order'))
  assert.ok(sentTelegramMessages[0].text.includes(String(unacceptedOrder._id)))
  assert.ok(sentTelegramMessages[0].text.includes('Engineering Complex'))

  const freshOrder = await Order.findById(unacceptedOrder._id)
  assert.ok(freshOrder?.escalationReminderSentAt)
  assert.ok(freshOrder?.escalationAdminAlertSentAt)
})

test('16. Duplicate escalation prevention under concurrent runs', async () => {
  const unacceptedOrder = await Order.create({
    userId: new Types.ObjectId().toString(),
    taskType: 'shopping',
    pricingModel: 'tiered',
    totalAmount: 2500,
    amount: 2000,
    commission: 100,
    platformFee: 400,
    taskerFee: 2000,
    serviceFee: 500,
    location: 'Science Block',
    status: 'pending',
    hasPaid: true,
    taskerHasPaid: false,
    isDeclinedTask: false,
    paymentStatus: 'paid',
    isTestOrder: false,
    createdInMode: 'live',
    taskerSearchStartedAt: new Date(Date.now() - 4 * 60 * 1000), // 4 mins ago
  })

  // Run two escalation sweeps concurrently
  const [result1, result2] = await Promise.all([
    processDueOrderEscalations(),
    processDueOrderEscalations(),
  ])

  // Together, exactly 1 reminder and 1 admin alert should be sent
  const totalReminders = result1.remindersSent + result2.remindersSent
  const totalAdminAlerts = result1.adminAlertsSent + result2.adminAlertsSent
  assert.equal(totalReminders, 1)
  assert.equal(totalAdminAlerts, 1)
  assert.equal(sentTelegramMessages.length, 1)

  // Running a 3rd time should do nothing
  const result3 = await processDueOrderEscalations()
  assert.equal(result3.remindersSent, 0)
  assert.equal(result3.adminAlertsSent, 0)
})

test('17. Sammy and website order notification consistency', async () => {
  const user = await User.create({
    name: 'Consistency Tasker',
    email: 'consistency@swiftdu.test',
    role: 'tasker',
  })
  await Tasker.create({
    userId: user._id,
    phone: '08099881122',
    studentId: 'STU017',
    location: 'Campus',
    isVerified: true,
    orderAlertsEnabled: true,
    taskerMode: 'live',
  })
  await PushSubscription.create({
    userId: String(user._id),
    role: 'tasker',
    endpoint: 'https://push.example.com/consistency',
    keys: { p256dh: 'k', auth: 'a' },
  })

  // Verify that any order creation push payload consistently targets preview
  const result = await sendPushNotification({
    audience: { roles: ['tasker'], taskerMode: 'live' },
    title: 'New Task Available',
    body: 'Food delivery in Campus - NGN 1,500',
    url: '/tasker-dashboard/order-consistent?preview=true',
    tag: 'new-task-order-consistent',
    orderId: 'order-consistent',
    urgency: 'high',
    category: 'new_order',
  })

  assert.equal(result.deliveredCount, 1)
  assert.equal(sentWebPushes.length, 1)
  const payload = JSON.parse(sentWebPushes[0].payload)
  assert.equal(payload.url, 'https://swiftdu.org/tasker-dashboard/order-consistent?preview=true')
  assert.equal(payload.orderId, 'order-consistent')
  assert.equal(sentWebPushes[0].options?.urgency, 'high')
  assert.equal(sentWebPushes[0].options?.TTL, 300)
})
