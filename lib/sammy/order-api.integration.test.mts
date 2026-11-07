import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

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