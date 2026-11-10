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

  // Verify safeErrorFields sanitizes credentials and tokens
  const sensitiveError = new Error('Failed to connect to mongodb+srv://admin:supersecret@cluster0.abc.mongodb.net with Bearer abc123def456')
  const safeFields = safeErrorFields(sensitiveError)
  assert.ok(!JSON.stringify(safeFields).includes('supersecret'))
  assert.ok(!JSON.stringify(safeFields).includes('abc123def456'))
  assert.ok(String(safeFields.message).includes('***:***@'))
  assert.ok(String(safeFields.message).includes('[REDACTED]'))
})
