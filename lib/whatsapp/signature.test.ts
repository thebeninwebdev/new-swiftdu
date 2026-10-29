import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import { verifyMetaWebhookSignature } from './signature'

test('accepts a valid Meta webhook signature', () => {
  const body = '{"entry":[]}'
  const secret = 'test-secret'
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  assert.equal(verifyMetaWebhookSignature(body, signature, secret), true)
})

test('rejects invalid and missing Meta webhook signatures', () => {
  assert.equal(verifyMetaWebhookSignature('{}', null, 'secret'), false)
  assert.equal(verifyMetaWebhookSignature('{}', 'sha256=bad', 'secret'), false)
})
