import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import test from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'

const SECRET = 'test-only-sammy-link-secret-longer-than-32-characters'
const CODE = '12345678'
const nextTenMinutes = () => new Date(Date.now() + 10 * 60_000)
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const otpDigest = (token: string, accountId: string, code = CODE) =>
  createHmac('sha256', SECRET).update(`sammy-portal-v1:${digest(token)}:${accountId}:${code}`).digest('hex')

test('Render-only email linking enforces valid OTP, staff eligibility, and WhatsApp opt-in boundaries', { timeout: 180_000 }, async t => {
  const database = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  process.env.MONGODB_URI = database.getUri('sammy-portal-otp-tests')
  process.env.SAMMY_LINK_OTP_SECRET = SECRET
  process.env.RESEND_API_KEY = 're_test_not_used'
  const { connectDB } = await import('@/lib/db')
  await connectDB()
  const { User } = await import('@/models/user')
  const { TelegramLinkChallenge } = await import('@/models/telegram-link-challenge')
  const { WhatsAppRegistration } = await import('@/models/whatsapp-registration')
  const { SammyPortalOtp } = await import('@/models/sammy-portal-otp')
  const { checkPortalChallenge, confirmPortalCode } = await import('@/lib/sammy/portal-linking')

  t.after(async () => {
    await mongoose.disconnect()
    await database.stop()
    delete process.env.MONGODB_URI
    delete process.env.SAMMY_LINK_OTP_SECRET
    delete process.env.RESEND_API_KEY
  })

  await Promise.all([User.init(), TelegramLinkChallenge.init(), WhatsAppRegistration.init(), SammyPortalOtp.init()])

  async function otp(purpose: 'telegram' | 'whatsapp', token: string, id: unknown) {
    return SammyPortalOtp.create({
      tokenHash: digest(token), purpose, userId: id,
      codeHash: otpDigest(token, String(id)), expiresAt: nextTenMinutes(),
      attempts: 0, sentCount: 1, lastSentAt: new Date(),
    })
  }

  await t.test('wrong Telegram verification codes are capped at five guesses', async () => {
    const token = 'a'.repeat(43)
    const admin = await User.create({
      name: 'Admin One', email: 'admin-one@swiftdu.test', emailVerified: true, role: 'admin',
    })
    await TelegramLinkChallenge.create({
      tokenHash: digest(token), telegramUserId: '70001', telegramChatId: '70001',
      expiresAt: nextTenMinutes(), active: true,
    })
    await otp('telegram', token, admin._id)
    for (let i = 0; i < 5; i++) {
      await assert.rejects(confirmPortalCode('telegram', token, '00000000'),
        (error: unknown) => (error as { code?: string }).code === 'INVALID_CODE')
    }
    await assert.rejects(confirmPortalCode('telegram', token, CODE),
      (error: unknown) => (error as { code?: string }).code === 'CODE_EXPIRED')
    assert.equal((await User.findById(admin._id).lean())?.telegramEnabled, false)
  })

  await t.test('valid staff proof links once using the existing database transaction', async () => {
    const token = 'b'.repeat(43)
    const staff = await User.create({
      name: 'Admin Two', email: 'admin-two@swiftdu.test', emailVerified: true, role: 'admin',
    })
    await TelegramLinkChallenge.create({
      tokenHash: digest(token), telegramUserId: '70002', telegramChatId: '70002',
      expiresAt: nextTenMinutes(), active: true, botUsername: 'SwiftDUOpsBot',
    })
    await otp('telegram', token, staff._id)
    const done = await confirmPortalCode('telegram', token, CODE)
    assert.equal(done.connected, true)
    assert.equal(done.returnUrl, 'https://t.me/SwiftDUOpsBot')
    assert.equal((await User.findById(staff._id).lean())?.telegramUserId, '70002')
    await assert.rejects(confirmPortalCode('telegram', token, CODE),
      (error: unknown) => (error as { code?: string }).code === 'LINK_EXPIRED')
  })

  await t.test('a user with two-factor authentication cannot link Telegram via email alone', async () => {
    const token = 'c'.repeat(43)
    const staff = await User.create({
      name: 'Secure Admin', email: 'secure@swiftdu.test', emailVerified: true,
      role: 'admin', twoFactorEnabled: true,
    })
    await TelegramLinkChallenge.create({
      tokenHash: digest(token), telegramUserId: '70003', telegramChatId: '70003',
      expiresAt: nextTenMinutes(), active: true,
    })
    await otp('telegram', token, staff._id)
    await assert.rejects(confirmPortalCode('telegram', token, CODE),
      (error: unknown) => (error as { code?: string }).code === 'ACCOUNT_NOT_ELIGIBLE')
    assert.equal((await User.findById(staff._id).lean())?.telegramUserId, undefined)
  })

  await t.test('WhatsApp linking is direct to MongoDB and preserves notification opt-out', async () => {
    const token = 'd'.repeat(32)
    const customer = await User.create({
      name: 'Customer', email: 'customer@swiftdu.test', emailVerified: true, role: 'user',
    })
    await WhatsAppRegistration.create({
      token, phone: '2348012345678', tokenIssuedAt: new Date(), status: 'pending',
      whatsappNotificationsEnabled: true,
    })
    await otp('whatsapp', token, customer._id)
    const result = await confirmPortalCode('whatsapp', token, CODE)
    assert.equal(result.connected, true)
    const linked = await WhatsAppRegistration.findOne({ token }).lean()
    assert.equal(linked?.status, 'linked')
    assert.equal(linked?.userId, String(customer._id))
    assert.equal(linked?.whatsappNotificationsEnabled, false)
  })

  await t.test('expired WhatsApp tokens cannot open a connection page', async () => {
    const token = 'e'.repeat(32)
    await WhatsAppRegistration.create({
      token, phone: '2348099999999', tokenIssuedAt: new Date(Date.now() - 48 * 60 * 60_000),
      status: 'pending',
    })
    await assert.rejects(checkPortalChallenge('whatsapp', token),
      (error: unknown) => (error as { code?: string }).code === 'LINK_EXPIRED')
  })
})
