
import assert from 'node:assert/strict'
import { createRequire, Module } from 'node:module'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { classifyDeliveryLocation, canTaskerDeliver } from './delivery-policy'
import { Order } from '../models/order'

test('destination classification is independent of customer gender and persists on edits', async () => {
  assert.equal(classifyDeliveryLocation('Girls Hostel, Block A room 12'), 'female')
  assert.equal(classifyDeliveryLocation('Boys Hostel room 4'), 'male')
  assert.equal(classifyDeliveryLocation('Amnesty Hostel room 4'), 'male')
  assert.equal(classifyDeliveryLocation('Amnesty'), 'male')
  assert.equal(classifyDeliveryLocation('Law Hall'), 'any')
  assert.equal(classifyDeliveryLocation('Library 2nd floor'), 'any')
  assert.equal(classifyDeliveryLocation('unknown building'), 'any')
  assert.equal(classifyDeliveryLocation('Girls Hostel / Boys Hostel'), undefined)
  assert.equal(canTaskerDeliver({ location: 'Girls Hostel', taskerGenderRestriction: 'any' }, 'male'), false)
  assert.equal(canTaskerDeliver({ location: 'Unknown' }, 'female'), true)
  assert.equal(classifyDeliveryLocation('   '), undefined)
  for (const gender of ['male', 'female', 'other', undefined]) {
    assert.equal(canTaskerDeliver({ location: 'New campus building', taskerGenderRestriction: 'female' }, gender), true)
  }
  assert.equal(canTaskerDeliver({ location: 'Girls Hostel / Boys Hostel', taskerGenderRestriction: 'any' }, 'male'), false)
  const order = new Order({ userId: 'customer', taskType: 'restaurant', location: 'Girls Hostel', amount: 1, commission: 1, totalAmount: 2, taskerGenderRestriction: 'any' })
  await order.validate()
  assert.equal(order.taskerGenderRestriction, 'female')
  order.location = 'New campus building'
  await order.validate()
  assert.equal(order.taskerGenderRestriction, 'any')
})

