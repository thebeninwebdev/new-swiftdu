import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveSammyRoute } from './sammy-routes.mts'

const cases = [
  ['POST', '/api/internal/sammy/staff/auth', 'staff-auth'],
  ['POST', '/api/internal/sammy/staff/customers/search', 'staff-customers-search'],
  ['POST', '/api/internal/sammy/staff/customers/create', 'staff-customers-create'],
  ['POST', '/api/internal/sammy/staff/locations', 'staff-locations'],
  ['POST', '/api/internal/sammy/staff/catalog', 'staff-catalog'],
  ['POST', '/api/internal/sammy/staff/quote', 'staff-quote'],
  ['POST', '/api/internal/sammy/staff/orders', 'staff-orders-create'],
  ['POST', '/api/internal/sammy/staff/orders/search', 'staff-orders-search'],
  ['POST', '/api/internal/sammy/telegram/link/start', 'telegram-link-start'],
  ['POST', '/api/internal/sammy/telegram/link/status', 'telegram-link-status'],
  ['POST', '/api/internal/sammy/staff/customers/507f1f77bcf86cd799439011', 'staff-customer-read'],
  ['PATCH', '/api/internal/sammy/staff/customers/507f1f77bcf86cd799439011', 'staff-customer-update'],
  ['POST', '/api/internal/sammy/staff/customers/507f1f77bcf86cd799439011/phones', 'staff-customer-phones'],
  ['POST', '/api/internal/sammy/staff/customers/507f1f77bcf86cd799439011/phones/check', 'staff-customer-phones-check'],
  ['POST', '/api/internal/sammy/staff/orders/507f1f77bcf86cd799439011/cancel', 'staff-orders-cancel'],
] as const

test('Render router covers every Telegram staff call and the link API', () => {
  for (const [method, pathname, expected] of cases) {
    const matched = resolveSammyRoute(method, pathname)
    assert.equal(matched?.key, expected, `${method} ${pathname}`)
  }
})

test('Render router captures dynamic IDs without involving a website request', () => {
  const match = resolveSammyRoute('POST', '/api/internal/sammy/staff/customers/customer%2D123')
  assert.deepEqual(match, { key: 'staff-customer-read', id: 'customer-123' })
})

test('Render API does not become an open proxy to SwiftDU', () => {
  const forbidden = [
    ['GET', '/api/internal/sammy/staff/orders'],
    ['PATCH', '/api/internal/sammy/staff/orders'],
    ['GET', '/api/orders'],
    ['POST', '/api/orders'],
    ['POST', '/api/internal/sammy/bootstrap'],
    ['POST', '/api/internal/sammy/staff/orders/123/update'],
    ['POST', '/api/internal/sammy/staff/customers/123/phones/verify'],
    ['POST', '/api/internal/sammy/staff/customers/123%2Fadmin'],
    ['POST', '/api/internal/sammy/staff/customers/%oops'],
    ['POST', '/api/internal/sammy/telegram/link/confirm'],
    ['GET', '/auth'],
    ['POST', '/api/auth/sign-in/email'],
  ]
  for (const [method, pathname] of forbidden) {
    const match = resolveSammyRoute(method, pathname)
    assert.ok(match === null || match.id === '', `Unexpectedly accepted ${method} ${pathname}`)
  }
})
