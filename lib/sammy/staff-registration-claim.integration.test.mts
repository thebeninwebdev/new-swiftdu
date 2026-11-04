import assert from 'node:assert/strict'
import { test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

test('a provisional staff-created customer securely claims the existing record by magic link', { timeout: 120_000 }, async (t) => {
  const database = await MongoMemoryServer.create()
  process.env.MONGODB_URI = database.getUri('sammy-staff-claim')
  process.env.AUTH_SEND_REAL_EMAILS = 'false'
  process.env.BETTER_AUTH_SECRET = 'staff-registration-test-secret-at-least-32-characters'
  await mongoose.connect(process.env.MONGODB_URI)
  const { User } = await import('@/models/user')
  const { auth } = await import('@/lib/auth')
  const { default: clientPromise } = await import('@/lib/db')
  t.after(async () => {
    await Promise.race([
      Promise.allSettled([
        mongoose.disconnect(),
        (await clientPromise).close(true),
        database.stop({ doCleanup: true, force: true }),
      ]),
      new Promise(resolve => setTimeout(resolve, 2_000)),
    ])
  })

  const provisional = await User.create({
    email: 'claim@example.com', emailVerified: false, role: 'user', phone: '2348012345678',
    phones: [{ number: '2348012345678', normalizedNumber: '2348012345678', type: 'primary', verified: false }],
    customerSource: 'staff_telegram', createdByStaffId: new mongoose.Types.ObjectId().toString(),
  })
  let claimToken = ''
  const originalInfo = console.info
  console.info = (...args: unknown[]) => {
    originalInfo(...args)
    const details = args[1] as { url?: string } | undefined
    if (args[0] === '[magic-link:development]' && details?.url) {
      claimToken = new URL(details.url).searchParams.get('token') || ''
    }
  }
  try {
    await auth.api.signInMagicLink({ body: { email: 'claim@example.com' }, headers: new Headers() })
  } catch (error) {
    console.error('[claim test sign-in failure]', error)
    throw error
  } finally {
    console.info = originalInfo
  }
  assert.ok(claimToken)
  let claimed
  try {
    claimed = await auth.api.magicLinkVerify({ query: { token: claimToken }, headers: new Headers() })
  } catch (error) {
    console.error('[claim test verification failure]', error)
    throw error
  }
  assert.equal(claimed.user.id, String(provisional._id))
  assert.equal(claimed.user.emailVerified, true)
  assert.equal(await User.countDocuments({ email: 'claim@example.com' }), 1)
  assert.equal((await User.findById(provisional._id).lean())?.emailVerified, true)
})