test('actual alert pipeline routes all three destinations, ignores legacy relay and contains send failures', async t => {
  const require = createRequire(import.meta.url)
  const stubs: Record<string, unknown> = {
    '../models/user': { User: {
      findById: () => ({ select: () => ({ lean: async () => ({ name: 'Customer', email: 'customer@example.invalid' }) }) }),
      find: () => ({ select: () => ({ lean: async () => [] }) }),
    } },
    './email': { sendTransactionalEmail: async () => { assert.fail('Order notifications must not send email') } },
  }
  for (const [path, exports] of Object.entries(stubs)) {
    const id = require.resolve(path), previous = require.cache[id], stub = new Module(id)
    stub.exports = exports; stub.loaded = true; require.cache[id] = stub
    t.after(() => { if (previous) require.cache[id] = previous; else delete require.cache[id] })
  }
  const keys = ['TELEGRAM_GIRLS_ORDERS_CHAT_ID', 'TELEGRAM_BOYS_ORDERS_CHAT_ID', 'TELEGRAM_TRAINING_ORDERS_CHAT_ID', 'TELEGRAM_BOT_TOKEN', 'SAMMY_API_URL', 'TELEGRAM_ALERTS_ENABLED', 'RESEND_API_KEY']
  const previous = keys.map(key => process.env[key])
  t.after(() => keys.forEach((key,i) => { if(previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i] }))
  Object.assign(process.env, { TELEGRAM_GIRLS_ORDERS_CHAT_ID: '-1001', TELEGRAM_BOYS_ORDERS_CHAT_ID: '-1002', TELEGRAM_BOT_TOKEN: 'test', SAMMY_API_URL: 'https://relay.invalid', TELEGRAM_ALERTS_ENABLED: 'true' })
  process.env.RESEND_API_KEY = 'configured-but-must-not-be-used'
  const sent: string[] = []
  const messages: Array<{ chat_id: string; text: string; reply_markup?: { inline_keyboard: Array<Array<{ text: string; url: string }>> }; link_preview_options?: Record<string, unknown> }> = []
  let failGirls = false
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.ok(url.startsWith('https://api.telegram.org/'))
    const message = JSON.parse(String(init.body))
    sent.push(message.chat_id)
    messages.push(message)
    if (failGirls && message.chat_id === '-1001') throw new Error('simulated network failure')
    return Response.json({ ok: true })
  })
  const { notifyAdminsOfOrderEvent } = require('./order-alerts')
  const notify = (
    location: string,
    taskType = 'restaurant',
    isTestOrder = false,
    event: 'created' | 'cancelled' = 'created',
    orderOverrides: Record<string, unknown> = {}
  ) => notifyAdminsOfOrderEvent({
    event, order: { _id: 'order', userId: 'customer', location, taskType, amount: 100, totalAmount: 3500, taskerFee: 500, isTestOrder, ...orderOverrides },
  })
  for (const [location, expected] of [
    ['Girls Hostel', ['-1001']], ['Amnesty Hostel', ['-1002']], ['Library', ['-1001', '-1002']], ['New campus building', ['-1001', '-1002']],
  ] as const) {
    sent.length = 0
    messages.length = 0
    const result = await notify(location)
    assert.deepEqual(sent, expected)
    assert.equal(result.telegram.deliveredCount, expected.length)
    assert.equal(result.email.skipped, true)
    assert.equal(result.recipientCount, expected.length)
  }
  assert.match(messages[0].text, /SWIFTDU NEW ORDER/)
  assert.match(messages[0].text, /<blockquote>Pick up the order and deliver to <b>New campus building<\/b>\.<\/blockquote>/)
  assert.match(messages[0].text, /₦3,500/)
  assert.doesNotMatch(messages[0].text, /<a href=/)
  assert.doesNotMatch(messages[0].text, /Customer/)
  assert.deepEqual(messages[0].reply_markup, {
    inline_keyboard: [[{ text: 'Accept Order', url: 'https://www.swiftdu.org/tasker-dashboard/accept-order/order' }]],
  })
  assert.deepEqual(messages[0].link_preview_options, {
    is_disabled: false,
    url: 'https://www.swiftdu.org/tasker-dashboard/accept-order/order',
    prefer_large_media: true,
    show_above_text: false,
  })
  sent.length = 0
  await notify('Girls Hostel', 'copy_notes')
  assert.deepEqual(sent, ['-1001'])
  sent.length = 0
  failGirls = true
  const result = await notify('Library')
  assert.deepEqual(sent, ['-1001', '-1002'])
  assert.equal(result.telegram.deliveredCount, 1)
  delete process.env.TELEGRAM_GIRLS_ORDERS_CHAT_ID
  sent.length = 0
  assert.equal((await notify('Girls Hostel')).telegram.skipped, true)
  assert.deepEqual(sent, [])

  process.env.TELEGRAM_GIRLS_ORDERS_CHAT_ID = '-1001'
  failGirls = false
  sent.length = 0
  messages.length = 0
  await notify('Girls Hostel', 'restaurant', false, 'cancelled')
  assert.deepEqual(sent, ['-1001'])
  assert.match(messages[0].text, /ORDER CANCELLED/)
  assert.equal(messages[0].reply_markup, undefined)
  assert.equal(messages[0].link_preview_options, undefined)
  assert.doesNotMatch(messages[0].text, /tasker-dashboard\/accept-order/)

  process.env.TELEGRAM_TRAINING_ORDERS_CHAT_ID = '-1003'
  sent.length = 0
  messages.length = 0
  const trainingResult = await notify('Amnesty Hostel', 'restaurant', true)
  assert.deepEqual(sent, ['-1003'])
  assert.equal(trainingResult.telegram.deliveredCount, 1)
  assert.match(messages[0].text, /SWIFTDU TRAINING ORDER/)
  assert.match(messages[0].text, /<blockquote>Pick up the order and deliver to <b>Amnesty Hostel<\/b>\.<\/blockquote>/)
  assert.match(messages[0].text, /₦3,500/)
  assert.match(messages[0].text, /https:\/\/www\.swiftdu\.org\/tasker-dashboard\/accept-order\/order/)
  assert.doesNotMatch(messages[0].text, /<a href=/)
  assert.deepEqual(messages[0].reply_markup, {
    inline_keyboard: [[{ text: 'Accept Order', url: 'https://www.swiftdu.org/tasker-dashboard/accept-order/order' }]],
  })
  assert.deepEqual(messages[0].link_preview_options, {
    is_disabled: false,
    url: 'https://www.swiftdu.org/tasker-dashboard/accept-order/order',
    prefer_large_media: true,
    show_above_text: false,
  })

  sent.length = 0
  messages.length = 0
  await notify('Amnesty <Hostel>', 'restaurant', true, 'created', {
    store: 'Akpan & Sons <Main>',
    description: 'Rice & <chicken>',
  })
  assert.deepEqual(sent, ['-1003'])
  assert.match(messages[0].text, /Pick up from <b>Akpan &amp; Sons &lt;Main&gt;<\/b>/)
  assert.match(messages[0].text, /deliver to <b>Amnesty &lt;Hostel&gt;<\/b>/)
  assert.match(messages[0].text, /<b>Order:<\/b> Rice &amp; &lt;chicken&gt;/)

  sent.length = 0
  messages.length = 0
  await notify('Amnesty Hostel', 'copy_notes', true)
  assert.deepEqual(sent, ['-1003'])
  assert.match(messages[0].text, /<blockquote>Write and deliver the notes to <b>Amnesty Hostel<\/b>\.<\/blockquote>/)
  assert.doesNotMatch(messages[0].text, /Pages:|Note Size:|Due:/)

  sent.length = 0
  messages.length = 0
  await notify('Amnesty Hostel', 'restaurant', true, 'cancelled')
  assert.deepEqual(sent, ['-1003'])
  assert.equal(messages[0].reply_markup, undefined)
  assert.equal(messages[0].link_preview_options, undefined)
  assert.doesNotMatch(messages[0].text, /tasker-dashboard\/accept-order/)
})

