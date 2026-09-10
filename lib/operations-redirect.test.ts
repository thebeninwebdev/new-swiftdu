import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config, proxy } from '../proxy'

test('suspension preserves tasker signup and API/asset access while redirecting other pages', async (t) => {
  const original = process.env.OPERATIONS_ENABLED
  t.after(() => {
    if (original === undefined) delete process.env.OPERATIONS_ENABLED
    else process.env.OPERATIONS_ENABLED = original
  })
  for (const value of ['false', '', 'FALSE', undefined]) {
    if (value === undefined) delete process.env.OPERATIONS_ENABLED
    else process.env.OPERATIONS_ENABLED = value
    for (const path of ['/', '/about-us', '/auth', '/dashboard', '/admin', '/tasker-dashboard', '/cto-dashboard', '/tasker-signup-other', '/tasker/onboarding', '/unknown?next=/dashboard']) {
      assert.equal(unstable_doesMiddlewareMatch({ config, url: path }), true)
      const response = await proxy(new NextRequest('https://swiftdu.test' + path))
      assert.equal(response.status, 307)
      assert.equal(response.headers.get('location'), 'https://swiftdu.test/suspended')
      assert.equal(response.headers.get('cache-control'), 'no-store')
    }
    for (const path of ['/tasker-signup', '/tasker-signup/', '/tasker-signup/signup', '/tasker-signup/signup?ref=home']) {
      const allowed = await proxy(new NextRequest('https://swiftdu.test' + path))
      assert.equal(allowed.headers.get('location'), null)
      assert.equal(allowed.headers.get('x-middleware-next'), '1')
    }
    const response = await proxy(new NextRequest('https://swiftdu.test/suspended'))
    assert.equal(response.headers.get('location'), null)
    assert.equal(response.headers.get('x-middleware-next'), '1')
  }
  for (const path of ['/api/orders', '/api/orders/123/retry', '/api/auth/get-session', '/logo.png', '/favicon.ico', '/manifest.webmanifest', '/_next/static/app.js', '/_next/image?url=/logo.png']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, url: path }), false)
  }
  process.env.OPERATIONS_ENABLED = 'true'
  const home = await proxy(new NextRequest('https://swiftdu.test/'))
  assert.equal(home.headers.get('x-middleware-next'), '1')
  const resumed = await proxy(new NextRequest('https://swiftdu.test/suspended'))
  assert.equal(resumed.headers.get('location'), 'https://swiftdu.test/')
})
