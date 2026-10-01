import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scheduleBankVerification } from './bank-verification'

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

test('incomplete account numbers and missing banks never request resolution', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request') })
  for (const number of ['', '012345678', '01234567890', '01234abc89']) {
    scheduleBankVerification('999', number, assert.fail, assert.fail)
  }
  scheduleBankVerification('', '0123456789', assert.fail, assert.fail)
  t.mock.timers.tick(1000)
  await flush()
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('debounces verification and resolves the account name', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { bankCode: '999', accountNumber: '0123456789' })
    return Response.json({ success: true, accountName: 'VERIFIED NAME' })
  })
  let name = ''
  scheduleBankVerification('999', '0123456789', (value) => { name = value }, assert.fail)
  t.mock.timers.tick(399)
  assert.equal(fetchMock.mock.callCount(), 0)
  t.mock.timers.tick(1)
  await flush()
  assert.equal(name, 'VERIFIED NAME')
})

test('cancelling while debouncing makes no API call', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request') })
  const cancel = scheduleBankVerification('999', '0123456789', assert.fail, assert.fail)
  cancel()
  t.mock.timers.tick(400)
  await flush()
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('old responses cannot overwrite the newest account even if fetch ignores abort', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let finishOld!: (response: Response) => void
  let oldSignal: AbortSignal | null | undefined
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    if (++calls === 1) {
      oldSignal = init?.signal
      return new Promise<Response>((resolve) => { finishOld = resolve })
    }
    return Response.json({ success: true, accountName: 'NEW ACCOUNT' })
  })
  const names: string[] = []
  const cancel = scheduleBankVerification('999', '0123456789', (name) => names.push(name), assert.fail)
  t.mock.timers.tick(400)
  cancel()
  scheduleBankVerification('998', '0123456788', (name) => names.push(name), assert.fail)
  t.mock.timers.tick(400)
  await flush()
  finishOld(Response.json({ success: true, accountName: 'OLD ACCOUNT' }))
  await flush()
  assert.equal(oldSignal?.aborted, true)
  assert.deepEqual(names, ['NEW ACCOUNT'])
})

test('failed or empty resolutions never report verification success', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const responses = [Response.json({ error: 'provider detail' }, { status: 502 }), Response.json({ success: true, accountName: '' })]
  t.mock.method(globalThis, 'fetch', async () => responses.shift()!)
  let failures = 0
  for (let index = 0; index < 2; index++) {
    scheduleBankVerification('999', '0123456789', assert.fail, () => { failures++ })
    t.mock.timers.tick(400)
    await flush()
  }
  assert.equal(failures, 2)
})