test('direct acceptance endpoint rejects opposite and missing gender before assignment', async t => {
  const require = createRequire(import.meta.url)
  let gender: string | undefined = 'male'
  let location = 'Girls Hostel'
  let assignments = 0
  const order = () => ({ _id: 'order', userId: 'customer', location, status: 'pending', updatedAt: new Date(), isTestOrder: false })
  const stubs: Record<string, unknown> = {
    './db': { connectDB: async () => {} },
    './auth': { auth: { api: { getSession: async () => ({ user: { id: 'tasker-user', name: 'Tasker' } }) } } },
    '../models/user': { User: { findById: () => ({ select: () => ({ lean: async () => ({ gender }) }) }) } },
    '../models/tasker': { __esModule: true, default: { findOne: async () => ({ _id: 'tasker', isVerified: true, taskerMode: 'live' }) } },
    '../models/order': { Order: {
      findById: async () => order(),
      findOneAndUpdate: async (filter: Record<string, unknown>) => { assignments++; assert.equal(filter.location, location); assert.ok(filter.updatedAt); return { ...order(), _id: 'order', status: 'in_progress' } },
    } },
    './tasker-settlement': { syncTaskerSettlementStatus: async () => ({ isSettlementSuspended: false }) },
    './tasker-work-server': { lockTaskerWork: async () => async () => {}, WorkError: class extends Error {} },
    '../models/tasker-work-session': { TaskerWorkSession: { exists: async () => true } },
    './socket': { emitOrderUpdated: () => {} },
    './push-notifications': { formatPushTaskType: () => 'food', sendPushNotification: async () => ({ recipientCount: 0, deliveredCount: 0 }) },
    './whatsapp/send-message': { sendWhatsAppText: async () => {} },
  }
  for (const [path, exports] of Object.entries(stubs)) {
    const id = require.resolve(path), previous = require.cache[id], stub = new Module(id)
    stub.exports = exports; stub.loaded = true; require.cache[id] = stub
    t.after(() => { if(previous) require.cache[id] = previous; else delete require.cache[id] })
  }
  const previous = process.env.OPERATIONS_ENABLED
  process.env.OPERATIONS_ENABLED = 'true'
  t.after(() => { if(previous === undefined) delete process.env.OPERATIONS_ENABLED; else process.env.OPERATIONS_ENABLED = previous })
  const { POST } = require('../app/api/errands/route')
  const accept = () => POST(new NextRequest('http://localhost/api/errands', { method: 'POST', body: JSON.stringify({ orderId: 'order', gender: 'female', taskerGenderRestriction: 'any' }) }))
  assert.equal((await accept()).status, 403)
  location = 'Boys Hostel'; gender = 'female'
  assert.equal((await accept()).status, 403)
  gender = undefined
  assert.equal((await accept()).status, 403)
  assert.equal(assignments, 0)
  location = 'Girls Hostel'; gender = 'female'
  assert.equal((await accept()).status, 200)
  location = 'Boys Hostel'; gender = 'male'
  assert.equal((await accept()).status, 200)
  location = 'Library'
  assert.equal((await accept()).status, 200)
  gender = 'female'
  assert.equal((await accept()).status, 200)
  location = 'New campus building'
  gender = undefined
  assert.equal((await accept()).status, 200)
  assert.equal(assignments, 5)
})

