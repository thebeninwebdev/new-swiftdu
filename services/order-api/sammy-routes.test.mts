import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveSammyRoute } from './sammy-routes.mts'
import { isSammyPortalRoute, issuePortalFormProof, assertPortalFormAllowed } from './sammy-portal.mts'
const { validatePortalToken } = await import('@/lib/sammy/portal-linking')

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
  ['POST', '/api/internal/sammy/orders/current', 'whatsapp-current-order'],
  ['POST', '/api/internal/sammy/orders/current/cancel', 'whatsapp-cancel-order'],
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

test('account connection pages run on Render with a strict allowlist', () => {
  for (const purpose of ['telegram', 'whatsapp']) {
    assert.equal(isSammyPortalRoute('GET', `/${purpose}/connect`), true)
    assert.equal(isSammyPortalRoute('POST', `/${purpose}/connect/request-code`), true)
    assert.equal(isSammyPortalRoute('POST', `/${purpose}/connect/confirm`), true)
    assert.equal(isSammyPortalRoute('POST', `/${purpose}/connect`), false)
    assert.equal(isSammyPortalRoute('GET', `/${purpose}/connect/confirm`), false)
  }
  assert.equal(isSammyPortalRoute('GET', '/api/auth/session'), false)
  assert.equal(isSammyPortalRoute('GET', '/dashboard/whatsapp/register'), false)
})

test('connection token validation rejects malformed or nonmatching tokens', () => {
  assert.throws(() => validatePortalToken('telegram', 'short'))
  assert.throws(() => validatePortalToken('whatsapp', 'short'))
  assert.throws(() => validatePortalToken('whatsapp', 'a'.repeat(43)))
  assert.match(validatePortalToken('telegram', 'a'.repeat(43)), /^[a-f0-9]{64}$/)
  assert.match(validatePortalToken('whatsapp', 'b'.repeat(32)), /^[a-f0-9]{64}$/)
})

test('signed portal forms accept legitimate Telegram webviews without Origin, but reject forgeries', () => {
  const original = process.env.SAMMY_LINK_OTP_SECRET
  const originalPortal = process.env.SAMMY_PORTAL_ORIGIN
  process.env.SAMMY_LINK_OTP_SECRET = 'test-signed-form-proof-key-at-least-32-characters'
  delete process.env.SAMMY_PORTAL_ORIGIN
  try {
    const now = Date.now()
    const token = 'a'.repeat(43)
    const proof = issuePortalFormProof('telegram', token, now)
    assert.ok(proof)
    // Telegram in-app browsers are not guaranteed to attach an Origin header.
    assert.doesNotThrow(() => assertPortalFormAllowed({}, 'telegram', token, proof, now))
    assert.doesNotThrow(() => assertPortalFormAllowed({ origin: 'null' }, 'telegram', token, proof, now))
    assert.doesNotThrow(() => assertPortalFormAllowed({ origin: 'https://swiftdu-orders.onrender.com' }, 'telegram', token, proof, now))
    assert.throws(() => assertPortalFormAllowed({ origin: 'https://evil.example' }, 'telegram', token, proof, now))
    assert.throws(() => assertPortalFormAllowed({ 'sec-fetch-site': 'cross-site' }, 'telegram', token, proof, now))
    assert.throws(() => assertPortalFormAllowed({}, 'telegram', token, null, now))
    assert.throws(() => assertPortalFormAllowed({}, 'telegram', 'b'.repeat(43), proof, now))
    assert.throws(() => assertPortalFormAllowed({}, 'whatsapp', token, proof, now))
    assert.throws(() => assertPortalFormAllowed({}, 'telegram', token, proof, now + 20 * 60_000 + 10))
    assert.throws(() => assertPortalFormAllowed({}, 'telegram', token, proof.slice(0, -1) + (proof.endsWith('a') ? 'b' : 'a'), now))
  } finally {
    if (original === undefined) delete process.env.SAMMY_LINK_OTP_SECRET
    else process.env.SAMMY_LINK_OTP_SECRET = original
    if (originalPortal === undefined) delete process.env.SAMMY_PORTAL_ORIGIN
    else process.env.SAMMY_PORTAL_ORIGIN = originalPortal
  }
})
