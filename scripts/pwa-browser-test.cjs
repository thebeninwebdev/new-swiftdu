// Run after yarn build. Install playwright-core in .pwa-test (see docs/pwa-migration.md).
// This is an isolated HTTP fixture: it never calls real SwiftDU APIs or sends Web Push.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { chromium } = require(require.resolve('playwright-core', { paths: [path.resolve('.pwa-test'), process.cwd()] }))
const { Server } = require('socket.io')

async function until(check) {
  const end = Date.now() + 15000
  while (Date.now() < end) {
    const value = await check()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw Error('Timed out waiting for browser state')
}
async function main() {
  let legacy = process.env.PWA_TEST_LEGACY === '1'
  let enabled = true
  let revision = 1
  let fail = false
  const requests = []
  const worker = fs.readFileSync('public/sw.js')
  const offline = fs.readFileSync('.next/server/app/offline.html')
  const manifest = fs.readFileSync('.next/server/app/manifest.webmanifest.body')
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    requests.push({ path: url.pathname, method: req.method })
    res.setHeader('Cache-Control', 'public, max-age=3600') // deliberately hostile HTTP-cache test
    if (url.pathname === '/sw.js') {
      res.setHeader('Content-Type', 'application/javascript')
      res.setHeader('Cache-Control', 'no-store')
      return res.end(legacy ? fs.readFileSync('.pwa-test/legacy-sw.js') : worker)
    }
    if (url.pathname.startsWith('/workbox-')) {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end(fs.readFileSync('public/workbox-885b0ec5.js'))
    }
    if (url.pathname.startsWith('/fallback-')) {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end('self.fallback=async r=>r.destination==="document"?caches.match("/offline",{ignoreSearch:true}):Response.error()')
    }
    if (url.pathname === '/sw-push.js') {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end(fs.readFileSync('.pwa-test/legacy-sw-push.js'))
    }
    if (url.pathname === '/offline') {
      res.setHeader('Content-Type', 'text/html')
      return res.end(offline)
    }
    if (url.pathname === '/manifest.webmanifest') {
      res.setHeader('Content-Type', 'application/manifest+json')
      return res.end(manifest)
    }
    if (url.pathname.startsWith('/_next/static/')) {
      const file = path.resolve('.next', decodeURIComponent(url.pathname.slice('/_next/'.length)))
      assert.ok(file.startsWith(path.resolve('.next') + path.sep))
      res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'application/javascript' : 'application/octet-stream')
      return res.end(fs.existsSync(file) ? fs.readFileSync(file) : '/* legacy fixture chunk */')
    }
    if (/^\/(?:logo|pwa-192x192|pwa-512x512|apple-icon)\.png$/.test(url.pathname) || url.pathname === '/mascot/idle.png') {
      res.setHeader('Content-Type', 'image/png')
      return res.end(fs.readFileSync('public' + url.pathname))
    }
    if (url.pathname.startsWith('/api/') || url.searchParams.has('_rsc') || url.pathname.startsWith('/_next/data/')) {
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ revision, method: req.method }))
    }
    res.setHeader('Content-Type', 'text/html')
    if (url.pathname === '/ordering' && !enabled) {
      res.writeHead(307, { Location: '/suspended', 'Cache-Control': 'no-store' })
      return res.end()
    }
    if (fail) { res.statusCode = 503; return res.end('Service unavailable') }
    res.end('<!doctype html><html><head><link rel="manifest" href="/manifest.webmanifest"></head><body>' +
      (url.pathname === '/suspended' ? 'Operations are currently suspended' : 'Ordering revision ' + revision) +
      '<script src="/socket.io/socket.io.js"></script></body></html>')
  })
  const io = new Server(server)
  io.on('connection', socket => socket.emit('order:updated', { revision }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  const browser = await chromium.launch({
    channel: process.env.PWA_BROWSER || 'msedge', headless: true,
  })
  const context = await browser.newContext({ permissions: ['notifications'] })
  const page = await context.newPage()
  try {
    await page.goto(origin + '/ordering')
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      await navigator.serviceWorker.ready
    })
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    if (legacy) {
      await page.evaluate(async () => {
        await (await caches.open('next-data')).put('/api/orders', new Response('STALE'))
        await caches.open('unrelated-precache-' + location.origin + '/')
        await caches.open('another-application')
      })
      legacy = false
      await page.evaluate(async () => {
        const changed = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
        await (await navigator.serviceWorker.getRegistration()).update()
        await changed
      })
      await until(() => page.evaluate(async () => !(await caches.keys()).includes('next-data')))
      const names = await page.evaluate(() => caches.keys())
      assert.ok(!names.includes('next-data'))
      assert.ok(!names.some(name => name.startsWith('workbox-precache-v2-')))
      assert.ok(names.includes('another-application'))
      assert.ok(names.includes('unrelated-precache-' + origin + '/'))
      console.log('PASS real next-pwa worker upgrades in-place; unrelated caches survive')
    }
    assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 1)
    const manifestJson = await page.evaluate(() => fetch('/manifest.webmanifest').then(r => r.json()))
    assert.equal(manifestJson.start_url, '/')
    assert.equal(manifestJson.scope, '/')
    assert.equal(manifestJson.lang, 'en-NG')
    assert.equal(manifestJson.display, 'standalone')
    console.log('PASS manifest, installation, activation, single root registration')
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      registration.active.postMessage({ type: 'SWIFTDU_SHOW_TEST_NOTIFICATION' })
    })
    const notification = await until(() => page.evaluate(async () => {
      const notes = await (await navigator.serviceWorker.ready).getNotifications()
      const note = notes.find(n => n.title === 'Swift DU Local Test')
      if (!note) return false
      const result = { icon: note.icon, badge: note.badge, url: note.data.url }
      notes.forEach(n => n.close())
      return result
    }))
    assert.ok(notification.icon.includes('/pwa-512x512.png'))
    assert.ok(notification.badge.includes('/pwa-192x192.png'))
    assert.equal(notification.url, origin + '/tasker-dashboard')
    console.log('PASS local message displays a browser notification with branding and target')
    await page.reload()
    assert.match(await page.textContent('body'), /Ordering/)
    enabled = false
    revision++
    await page.reload()
    assert.equal(new URL(page.url()).pathname, '/suspended')
    assert.match(await page.textContent('body'), /Operations are currently suspended/)
    console.log('PASS warmed ordering navigation observes current suspended redirect')
    const apis = ['/api/auth/get-session', '/api/orders', '/api/orders/1', '/api/orders/available',
      '/api/taskers/availability', '/api/taskers/me', '/api/orders/1/pay-platform-fee/verify',
      '/api/paystack/banks', '/api/admin/orders', '/api/push/public-key', '/api/operations',
      '/_next/data/build/dashboard.json', '/dashboard?_rsc=test']
    for (const url of apis) {
      const first = await page.evaluate(url => fetch(url).then(r => r.json()), url)
      revision++
      const second = await page.evaluate(url => fetch(url).then(r => r.json()), url)
      assert.equal(second.revision, revision)
      assert.notEqual(first.revision, second.revision)
    }
    console.log('PASS APIs, session, payment, task availability and RSC bypass HTTP/SW caches')
    const socketRevision = await page.evaluate(() => new Promise((resolve, reject) => {
      const socket = window.io({ transports: ['polling', 'websocket'] })
      const timer = setTimeout(() => reject(Error('Socket.IO timeout')), 10000)
      socket.on('order:updated', data => { clearTimeout(timer); socket.disconnect(); resolve(data.revision) })
      socket.on('connect_error', reject)
    }))
    assert.equal(socketRevision, revision)
    console.log('PASS Socket.IO polling and order event')
    fail = true
    const failure = await page.goto(origin + '/server-failure')
    assert.equal(failure.status(), 503)
    assert.match(await page.textContent('body'), /Service unavailable/)
    fail = false
    console.log('PASS HTTP server errors are not replaced by offline success')
    await page.evaluate(() => fetch('/mascot/idle.png').then(r => r.arrayBuffer()))
    await until(() => page.evaluate(async () => !!await (await caches.open('swiftdu-images-v1')).match('/mascot/idle.png')))
    const cachedUrls = await page.evaluate(async () => {
      const names = (await caches.keys()).filter(name => name.startsWith('swiftdu') || name.startsWith('serwist-precache-'))
      return (await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname)))).flat()
    })
    assert.ok(cachedUrls.includes('/offline'))
    assert.ok(!cachedUrls.some(url => url.startsWith('/api/') || url === '/ordering' || url === '/suspended' || url.startsWith('/_next/data/')))
    await context.setOffline(true)
    await page.goto(origin + '/never-visited')
    assert.match(await page.textContent('body'), /internet connection to place and manage orders/)
    assert.equal(await page.locator('button', { hasText: 'Try again' }).count(), 1)
    assert.equal(await page.evaluate(() => fetch('/mascot/idle.png').then(r => r.ok)), true)
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      assert.equal(await page.evaluate(async method => {
        try { await fetch('/api/orders', { method, body: '{}' }); return 'success' } catch { return 'failed' }
      }, method), 'failed')
    }
    for (const url of apis) {
      assert.equal(await page.evaluate(async url => {
        try { await fetch(url); return 'success' } catch { return 'failed' }
      }, url), 'failed')
    }
    console.log('PASS offline fallback, rendered retry, static assets, API and mutation failure')
    const before = requests.filter(r => r.path === '/api/orders' && r.method !== 'GET').length
    await context.setOffline(false)
    await page.getByRole('button', { name: 'Try again' }).click()
    await page.waitForFunction(() => document.body.textContent.includes('Ordering revision'))
    assert.equal(requests.filter(r => r.path === '/api/orders' && r.method !== 'GET').length, before)
    console.log('PASS retry returns to network; no mutation replay')
  } finally {
    await browser.close()
    await new Promise(resolve => io.close(resolve))
    server.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
