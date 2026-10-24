import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config, getTaskerDashboardRouteForRole, proxy } from '../proxy'
import { isCustomerOperationRoute } from './operations'

test('suspension blocks public pages while leaving authentication and tasker routes available', async (t) => {
  const original = process.env.OPERATIONS_ENABLED
  t.after(() => {
    if (original === undefined) delete process.env.OPERATIONS_ENABLED
    else process.env.OPERATIONS_ENABLED = original
  })

  for (const value of ['false', '', 'FALSE', undefined]) {
    if (value === undefined) delete process.env.OPERATIONS_ENABLED
    else process.env.OPERATIONS_ENABLED = value

    for (const path of ['/', '/dashboard', '/dashboard/tasks', '/tasks', '/available-tasks']) {
      assert.equal(isCustomerOperationRoute(path), true)
    }
    for (const path of ['/auth', '/tasker-signup', '/admin', '/tasker-dashboard']) {
      assert.equal(isCustomerOperationRoute(path), false)
    }

    const home = await proxy(new NextRequest('https://swiftdu.test/'))
    assert.equal(home.headers.get('location'), 'https://swiftdu.test/suspended')
    assert.equal(home.headers.get('cache-control'), 'no-store')

    for (const path of ['/businesses', '/about-us', '/contact-us', '/terms']) {
      const blocked = await proxy(new NextRequest('https://swiftdu.test' + path))
      assert.equal(blocked.headers.get('location'), 'https://swiftdu.test/suspended')
      assert.equal(blocked.headers.get('cache-control'), 'no-store')
    }

    for (const path of ['/auth', '/login', '/signup', '/password/reset', '/complete-profile', '/tasker-signup', '/tasker-signup/signup', '/suspended', '/offline']) {
      const allowed = await proxy(new NextRequest('https://swiftdu.test' + path))
      assert.equal(allowed.headers.get('location'), null)
      assert.equal(allowed.headers.get('x-middleware-next'), '1')
    }

    const taskerDashboard = await proxy(new NextRequest('https://swiftdu.test/tasker-dashboard'))
    assert.notEqual(taskerDashboard.headers.get('location'), 'https://swiftdu.test/suspended')

    const customerDashboard = await proxy(new NextRequest('https://swiftdu.test/dashboard'))
    assert.notEqual(customerDashboard.headers.get('location'), 'https://swiftdu.test/suspended')
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

test('tasker dashboard redirects non-taskers directly to onboarding, never through customer routes', () => {
  assert.equal(getTaskerDashboardRouteForRole('tasker'), null)
  assert.equal(getTaskerDashboardRouteForRole('user'), '/tasker-signup')
  assert.equal(getTaskerDashboardRouteForRole(undefined), '/tasker-signup')
  assert.equal(getTaskerDashboardRouteForRole('admin'), '/admin')
  assert.equal(getTaskerDashboardRouteForRole('user', 'COO'), '/admin')
})
