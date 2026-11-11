import assert from 'node:assert/strict'
import { test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

test('same-browser email OTP signs in existing and new accounts once without bypassing suspension', { timeout: 120_000 }, async (t) => {
  const database = await MongoMemoryServer.create()
  process.env.MONGODB_URI = database.getUri('auth-email-otp')
  process.env.AUTH_SEND_REAL_EMAILS = 'false'
  process.env.BETTER_AUTH_SECRET = 'email-otp-test-secret-at-least-32-characters'
  process.env.NODE_ENV = 'test'
  await mongoose.connect(process.env.MONGODB_URI)
  const { User } = await import('@/models/user')
  const { auth } = await import('@/lib/auth')
  const { closeMongoClient } = await import('@/lib/db')
  const testGlobal = globalThis as typeof globalThis & { __captureSwiftDUEmailOtp?: (otp: string) => void }
  t.after(async () => {
    delete testGlobal.__captureSwiftDUEmailOtp
    await Promise.allSettled([mongoose.disconnect(), closeMongoClient(), database.stop()])
  })

  await User.create({ email: 'existing@example.com', emailVerified: true, role: 'user' })
  let otp = ''
  testGlobal.__captureSwiftDUEmailOtp = value => { otp = value }
  await auth.api.sendVerificationOTP({ body: { email: 'existing@example.com', type: 'sign-in' }, headers: new Headers() })
  assert.match(otp, /^\d{6}$/)
  const existing = await auth.api.signInEmailOTP({ body: { email: 'existing@example.com', otp }, headers: new Headers() })
  assert.equal(existing.user.email, 'existing@example.com')
  await assert.rejects(auth.api.signInEmailOTP({ body: { email: 'existing@example.com', otp }, headers: new Headers() }))

  otp = ''
  await auth.api.sendVerificationOTP({ body: { email: 'new@example.com', type: 'sign-in' }, headers: new Headers() })
  const created = await auth.api.signInEmailOTP({ body: { email: 'new@example.com', otp }, headers: new Headers() })
  assert.equal(created.user.email, 'new@example.com')
  assert.equal(await User.countDocuments({ email: 'new@example.com' }), 1)

  await User.create({ email: 'suspended@example.com', emailVerified: true, role: 'user', isSuspended: true })
  await assert.rejects(
    auth.api.sendVerificationOTP({ body: { email: 'suspended@example.com', type: 'sign-in' }, headers: new Headers() }),
    (error: unknown) => (error as { status?: string; body?: { code?: string } }).body?.code === 'USER_SUSPENDED'
  )
})