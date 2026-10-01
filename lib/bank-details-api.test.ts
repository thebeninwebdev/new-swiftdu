import assert from 'node:assert/strict'
import { createRequire, Module } from 'node:module'
import { test } from 'node:test'
import { NextRequest } from 'next/server'

test('bank APIs require sign-in and save only server-resolved names for the current tasker', async (t) => {
  const require = createRequire(import.meta.url)
  let signedIn = true
  let role = 'tasker'
  let saveCount = 0
  let shouldFail = false
  const tasker = {
    bankDetails: { bankName: 'Legacy Bank', accountNumber: '0123456789', accountName: 'LEGACY NAME' },
    async save() { saveCount++ },
  }
  const stubs: Record<string, unknown> = {
    './auth': { auth: { api: { getSession: async () => signedIn ? { user: { id: 'current-user' } } : null } } },
    './db': { connectDB: async () => {} },
    '../models/user': { User: { findById: (id: string) => {
      assert.equal(id, 'current-user')
      return { select: () => ({ lean: async () => ({ _id: id, role }) }) }
    } } },
    '../models/tasker': { __esModule: true, default: { findOne: async (query: { userId: string }) => {
      assert.equal(query.userId, 'current-user')
      return tasker
    } } },
  }
  for (const [path, exports] of Object.entries(stubs)) {
    const id = require.resolve(path)
    const previous = require.cache[id]
    const stub = new Module(id)
    stub.exports = exports
    stub.loaded = true
    require.cache[id] = stub
    t.after(() => { if (previous) require.cache[id] = previous; else delete require.cache[id] })
  }
  const previousSecret = process.env.PAYSTACK_SECRET_KEY
  process.env.PAYSTACK_SECRET_KEY = 'test-secret-placeholder'
  t.after(() => {
    if (previousSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY
    else process.env.PAYSTACK_SECRET_KEY = previousSecret
  })
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    if (String(url).includes('/bank?')) return Response.json({ status: true, data: [{ name: 'Test Bank', code: '999' }] })
    if (shouldFail) return Response.json({ status: false, message: 'Private provider error' }, { status: 400 })
    return Response.json({ status: true, data: { account_number: '0123456789', account_name: 'PAYSTACK NAME' } })
  })
  const { PATCH } = require('../app/api/taskers/me/bank-details/route') as { PATCH: (request: NextRequest) => Promise<Response> }
  const { POST } = require('../app/api/paystack/resolve-account/route') as { POST: (request: NextRequest) => Promise<Response> }
  const { GET } = require('../app/api/paystack/banks/route') as { GET: (request: NextRequest) => Promise<Response> }
  const request = (body: unknown) => new NextRequest('http://localhost/api/taskers/me/bank-details', {
    method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  })
  const input = { bankCode: '999', accountNumber: '0123456789', accountName: 'FORGED NAME', bankName: 'FORGED BANK', taskerId: 'someone-else' }
  signedIn = false
  assert.equal((await PATCH(request(input))).status, 401)
  assert.equal((await POST(request(input))).status, 401)
  assert.equal((await GET(new NextRequest('http://localhost/api/paystack/banks'))).status, 401)
  assert.equal(fetchMock.mock.callCount(), 0)
  signedIn = true
  assert.equal((await PATCH(request({ ...input, accountNumber: '123' }))).status, 400)
  role = 'user'
  assert.equal((await PATCH(request(input))).status, 403)
  role = 'tasker'
  assert.deepEqual(await (await POST(request(input))).json(), { success: true, accountName: 'PAYSTACK NAME' })
  const response = await PATCH(request(input))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).bankDetails, {
    bankName: 'Test Bank', bankCode: '999', accountNumber: '0123456789', accountName: 'PAYSTACK NAME',
  })
  assert.equal(saveCount, 1)
  shouldFail = true
  const failure = await PATCH(request(input))
  assert.equal(failure.status, 502)
  assert.equal(saveCount, 1)
  assert.equal(tasker.bankDetails.accountName, 'PAYSTACK NAME')
  assert.ok(!(await failure.text()).includes('Private provider error'))
})
