import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { SammyOrderRequest } from './contracts'
import { assertSammyOrderRequest } from './input'
import { SammyApiError } from './server'

const valid = (): SammyOrderRequest & Record<string, unknown> => ({
  phone: '2348012345678',
  idempotencyKey: 'wamid.confirmation-1',
  order: { taskType: 'water', parentLocationId: 'parent', location: 'Hall', waterBags: 1 },
})

function hasCode(code: string) {
  return (error: unknown) => error instanceof SammyApiError && error.code === code
}

describe('Sammy order request boundary', () => {
  it('rejects an arbitrary userId at either request level', () => {
    assert.throws(() => assertSammyOrderRequest({ ...valid(), userId: 'victim' }), hasCode('SERVER_OWNED_FIELD'))
    const body = valid(); Object.assign(body.order, { userId: 'victim' })
    assert.throws(() => assertSammyOrderRequest(body), hasCode('SERVER_OWNED_FIELD'))
  })

  it('rejects caller-supplied fee and total fields', () => {
    for (const field of ['serviceFee', 'platformFee', 'taskerFee', 'totalAmount']) {
      const body = valid(); Object.assign(body.order, { [field]: 1 })
      assert.throws(() => assertSammyOrderRequest(body), hasCode('SERVER_OWNED_FIELD'))
    }
  })

  it('requires a stable bounded idempotency key', () => {
    assert.throws(() => assertSammyOrderRequest({ ...valid(), idempotencyKey: '' }), hasCode('INVALID_IDEMPOTENCY_KEY'))
    assert.throws(() => assertSammyOrderRequest({ ...valid(), idempotencyKey: 'x'.repeat(201) }), hasCode('INVALID_IDEMPOTENCY_KEY'))
  })

  it('does not expose Indomie as a Sammy service', () => {
    const body = valid(); Object.assign(body.order, { taskType: 'indomie' })
    assert.throws(() => assertSammyOrderRequest(body), hasCode('INVALID_TASK_TYPE'))
  })
})
