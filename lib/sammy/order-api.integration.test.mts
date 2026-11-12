import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer, MongoMemoryReplSet } from 'mongodb-memory-server'

test('order API refuses standalone MongoDB because transactions are unavailable', { timeout: 120_000 }, async (t) => {
  const database = await MongoMemoryServer.create()
  process.env.MONGODB_URI = database.getUri('order-api-standalone')
  process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS = '3000'
  delete process.env.SAMMY_SWIFTDU_INTERNAL_SECRET
  const { startOrderApiServer } = await import('../../services/order-api/server.mts')

  t.after(async () => {
    await mongoose.disconnect()
    await database.stop()
    delete process.env.MONGODB_URI
    delete process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS
    delete process.env.SAMMY_SWIFTDU_INTERNAL_SECRET
  })

  await assert.rejects(startOrderApiServer(0), /SAMMY_SWIFTDU_INTERNAL_SECRET must be configured/)
  process.env.SAMMY_SWIFTDU_INTERNAL_SECRET = 'test-order-api-secret'
  await assert.rejects(
    startOrderApiServer(0),
    /MongoDB transactions are unavailable; configure a replica set or sharded cluster/,
  )
  assert.equal(mongoose.connection.readyState, 1)
})

test('previously failing import chain loads cleanly without TransformError', async () => {
  const escalationModule = await import('@/lib/orders/order-escalation')
  assert.equal(typeof escalationModule.processDueOrderEscalations, 'function')

  const pushModule = await import('@/lib/push-notifications')
  assert.equal(typeof pushModule.sendPushNotification, 'function')

  const authModule = await import('@/lib/auth')
  assert.ok(authModule.auth)
})

test('order API starts cleanly on replica set, passes health check, and isolates background errors', { timeout: 120_000 }, async (t) => {
  const database = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  process.env.MONGODB_URI = database.getUri('order-api-replica')
  process.env.SAMMY_SWIFTDU_INTERNAL_SECRET = 'test-order-api-secret'
  process.env.OPERATIONS_ENABLED = 'true'

  const { startOrderApiServer, safeErrorFields } = await import('../../services/order-api/server.mts')
  const service = await startOrderApiServer(0)

  t.after(async () => {
    await service.close()
    await mongoose.disconnect()
    await database.stop()
    delete process.env.MONGODB_URI
    delete process.env.SAMMY_SWIFTDU_INTERNAL_SECRET
    delete process.env.OPERATIONS_ENABLED
  })

  const address = service.server.address() as AddressInfo
  const healthResponse = await fetch(`http://127.0.0.1:${address.port}/health`)
  assert.equal(healthResponse.status, 200)
  assert.deepEqual(await healthResponse.json(), { status: 'ok' })

  // The full Telegram staff API now runs on Render, with the same server-side
  // bearer verification as the original SwiftDU routes.
  const authUrl = `http://127.0.0.1:${address.port}/api/internal/sammy/staff/auth`
  const rejectedAuth = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong' },
    body: JSON.stringify({ telegram: { id: '123456' } }),
  })
  assert.equal(rejectedAuth.status, 401)
  assert.equal((await rejectedAuth.json()).code, 'UNAUTHORIZED')

  const unknownStaff = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-order-api-secret' },
    body: JSON.stringify({ telegram: { id: '123456' } }),
  })
  assert.equal(unknownStaff.status, 403)
  assert.equal((await unknownStaff.json()).code, 'TELEGRAM_NOT_LINKED')

  const linkStatus = await fetch(`http://127.0.0.1:${address.port}/api/internal/sammy/telegram/link/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-order-api-secret' },
    body: JSON.stringify({ telegramUserId: '123456' }),
  })
  assert.equal(linkStatus.status, 200)
  assert.equal((await linkStatus.json()).status, 'NOT_LINKED')

  const websiteRoute = await fetch(`http://127.0.0.1:${address.port}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  })
  assert.equal(websiteRoute.status, 404)

  // Legacy WhatsApp operations also use the Render API, not Vercel.
  const customerUrl = `http://127.0.0.1:${address.port}/api/internal/sammy/orders/current`
  const unauthorizedCustomer = await fetch(customerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer incorrect' },
    body: JSON.stringify({ phone: '2348012345678' }),
  })
  assert.equal(unauthorizedCustomer.status, 401)

  for (const purpose of ['telegram', 'whatsapp']) {
    const invalidLinkPage = await fetch(`http://127.0.0.1:${address.port}/${purpose}/connect?token=invalid`)
    assert.equal(invalidLinkPage.status, 410)
    assert.match(await invalidLinkPage.text(), /connection link/i)
  }

  // Verify safeErrorFields sanitizes credentials and tokens
  const sensitiveError = new Error('Failed to connect to mongodb+srv://admin:supersecret@cluster0.abc.mongodb.net with Bearer abc123def456')
  const safeFields = safeErrorFields(sensitiveError)
  assert.ok(!JSON.stringify(safeFields).includes('supersecret'))
  assert.ok(!JSON.stringify(safeFields).includes('abc123def456'))
  assert.ok(String(safeFields.message).includes('***:***@'))
  assert.ok(String(safeFields.message).includes('[REDACTED]'))
})
