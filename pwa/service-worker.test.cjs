const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, globals, modules) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  vm.runInNewContext(js, { exports, require: name => modules[name] || {}, URL, Request, console, ...globals }, { filename: file })
  return exports
}
function worker() {
  const events = {}
  const shown = []
  const opened = []
  let focused = 0
  let clients = []
  const deleted = []
  let config
  const origin = 'https://swiftdu.test'
  class Strategy {
    constructor(options = {}) { this.options = options; this.plugins = options.plugins || [] }
  }
  const globals = {
    self: {
      location: { origin },
      registration: { scope: origin + '/', navigationPreload: { disable: async () => {} },
        showNotification: async (title, options) => { shown.push({ title, ...options }) } },
      clients: { matchAll: async () => clients, openWindow: async url => { opened.push(url) } },
      addEventListener: (type, listener) => { (events[type] ||= []).push(listener) },
    },
    caches: { keys: async () => ['next-data', 'cross-origin', 'workbox-precache-v2-' + origin + '/', 'another-application', 'unrelated-precache-' + origin + '/'],
      delete: async name => { deleted.push(name); return true } },
  }
  load('app/sw.ts', globals, { serwist: {
    CacheFirst: Strategy, StaleWhileRevalidate: Strategy, NetworkOnly: Strategy,
    CacheableResponsePlugin: Strategy, ExpirationPlugin: Strategy,
    Serwist: class { constructor(options) { config = options } addEventListeners() {} },
  } })
  return {
    shown, opened, deleted, config,
    setClients: values => { clients = values },
    client: url => ({ url, focus: async () => { focused++ } }),
    focused: () => focused,
    async dispatch(type, input = {}) {
      const promises = []
      for (const callback of events[type] || []) callback({ ...input, waitUntil: p => promises.push(p) })
      await Promise.all(promises)
    },
  }
}

test('push preserves title, body, images, tag and safe destination; malformed push remains visible', async () => {
  const sw = worker()
  await sw.dispatch('push', { data: { json: () => ({ title: 'Order update', body: 'Assigned', tag: 'order-123', url: '/dashboard/tasks/123', image: '/logo.png' }) } })
  assert.equal(sw.shown[0].title, 'Order update')
  assert.equal(sw.shown[0].body, 'Assigned')
  assert.equal(sw.shown[0].tag, 'order-123')
  assert.equal(sw.shown[0].image, 'https://swiftdu.test/logo.png')
  assert.equal(sw.shown[0].data.url, 'https://swiftdu.test/dashboard/tasks/123')
  assert.match(sw.shown[0].icon, /pwa-512x512/)
  assert.match(sw.shown[0].badge, /pwa-192x192/)
  await sw.dispatch('push', { data: { json: () => { throw Error('invalid JSON') } } })
  assert.equal(sw.shown[1].title, 'SwiftDU')
  await sw.dispatch('push', { data: { json: () => ({ url: 'https://unrelated.test', title: 123 }) } })
  assert.equal(sw.shown[2].data.url, 'https://swiftdu.test/tasker-dashboard')
})
test('notification click focuses exact destination or opens it; local test message remains supported', async () => {
  const sw = worker()
  const target = 'https://swiftdu.test/dashboard/tasks/123'
  sw.setClients([sw.client(target)])
  let closed = 0
  const notification = { data: { url: target }, close: () => { closed++ } }
  await sw.dispatch('notificationclick', { notification })
  assert.equal(sw.focused(), 1)
  assert.equal(sw.opened.length, 0)
  sw.setClients([])
  await sw.dispatch('notificationclick', { notification })
  assert.equal(sw.opened[0], target)
  assert.equal(closed, 2)
  await sw.dispatch('message', { data: { type: 'SWIFTDU_SHOW_TEST_NOTIFICATION' } })
  assert.equal(sw.shown[0].title, 'Swift DU Local Test')
})
test('activation only deletes audited legacy caches and navigation requests bypass HTTP cache', async () => {
  const sw = worker()
  await sw.dispatch('activate')
  assert.deepEqual(sw.deleted.sort(), ['cross-origin', 'next-data', 'workbox-precache-v2-https://swiftdu.test/'].sort())
  const request = new Request('https://swiftdu.test/dashboard')
  const hook = sw.config.runtimeCaching[0].handler.plugins[0].requestWillFetch
  assert.equal((await hook({ request })).cache, 'no-store')
})

for (const scenario of ['compatible', 'missing', 'incompatible', 'legacy-script', 'development']) {
  test('push subscription lifecycle: ' + scenario, async () => {
    let callback
    let unsubscribed = 0
    let subscribed = 0
    let registered = 0
    const saved = []
    const key = new Uint8Array([4, 1, 2, 3])
    const old = { endpoint: 'https://push.test/existing', options: { applicationServerKey: scenario === 'incompatible' ? new Uint8Array([5]).buffer : key.buffer },
      unsubscribe: async () => { unsubscribed++ }, toJSON: () => ({ endpoint: 'https://push.test/existing' }) }
    const fresh = { endpoint: 'https://push.test/new' }
    const registration = {
      active: { scriptURL: 'https://swiftdu.test/' + (scenario === 'legacy-script' ? 'service-worker.js' : 'sw.js') },
      update: async () => {},
      unregister: async () => { throw Error('Must preserve registration') },
      pushManager: { getSubscription: async () => scenario === 'missing' ? null : old,
        subscribe: async () => { subscribed++; return fresh } },
    }
    const exports = load('components/PushSubscriptionManager.tsx', {
      process: { env: { NODE_ENV: scenario === 'development' ? 'development' : 'production' } },
      window: { location: { origin: 'https://swiftdu.test' }, atob: value => Buffer.from(value, 'base64').toString('binary'),
        setTimeout: () => 0, PushManager: function () {}, Notification: {} },
      navigator: { serviceWorker: { getRegistration: async () => registration, ready: Promise.resolve(registration),
        register: async () => { registered++; return registration } } },
      Notification: { permission: 'granted' },
      fetch: async (url, options) => {
        if (url === '/api/push/public-key') return { ok: true, json: async () => ({ publicKey: Buffer.from(key).toString('base64url') }) }
        assert.equal(url, '/api/push/save-subscription')
        assert.equal(options.method, 'POST')
        saved.push(JSON.parse(options.body))
        return { ok: true }
      },
    }, { react: { useCallback: fn => { callback = fn; return fn }, useEffect: () => {}, useState: () => [false, () => {}] },
      '@/lib/auth-client': { authClient: { useSession: () => ({ data: { user: { id: 'test-tasker' } }, isPending: false }) } } })
    exports.PushSubscriptionManager()
    await callback(false)
    assert.equal(unsubscribed, scenario === 'incompatible' ? 1 : 0)
    assert.equal(subscribed, ['incompatible', 'missing'].includes(scenario) ? 1 : 0)
    assert.equal(registered, scenario === 'legacy-script' ? 1 : 0)
    assert.equal(saved.length, scenario === 'development' ? 0 : 1)
    if (saved.length) assert.equal(saved[0].endpoint, ['incompatible', 'missing'].includes(scenario) ? fresh.endpoint : old.endpoint)
  })
}
