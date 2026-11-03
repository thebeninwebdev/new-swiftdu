import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { MongoClient } from 'mongodb'
import { TelegramLinkChallenge } from '@/models/telegram-link-challenge'
import { User } from '@/models/user'
import {
  createTelegramLinkToken,
  hashTelegramLinkToken,
} from './telegram-link-policy'

let database: MongoMemoryReplSet
let nativeClient: MongoClient
let linking: typeof import('./telegram-link')

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  process.env.MONGODB_URI = database.getUri()
  await mongoose.connect(database.getUri(), { dbName: 'telegram-link-tests' })
  const databaseModule = await import('../db')
  nativeClient = await databaseModule.default
  linking = await import('./telegram-link')
  await Promise.all([User.init(), TelegramLinkChallenge.init()])
})
after(async () => {
  await mongoose.disconnect()
  await nativeClient?.close()
  await database?.stop()
})
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), TelegramLinkChallenge.deleteMany({})])
})

async function account(email: string, values: Record<string, unknown> = {}) {
  return User.create({ email, role: 'admin', ...values })
}

async function challenge(telegramUserId: string, expiresAt: Date) {
  const token = createTelegramLinkToken()
  await TelegramLinkChallenge.create({
    tokenHash: hashTelegramLinkToken(token),
    telegramUserId,
    telegramChatId: telegramUserId,
    expiresAt,
  })
  return token
}

test('valid challenges preview once and are consumed with the account link', async () => {
  const admin = await account('admin@example.invalid')
  const issued = await linking.issueTelegramLinkChallenge({
    telegram: { id: '10001', firstName: 'Ada' },
    telegramChatId: '10001',
    botUsername: 'SwiftDUOpsBot',
  })
  const preview = await linking.previewTelegramLink(issued.token, String(admin._id))
  assert.equal(preview?.telegram.name, 'Ada')
  assert.deepEqual(await linking.consumeTelegramLink(issued.token, String(admin._id)), {
    botUsername: 'SwiftDUOpsBot',
  })
  assert.equal(await linking.consumeTelegramLink(issued.token, String(admin._id)), null)
  const saved = await User.findById(admin._id).lean()
  assert.equal(saved?.telegramUserId, '10001')
  assert.equal(saved?.telegramEnabled, true)
})

test('expired challenges and ineligible, suspended, or revoked accounts are rejected', async () => {
  const expired = await challenge('20001', new Date(Date.now() - 1))
  const admin = await account('active@example.invalid')
  assert.equal(await linking.previewTelegramLink(expired, String(admin._id)), null)

  const customer = await account('customer@example.invalid', { role: 'user' })
  const customerToken = await challenge('20002', new Date(Date.now() + 60_000))
  await assert.rejects(
    linking.previewTelegramLink(customerToken, String(customer._id)),
    (error: unknown) => (error as { code?: string }).code === 'STAFF_NOT_ELIGIBLE'
  )
  const suspended = await account('suspended@example.invalid', { isSuspended: true })
  const suspendedToken = await challenge('20003', new Date(Date.now() + 60_000))
  await assert.rejects(
    linking.consumeTelegramLink(suspendedToken, String(suspended._id)),
    (error: unknown) => (error as { code?: string }).code === 'ACCOUNT_SUSPENDED'
  )
  const revoked = await account('revoked@example.invalid', { telegramRevokedAt: new Date() })
  const revokedToken = await challenge('20004', new Date(Date.now() + 60_000))
  await assert.rejects(linking.consumeTelegramLink(revokedToken, String(revoked._id)))
})

test('concurrent confirmation links a Telegram identity to exactly one account', async () => {
  const [left, right] = await Promise.all([
    account('left@example.invalid'),
    account('right@example.invalid'),
  ])
  const token = await challenge('30001', new Date(Date.now() + 60_000))
  const results = await Promise.allSettled([
    linking.consumeTelegramLink(token, String(left._id)),
    linking.consumeTelegramLink(token, String(right._id)),
  ])
  assert.equal(results.filter(result =>
    result.status === 'fulfilled' && result.value !== null
  ).length, 1)
  assert.equal(await User.countDocuments({ telegramUserId: '30001' }), 1)
  assert.equal(await TelegramLinkChallenge.countDocuments({
    telegramUserId: '30001',
    consumedAt: { $exists: true },
  }), 1)
})
