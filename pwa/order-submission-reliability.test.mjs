import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync('app/dashboard/page.tsx', 'utf8')

test('uncertain transport retry preserves the pending body and idempotency key', () => {
  assert.match(source, /let responseReceived = false/)
  assert.match(source, /responseReceived = true/)
  assert.match(source, /if \(!responseReceived\)/)
  assert.match(source, /setPendingRecovery\(\{ body, idempotencyKey, createdAt: Date\.now\(\) \}\)/)
  assert.match(source, /'Idempotency-Key': idempotencyKey/)
})

test('storage recovery is best effort and explicit HTTP rejection clears stale recovery', () => {
  assert.match(source, /function readPendingOrderSubmission\(\)/)
  assert.match(source, /function writePendingOrderSubmission\(submission: PendingOrderSubmission\)/)
  assert.match(source, /function clearPendingOrderSubmission\(\)/)
  assert.match(source, /localStorage\.getItem\(PENDING_ORDER_STORAGE_KEY\)/)
  assert.match(source, /localStorage\.setItem\(PENDING_ORDER_STORAGE_KEY/)
  assert.match(source, /localStorage\.removeItem\(PENDING_ORDER_STORAGE_KEY\)/)
  assert.match(source, /if \(!response\.ok\) \{[\s\S]*?clearPendingOrderSubmission\(\)/)
  assert.match(source, /Retry safely when your connection returns\./)
})

test('explicit server errors remain distinct from transport uncertainty', () => {
  const rejectionBlock = source.slice(source.indexOf('if (!response.ok) {'), source.indexOf('const createdOrder = responsePayload'))
  assert.match(rejectionBlock, /setSubmissionFailed\(true\)/)
  assert.doesNotMatch(rejectionBlock, /setSubmissionUncertain\(true\)/)
  const transportBlock = source.slice(source.indexOf('} catch {'), source.indexOf('  const handleSubmit'))
  assert.match(transportBlock, /if \(!responseReceived\)/)
  assert.match(transportBlock, /setSubmissionUncertain\(true\)/)
})
