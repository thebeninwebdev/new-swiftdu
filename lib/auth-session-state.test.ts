import assert from 'node:assert/strict'
import test from 'node:test'

import { getAuthSessionState, isTemporaryAuthFailure } from './auth-session-state'

test('page refresh waits for the initial session request', () => {
  assert.equal(getAuthSessionState({ hasUser: false, isPending: true }), 'loading')
})

test('network interruptions are not treated as logout', () => {
  assert.equal(getAuthSessionState({ hasUser: false, error: { status: 0 } }), 'unavailable')
  assert.equal(getAuthSessionState({ hasUser: false, error: { status: 503 } }), 'unavailable')
  assert.equal(isTemporaryAuthFailure({ status: 503 }), true)
})

test('expired sessions and valid persisted sessions remain distinguishable', () => {
  assert.equal(getAuthSessionState({ hasUser: false }), 'unauthenticated')
  assert.equal(getAuthSessionState({ hasUser: false, error: { status: 401 } }), 'unauthenticated')
  assert.equal(getAuthSessionState({ hasUser: true, error: { status: 503 } }), 'authenticated')
})
