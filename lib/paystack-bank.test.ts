import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BankDetailsError, initializePaystackTransaction, listPaystackBanks, parseBankAccount, resolvePaystackBankAccount, verifyPaystackTransaction } from './paystack'
import Tasker from '../models/tasker'

test('server validates strings and preserves leading zeroes', () => {
  assert.deepEqual(parseBankAccount({ bankCode: ' 999 ', accountNumber: ' 0123456789 ' }), { bankCode: '999', accountNumber: '0123456789' })
  for (const input of [null, [], { bankCode: '999', accountNumber: 1234567890 }, { bankCode: '999', accountNumber: '01234x56789' }, { bankCode: '999&other=1', accountNumber: '0123456789' }, { bankCode: '999', accountNumber: '012345678' }]) {
    assert.throws(() => parseBankAccount(input), (error: unknown) => error instanceof BankDetailsError && error.status === 400)
  }
})

test('bank listing, resolution and existing payments use server-side Paystack requests', async (t) => {
  const previous = process.env.PAYSTACK_SECRET_KEY
  process.env.PAYSTACK_SECRET_KEY = 'test-secret-placeholder'
  t.after(() => {
    if (previous === undefined) delete process.env.PAYSTACK_SECRET_KEY
    else process.env.PAYSTACK_SECRET_KEY = previous
  })
  let bankCalls = 0
  let resolutionCalls = 0
  let resolutionFails = false
  let wrongNumber = false
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-secret-placeholder')
    const parsed = new URL(String(url))
    if (parsed.pathname === '/bank') {
      bankCalls++
      assert.equal(parsed.searchParams.get('country'), 'nigeria')
      if (parsed.searchParams.get('next')) return Response.json({ status: true, data: [{ name: 'Another Bank', code: '998' }], meta: { next: null } })
      return Response.json({ status: true, data: [{ name: 'Test Bank', code: '999' }, { name: 'Inactive', code: '997', active: false }], meta: { next: 'page-two' } })
    }
    if (parsed.pathname === '/bank/resolve') {
      resolutionCalls++
      assert.equal(parsed.searchParams.get('account_number'), '0123456789')
      if (resolutionFails) return Response.json({ status: false, message: 'Sensitive provider error' }, { status: 400 })
      return Response.json({ status: true, data: { account_name: ' VERIFIED NAME ', account_number: wrongNumber ? '9999999999' : '0123456789' } })
    }
    if (parsed.pathname === '/transaction/initialize') {
      assert.equal(JSON.parse(String(init?.body)).currency, 'NGN')
      return Response.json({ status: true, data: { reference: 'payment-test' } })
    }
    if (parsed.pathname === '/transaction/verify/payment-test') return Response.json({ status: true, data: { status: 'success' } })
    throw new Error('Unexpected endpoint')
  })
  assert.deepEqual(await listPaystackBanks(), [{ name: 'Another Bank', code: '998' }, { name: 'Test Bank', code: '999' }])
  await listPaystackBanks()
  assert.equal(bankCalls, 2, 'all pages are fetched once and cached')
  const input = { bankCode: '999', accountNumber: '0123456789', accountName: 'FORGED NAME', bankName: 'FORGED BANK' }
  const details = await resolvePaystackBankAccount(input)
  assert.deepEqual(details, { bankCode: '999', accountNumber: '0123456789', accountName: 'VERIFIED NAME', bankName: 'Test Bank' })
  await resolvePaystackBankAccount(input)
  assert.equal(resolutionCalls, 2, 'saving must make a fresh resolution request')
  await assert.rejects(resolvePaystackBankAccount({ ...input, bankCode: '997' }), (error: unknown) => error instanceof BankDetailsError && error.status === 400)
  wrongNumber = true
  await assert.rejects(resolvePaystackBankAccount(input), BankDetailsError)
  wrongNumber = false
  resolutionFails = true
  await assert.rejects(resolvePaystackBankAccount(input), (error: unknown) => error instanceof BankDetailsError && !error.message.includes('Sensitive'))
  assert.equal((await initializePaystackTransaction({ amount: 100, email: 'test@example.invalid', reference: 'payment-test', callback_url: 'https://example.invalid' })).data?.reference, 'payment-test')
  assert.equal((await verifyPaystackTransaction('payment-test')).data?.status, 'success')
})

test('legacy tasker bank records remain valid without a bank code', () => {
  const legacy = new Tasker({ phone: '08012345678', location: 'Campus', studentId: '123', bankDetails: { bankName: 'Old Bank', accountNumber: '0123456789', accountName: 'OLD NAME' } })
  assert.equal(legacy.validateSync(), undefined)
  assert.equal(legacy.bankDetails.accountName, 'OLD NAME')
  assert.equal(legacy.bankDetails.bankCode, undefined)
  legacy.bankDetails.bankCode = '999'
  assert.equal(legacy.toObject().bankDetails.bankCode, '999')
})
