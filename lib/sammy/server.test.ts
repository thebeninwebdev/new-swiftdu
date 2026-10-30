import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { NextRequest } from 'next/server'

import { authenticateSammyRequest, SammyApiError } from './server'

const originalSecret = process.env.SAMMY_SWIFTDU_INTERNAL_SECRET

afterEach(() => {
  if (originalSecret === undefined) delete process.env.SAMMY_SWIFTDU_INTERNAL_SECRET
  else process.env.SAMMY_SWIFTDU_INTERNAL_SECRET = originalSecret
})

function request(authorization?: string) {
  return new NextRequest('https://swiftdu.org/api/internal/sammy/bootstrap', {
    method: 'POST', headers: authorization ? { authorization } : {},
  })
}

describe('Sammy internal authentication', () => {
  it('rejects a missing bearer secret', () => {
    process.env.SAMMY_SWIFTDU_INTERNAL_SECRET = 'correct-secret'
    assert.throws(() => authenticateSammyRequest(request()), (error: unknown) => error instanceof SammyApiError && error.status === 401 && error.code === 'UNAUTHORIZED')
  })

  it('rejects a wrong bearer secret', () => {
    process.env.SAMMY_SWIFTDU_INTERNAL_SECRET = 'correct-secret'
    assert.throws(() => authenticateSammyRequest(request('Bearer wrong-secret')), (error: unknown) => error instanceof SammyApiError && error.status === 401 && error.code === 'UNAUTHORIZED')
  })

  it('accepts the configured bearer secret', () => {
    process.env.SAMMY_SWIFTDU_INTERNAL_SECRET = 'correct-secret'
    assert.doesNotThrow(() => authenticateSammyRequest(request('Bearer correct-secret')))
  })

  it('fails closed when the server secret is not configured', () => {
    delete process.env.SAMMY_SWIFTDU_INTERNAL_SECRET
    assert.throws(() => authenticateSammyRequest(request('Bearer anything')), (error: unknown) => error instanceof SammyApiError && error.status === 503 && error.code === 'INTERNAL_AUTH_NOT_CONFIGURED')
  })
})
