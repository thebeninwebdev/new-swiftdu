
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
  const keys = ['TELEGRAM_GIRLS_ORDERS_CHAT_ID', 'TELEGRAM_BOYS_ORDERS_CHAT_ID', 'TELEGRAM_BOT_TOKEN', 'SAMMY_API_URL', 'TELEGRAM_ALERTS_ENABLED', 'RESEND_API_KEY']
  const previous = keys.map(key => process.env[key])
  t.after(() => keys.forEach((key,i) => { if(previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i] }))
  Object.assign(process.env, { TELEGRAM_GIRLS_ORDERS_CHAT_ID: '-1001', TELEGRAM_BOYS_ORDERS_CHAT_ID: '-1002', TELEGRAM_BOT_TOKEN: 'test', SAMMY_API_URL: 'https://relay.invalid', TELEGRAM_ALERTS_ENABLED: 'true' })
  process.env.RESEND_API_KEY = 'configured-but-must-not-be-used'
  const sent: string[] = []
  let failGirls = false
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.ok(url.startsWith('https://api.telegram.org/'))
    const message = JSON.parse(String(init.body))
    sent.push(message.chat_id)
    if (failGirls && message.chat_id === '-1001') throw new Error('simulated network failure')
    return Response.json({ ok: true })
  })
  const { notifyAdminsOfOrderEvent } = require('./order-alerts')
  const notify = (location: string, taskType = 'restaurant') => notifyAdminsOfOrderEvent({
    event: 'created', order: { _id: 'order', userId: 'customer', location, taskType, amount: 100 },
  })
  for (const [location, expected] of [
    ['Girls Hostel', ['-1001']], ['Amnesty Hostel', ['-1002']], ['Library', ['-1001', '-1002']], ['New campus building', ['-1001', '-1002']],
  ] as const) {
    sent.length = 0
    const result = await notify(location)
    assert.deepEqual(sent, expected)
    assert.equal(result.telegram.deliveredCount, expected.length)
    assert.equal(result.email.skipped, true)
    assert.equal(result.recipientCount, expected.length)
  }
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

