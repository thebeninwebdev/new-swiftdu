const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')

const read = (file) => fs.readFileSync(file, 'utf8')

test('webhook verifies the raw body before parsing and processing', () => {
  const route = read('app/api/whatsapp/webhook/route.ts')
  const raw = route.indexOf('await request.text()')
  const verify = route.indexOf('verifyMetaWebhookSignature(rawBody')
  const parse = route.indexOf('JSON.parse(rawBody)')
  assert.ok(raw > -1 && verify > raw && parse > verify)
  assert.match(route, /x-hub-signature-256/)
})

test('Sammy uses the shared customer-order service and deterministic message idempotency', () => {
  const flow = read('lib/whatsapp/flow.ts')
  const website = read('app/api/orders/route.ts')
  assert.match(flow, /createCustomerOrder\(/)
  assert.match(website, /const result = await createCustomerOrder\(/)
  assert.match(flow, /`whatsapp:\$\{messageId\}`/)
  assert.doesNotMatch(flow, /new Order\(/)
  assert.doesNotMatch(flow, /order\.save\(/)
})

test('processed messages use recoverable leases', () => {
  const lease = read('lib/whatsapp/message-lease.ts')
  assert.match(lease, /status: 'processing'/)
  assert.match(lease, /leaseExpiresAt: \{ \$lte: now \}/)
  assert.match(lease, /status: 'completed'/)
  assert.match(lease, /status: 'failed'/)
})
