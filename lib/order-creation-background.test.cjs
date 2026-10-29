const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')
const ts = require('typescript')
const vm = require('node:vm')

const source = fs.readFileSync('lib/order-creation-background.ts', 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exportsObject = {}
vm.runInNewContext(compiled, {
  exports: exportsObject,
  module: { exports: exportsObject },
  require: (name) => name === '@vercel/functions' ? { waitUntil: () => {} } : require(name),
  console,
  performance,
})

const { persistThenScheduleOrderCreation } = exportsObject
const quietLogger = { info: () => {}, error: () => {} }

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function harness(jobs, persist = async () => ({ _id: 'order-1' })) {
  let backgroundWork
  const result = persistThenScheduleOrderCreation({
    persist,
    getOrderId: (order) => order._id,
    createJobs: () => jobs,
    schedule: (promise) => { backgroundWork = promise },
    logger: quietLogger,
  })
  return { result, getBackgroundWork: () => backgroundWork }
}

test('MongoDB persistence completes before notification scheduling or delivery starts', async () => {
  const events = []
  let backgroundWork
  const result = await persistThenScheduleOrderCreation({
    persist: async () => {
      events.push('commit:start')
      await Promise.resolve()
      events.push('commit:complete')
      return { _id: 'order-1' }
    },
    getOrderId: (order) => order._id,
    createJobs: () => [{ channel: 'push', run: () => { events.push('push:start') } }],
    schedule: (promise) => {
      events.push('schedule')
      backgroundWork = promise
    },
    logger: quietLogger,
  })

  assert.equal(result._id, 'order-1')
  assert.deepEqual(events.slice(0, 3), ['commit:start', 'commit:complete', 'schedule'])
  await backgroundWork
  assert.ok(events.indexOf('push:start') > events.indexOf('commit:complete'))
})

for (const channel of ['telegram', 'push']) {
  test(`successful order creation returns without waiting for ${channel}`, async () => {
    const delivery = deferred()
    const { result, getBackgroundWork } = harness([{ channel, run: () => delivery.promise }])

    assert.equal((await result)._id, 'order-1')
    assert.ok(getBackgroundWork())
    delivery.resolve()
    await getBackgroundWork()
  })
}

for (const channel of ['telegram', 'push', 'realtime']) {
  test(`${channel} failure after commit does not change successful order creation`, async () => {
    const errors = []
    let backgroundWork
    const result = await persistThenScheduleOrderCreation({
      persist: async () => ({ _id: 'order-1' }),
      getOrderId: (order) => order._id,
      createJobs: () => [{ channel, run: async () => { throw new Error(`${channel} unavailable`) } }],
      schedule: (promise) => { backgroundWork = promise },
      logger: { info: () => {}, error: (...args) => { errors.push(args) } },
    })

    assert.equal(result._id, 'order-1')
    await backgroundWork
    assert.equal(errors.length, 1)
    assert.match(JSON.stringify(errors[0]), new RegExp(`${channel} unavailable`))
  })
}

test('Push and Telegram background jobs start concurrently', async () => {
  const push = deferred()
  const telegram = deferred()
  const started = []
  const { result, getBackgroundWork } = harness([
    { channel: 'push', run: () => { started.push('push'); return push.promise } },
    { channel: 'telegram', run: () => { started.push('telegram'); return telegram.promise } },
  ])

  await result
  await Promise.resolve()
  assert.deepEqual(started, ['push', 'telegram'])
  push.resolve()
  telegram.resolve()
  await getBackgroundWork()
})

test('failed MongoDB persistence schedules no notifications', async () => {
  let jobsCreated = false
  let scheduled = false
  await assert.rejects(
    persistThenScheduleOrderCreation({
      persist: async () => { throw new Error('database unavailable') },
      getOrderId: () => 'never',
      createJobs: () => { jobsCreated = true; return [] },
      schedule: () => { scheduled = true },
      logger: quietLogger,
    }),
    /database unavailable/
  )
  assert.equal(jobsCreated, false)
  assert.equal(scheduled, false)
})

test('order idempotency retains its unique sparse user/key index', () => {
  const modelSource = fs.readFileSync('models/order.ts', 'utf8')
  assert.match(modelSource, /orderSchema\.index\(\{ userId: 1, idempotencyKey: 1 \}, \{ unique: true, sparse: true \}\)/)
})

test('creation wiring retains training/live and gender notification routing', () => {
  const routeSource = fs.readFileSync('app/api/orders/route.ts', 'utf8')
  assert.match(routeSource, /taskerGenderRestriction: persistedOrder\.taskerGenderRestriction \|\| null/)
  assert.match(routeSource, /taskerMode: persistedOrder\.isTestOrder \? 'training' : 'live'/)
  assert.match(routeSource, /notifyAdminsOfOrderEvent\(\{[\s\S]*?order: persistedOrder/)
})

test('creation wiring keeps first-order transactions and idempotent retry handling', () => {
  const routeSource = fs.readFileSync('app/api/orders/route.ts', 'utf8')
  assert.match(routeSource, /await saveNewOrderWithBonus\(order, pricing\)/)
  assert.match(routeSource, /Order\.findOne\(\{ userId: customerActor\.id, idempotencyKey \}\)\.lean\(\)/)
  assert.match(routeSource, /\(error as \{ code\?: number \}\)\.code === 11000/)
})
