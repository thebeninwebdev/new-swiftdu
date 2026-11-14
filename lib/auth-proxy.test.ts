import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { handleProxy } from '../proxy'

test('proxy preserves the intended destination for a confirmed unauthenticated session', async () => {
  process.env.OPERATIONS_ENABLED = 'true'
  const response = await handleProxy(
    new NextRequest('https://www.swiftdu.org/tasker-dashboard/ORDER_ID?accept=1'),
    async () => null,
  )
  const location = new URL(response.headers.get('location')!)
  assert.equal(location.pathname, '/auth')
  assert.equal(location.searchParams.get('next'), '/tasker-dashboard/ORDER_ID?accept=1')
})

test('proxy fails closed without sending a temporarily unverifiable session to login', async () => {
  process.env.OPERATIONS_ENABLED = 'true'
  const response = await handleProxy(
    new NextRequest('https://www.swiftdu.org/dashboard'),
    async () => { throw new Error('temporary database failure') },
  )
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('location'), null)
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
  assert.equal(response.headers.get('retry-after'), '5')
})

test('proxy and homepage role destinations agree for authenticated users', async () => {
  process.env.OPERATIONS_ENABLED = 'true'
  const adminOnTaskerRoute = await handleProxy(
    new NextRequest('https://www.swiftdu.org/tasker-dashboard'),
    async () => ({ user: { id: 'admin-1', role: 'admin' } }),
  )
  assert.equal(adminOnTaskerRoute.headers.get('location'), 'https://www.swiftdu.org/admin')

  const taskerOnTaskerRoute = await handleProxy(
    new NextRequest('https://www.swiftdu.org/tasker-dashboard'),
    async () => ({ user: { id: 'tasker-1', role: 'tasker' } }),
  )
  assert.equal(taskerOnTaskerRoute.headers.get('location'), null)
})
