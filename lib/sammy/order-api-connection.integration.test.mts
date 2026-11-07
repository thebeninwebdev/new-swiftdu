import assert from 'node:assert/strict'
import test from 'node:test'

test('order API does not listen when MongoDB cannot be reached', { timeout: 15_000 }, async () => {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/order-api-unreachable?serverSelectionTimeoutMS=500'
  process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS = '500'
  process.env.SAMMY_SWIFTDU_INTERNAL_SECRET = 'test-order-api-secret'
 const { startOrderApiServer } =
  await import('../../services/order-api/server.mts')

  await assert.rejects(startOrderApiServer(0))
})